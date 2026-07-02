import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth (e2e)', () => {
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

    // Ensure admin exists with a known password.
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
  });

  afterAll(async () => {
    await app.close();
  });

  it('logs in and returns access_token + httpOnly cookie', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    expect(res.body.access_token).toBeDefined();
    adminToken = res.body.access_token;
    const setCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toMatch(/access_token=/);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
  });

  it('rejects wrong password with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'wrong-password' })
      .expect(401);
  });

  it('returns the current user via Authorization header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.username).toBe('admin');
    expect(res.body.role).toBe('admin');
    expect(res.body.is_active).toBe(true);
  });

  it('returns the current user via cookie', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' })
      .expect(200);
    const cookie = login.headers['set-cookie'];
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200);
  });

  it('rejects me without auth', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401);
  });

  it('blocks a disabled user from logging in', async () => {
    const u = await prisma.users.create({
      data: {
        username: 'disabled-user',
        password_hash: bcrypt.hashSync('whatever12', 12),
        role: 'inspector',
        is_active: false,
      },
    });
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: 'disabled-user', password: 'whatever12' })
      .expect(401);
    await prisma.users.delete({ where: { id: u.id } });
  });

  it('logout clears the cookie', async () => {
    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .expect(204);
    const setCookie = logout.headers['set-cookie']?.[0] ?? '';
    expect(setCookie).toMatch(/access_token=/);
    expect(setCookie).toMatch(/Max-Age=0/);
  });
});
