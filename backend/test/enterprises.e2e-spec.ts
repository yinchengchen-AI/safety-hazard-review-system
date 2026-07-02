import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Enterprises (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
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

  it('creates, lists, gets, and updates an enterprise; soft-delete hides it', async () => {
    const uniq = `ent_${Date.now()}`;
    const create = await request(app.getHttpServer())
      .post('/api/v1/enterprises')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: uniq, region: '北京市', industry_sector: '商务系统' })
      .expect(201);
    expect(create.body.name).toBe(uniq);
    const id = create.body.id;

    const list = await request(app.getHttpServer())
      .get(`/api/v1/enterprises?page=1&page_size=5&keyword=${uniq}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body.items.length).toBeGreaterThanOrEqual(1);

    const get = await request(app.getHttpServer())
      .get(`/api/v1/enterprises/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(get.body.name).toBe(uniq);

    const upd = await request(app.getHttpServer())
      .put(`/api/v1/enterprises/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ region: '上海市' })
      .expect(200);
    expect(upd.body.region).toBe('上海市');

    const stats = await request(app.getHttpServer())
      .get(`/api/v1/enterprises/${id}/statistics`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(stats.body.total_hazards).toBe(0);
    expect(stats.body.coverage_rate).toBe(0);

    await request(app.getHttpServer())
      .delete(`/api/v1/enterprises/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/enterprises/${id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });

  it('imports enterprise rows with dedup and reports errors', async () => {
    const name = `imp_${Date.now()}`;
    const res = await request(app.getHttpServer())
      .post('/api/v1/enterprises/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rows: [
          { name, region: '北京市' },
          { name, region: '北京市' }, // dup name
          { name: '', region: '北京市' }, // empty name
        ],
      })
      .expect(201);
    expect(res.body.success_count).toBe(1);
    expect(res.body.error_count).toBe(2);
    expect(res.body.errors.length).toBe(2);
  });

  it('exports xlsx and template (admin-only)', async () => {
    const exportRes = await request(app.getHttpServer())
      .get('/api/v1/enterprises/export')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(exportRes.headers['content-type']).toMatch(/spreadsheetml/);
    expect(Number(exportRes.headers['content-length'])).toBeGreaterThan(0);

    const tmplRes = await request(app.getHttpServer())
      .get('/api/v1/enterprises/template')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(tmplRes.headers['content-type']).toMatch(/spreadsheetml/);
    expect(Number(tmplRes.headers['content-length'])).toBeGreaterThan(0);
  });

  it('rejects non-admin access to enterprise endpoints', async () => {
    // First, create a non-admin user.
    const username = `noadmin_${Date.now()}`;
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username, password: 'longenough123', role: 'inspector' })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username, password: 'longenough123' })
      .expect(200);
    const inspectorToken = login.body.access_token;

    await request(app.getHttpServer())
      .get('/api/v1/enterprises')
      .set('Authorization', `Bearer ${inspectorToken}`)
      .expect(403);
  });
});
