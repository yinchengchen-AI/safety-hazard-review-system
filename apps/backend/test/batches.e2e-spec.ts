import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Batches (e2e)', () => {
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
      await prisma.users.update({
        where: { id: existing.id },
        data: { password_hash: hash, is_active: true, deleted_at: null },
      });
    } else {
      await prisma.users.create({
        data: { username: 'admin', password_hash: hash, role: 'admin', is_active: true },
      });
    }
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    adminToken = login.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('imports rows with SAVEPOINT, dedup, and import_errors persistence', async () => {
    const uniq = `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // First import: two valid rows.
    const first = await request(app.getHttpServer())
      .post('/api/v1/batches/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'B1',
        filename: 'a.xlsx',
        rows: [
          { enterprise_name: uniq, description: 'H1', location: '1F' },
          { enterprise_name: uniq, description: 'H2', location: '2F' },
        ],
      })
      .expect(201);
    expect(first.body.success_count).toBe(2);
    expect(first.body.fail_count).toBe(0);
    const batch1Id = first.body.batch.id;

    // Second import: one good row, one duplicate of H1, one with empty description.
    const second = await request(app.getHttpServer())
      .post('/api/v1/batches/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'B2',
        filename: 'b.xlsx',
        rows: [
          { enterprise_name: uniq, description: 'H3', location: '3F' },
          { enterprise_name: uniq, description: 'H1', location: '1F' },
          { enterprise_name: uniq, description: '', location: '4F' },
        ],
      })
      .expect(201);
    expect(second.body.success_count).toBe(1);
    expect(second.body.fail_count).toBe(2);

    // import_errors are persisted
    const errors = await request(app.getHttpServer())
      .get(`/api/v1/batches/${second.body.batch.id}/errors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(errors.body.length).toBe(2);
    // Make sure H1 and H2 are still there.
    const hazards = await prisma.hazards.count({
      where: { enterprise_id: { in: (await prisma.enterprises.findMany({ where: { name: uniq } })).map((e) => e.id) } },
    });
    expect(hazards).toBe(3);
  });

  it('previews rows without writing to DB', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/batches/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rows: [
          { enterprise_name: 'X', description: 'd1' },
          { enterprise_name: 'X', description: '' },
        ],
      })
      .expect(201);
    expect(res.body.total).toBe(2);
    expect(res.body.items[0].errors.length).toBe(0);
    expect(res.body.items[1].errors).toContain('隐患描述不能为空');
  });

  it('template endpoint returns xlsx with sample row', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/batches/template')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml/);
    expect(Number(res.headers['content-length'])).toBeGreaterThan(0);
  });
});
