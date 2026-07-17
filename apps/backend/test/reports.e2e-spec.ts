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
    const setCookie = login.headers['set-cookie']?.[0] ?? '';
    const match = setCookie.match(/access_token=([^;]+)/);
    adminToken = match ? decodeURIComponent(match[1]) : '';
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

  // P0-2: a non-creator non-admin user must not download a task's
  // report. We create a second inspector and verify they get 403.
  it('rejects report download from non-creator non-admin (P0-2)', async () => {
    const admin = await prisma.users.findFirst({ where: { username: 'admin' } });
    // Set up a task owned by the admin (so admin is creator) with a
    // completed report so the download path is exercised.
    const ent = await prisma.enterprises.create({ data: { name: `dl_ent_${Date.now()}` } });
    const batch = await prisma.batches.create({ data: { name: 'b', total_count: 0, success_count: 0, fail_count: 0 } });
    const h = await prisma.hazards.create({ data: { enterprise_id: ent.id, batch_id: batch.id, content: 'x', description: 'x', status: 'pending', review_count: 0 } });
    const t = await prisma.review_tasks.create({ data: { id: randomUUID(), name: 'DL', creator_id: admin!.id, status: 'pending' } });
    await prisma.task_hazards.create({ data: { task_id: t.id, hazard_id: h.id } });
    await prisma.reports.create({ data: { id: randomUUID(), task_id: t.id, status: 'completed', pdf_path: 'reports/x.pdf', word_path: 'reports/x.docx' } });

    // Create inspector user.
    const inspectorName = `dl_inspector_${Date.now()}`;
    const inspectorHash = bcrypt.hashSync('inspector-pw', 12);
    await prisma.users.create({
      data: { username: inspectorName, password_hash: inspectorHash, role: 'inspector', is_active: true },
    });
    const inspectorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: inspectorName, password: 'inspector-pw' })
      .expect(200);
    const inspectorToken = (inspectorLogin.headers['set-cookie']?.[0] ?? '').match(/access_token=([^;]+)/)?.[1] ?? '';

    // Inspector attempts to download → 403 (the assertCanDownload
    // check kicks in after the existence check, so we get 403 not
    // 404 — see P0-2 fix).
    const r = await request(app.getHttpServer())
      .get(`/api/v1/reports/${t.id}/download?format=pdf`)
      .set('Authorization', `Bearer ${decodeURIComponent(inspectorToken)}`)
      .expect(403);
    expect(r.body.detail).toMatch(/do not have access/);

    // Admin (creator + admin role) passes the check and gets the
    // expected 200/404 from the storage layer (we do not upload the
    // binary in this test, so the storage lookup will 404 — what
    // matters is that authz passes).
    const adminRes = await request(app.getHttpServer())
      .get(`/api/v1/reports/${t.id}/download?format=pdf`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect([200, 404]).toContain(adminRes.status);
  });

  // P0-5: a force re-run on a completed report must reset the row
  // back to pending so the worker actually picks it up.
  it('force re-run from completed resets status to pending (P0-5)', async () => {
    const admin = await prisma.users.findFirst({ where: { username: 'admin' } });
    const ent = await prisma.enterprises.create({ data: { name: `force_ent_${Date.now()}` } });
    const batch = await prisma.batches.create({ data: { name: 'b', total_count: 0, success_count: 0, fail_count: 0 } });
    const h = await prisma.hazards.create({ data: { enterprise_id: ent.id, batch_id: batch.id, content: 'x', description: 'x', status: 'pending', review_count: 0 } });
    const t = await prisma.review_tasks.create({ data: { id: randomUUID(), name: 'F', creator_id: admin!.id, status: 'pending' } });
    await prisma.task_hazards.create({ data: { task_id: t.id, hazard_id: h.id } });

    // Seed a completed report.
    await prisma.reports.create({
      data: {
        id: randomUUID(),
        task_id: t.id,
        status: 'completed',
        pdf_path: 'reports/x.pdf',
        word_path: 'reports/x.docx',
        generated_at: new Date(),
      },
    });

    // Force re-run.
    await request(app.getHttpServer())
      .post(`/api/v1/reports/${t.id}/generate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    // Status should be back to 'pending' with paths cleared.
    const row = await prisma.reports.findFirst({ where: { task_id: t.id } });
    expect(row?.status).toBe('pending');
    expect(row?.pdf_path).toBeNull();
    expect(row?.word_path).toBeNull();
  });
});
