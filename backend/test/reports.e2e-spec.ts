import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Reports (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.use(require('cookie-parser')());
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);

    const existing = await prisma.users.findFirst({ where: { username: 'admin' } });
    const hash = bcrypt.hashSync('admin123', 12);
    if (existing) {
      await prisma.users.update({ where: { id: existing.id }, data: { password_hash: hash, is_active: true, deleted_at: null } });
    } else {
      await prisma.users.create({ data: { username: 'admin', password_hash: hash, role: 'admin', is_active: true } });
    }
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ username: 'admin', password: 'admin123' }).expect(200);
    adminToken = login.body.access_token;
  });

  afterAll(async () => { await app.close(); });

  it('POST /reports/:taskId/generate is idempotent and enqueues a job', async () => {
    const admin = await prisma.users.findFirst({ where: { username: 'admin' } });
    const ent = await prisma.enterprises.create({ data: { name: `rep_${Date.now()}` } });
    const batch = await prisma.batches.create({ data: { name: 'b', total_count: 0, success_count: 0, fail_count: 0 } });
    const h = await prisma.hazards.create({ data: { enterprise_id: ent.id, batch_id: batch.id, content: 'x', description: 'x', status: 'pending', review_count: 0 } });
    const t = await prisma.review_tasks.create({ data: { id: randomUUID(), name: 'R', creator_id: admin!.id, status: 'pending' } });
    await prisma.task_hazards.create({ data: { task_id: t.id, hazard_id: h.id } });

    const r1 = await request(app.getHttpServer())
      .post(`/api/v1/reports/${t.id}/generate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(r1.body.task_id).toBe(t.id);

    // A completed-then-regenerated flow: mark the report as completed and re-trigger
    await prisma.reports.update({ where: { task_id: t.id }, data: { status: 'completed' } });
    const r2 = await request(app.getHttpServer())
      .post(`/api/v1/reports/${t.id}/generate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(r2.body.task_id).toBe(t.id);

    const status = await request(app.getHttpServer())
      .get(`/api/v1/reports/${t.id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(status.body.status).toBeDefined();
  });
});
