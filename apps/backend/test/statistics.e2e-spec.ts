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
    const setCookie = login.headers['set-cookie']?.[0] ?? '';
    const match = setCookie.match(/access_token=([^;]+)/);
    adminToken = match ? decodeURIComponent(match[1]) : '';
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

  it('trend with granularity=month reads statistics_monthly and returns YYYY-MM periods', async () => {
    const monthKey = `2099-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}`;
    await prisma.statistics_monthly.create({
      data: {
        stat_month: monthKey,
        total_hazards: 7,
        pending_count: 3,
        passed_count: 2,
        failed_count: 2,
        review_count: 4,
        task_count: 1,
      },
    });

    const r = await request(app.getHttpServer())
      .get(`/api/v1/statistics/trend?granularity=month&start_date=2099-01-01&end_date=2099-12-31`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(r.body).toBeInstanceOf(Array);
    const row = r.body.find((x: { period: string }) => x.period === monthKey);
    expect(row).toBeDefined();
    expect(row.total_hazards).toBe(7);
    expect(row.review_count).toBe(4);
    expect(row.task_count).toBe(1);

    // Out-of-range date filter excludes the row.
    const empty = await request(app.getHttpServer())
      .get('/api/v1/statistics/trend?granularity=month&start_date=2098-01-01&end_date=2098-12-31')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(empty.body.some((x: { period: string }) => x.period === monthKey)).toBe(false);
  });

  it('trend rejects an invalid granularity', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/statistics/trend?granularity=year')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);
  });
});
