import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Users (e2e)', () => {
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

  it('lists users (admin only)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users?page=1&page_size=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.items).toBeInstanceOf(Array);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('rejects list without auth', async () => {
    await request(app.getHttpServer()).get('/api/v1/users').expect(401);
  });

  it('creates a user, fetches them, and updates them', async () => {
    const username = `e2e_${Date.now()}`;
    const create = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username, password: 'longenough123', role: 'inspector', full_name: 'E2E' })
      .expect(201);
    expect(create.body.username).toBe(username);
    const userId = create.body.id;

    const get = await request(app.getHttpServer())
      .get(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(get.body.username).toBe(username);

    const upd = await request(app.getHttpServer())
      .put(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ full_name: 'Updated' })
      .expect(200);
    expect(upd.body.full_name).toBe('Updated');
  });

  it('rejects duplicate usernames', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username: 'admin', password: 'longenough123', role: 'inspector' })
      .expect(400);
  });

  it('resets a password and deletes (soft) a user', async () => {
    const username = `del_${Date.now()}`;
    const create = await request(app.getHttpServer())
      .post('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ username, password: 'longenough123', role: 'inspector' })
      .expect(201);
    const userId = create.body.id;

    await request(app.getHttpServer())
      .post(`/api/v1/users/${userId}/reset-password`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ new_password: 'freshpass1234' })
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);

    // Soft-deleted: get should 404 (middleware filters out deleted rows).
    await request(app.getHttpServer())
      .get(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(404);
  });
});
