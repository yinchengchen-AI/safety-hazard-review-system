import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Statistics (e2e)', () => {
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

  it('overview returns aggregate counts and rates', async () => {
    const r = await request(app.getHttpServer())
      .get('/api/v1/statistics/overview')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(typeof r.body.total_hazards).toBe('number');
    expect(typeof r.body.coverage_rate).toBe('number');
    expect(typeof r.body.pass_rate).toBe('number');
  });

  it('trend returns the daily rollup array', async () => {
    const r = await request(app.getHttpServer())
      .get('/api/v1/statistics/trend?start_date=2026-01-01&end_date=2030-12-31')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(r.body).toBeInstanceOf(Array);
  });
});
