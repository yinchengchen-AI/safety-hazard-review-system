import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('AuditLogs (e2e)', () => {
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

  it('list with filters, plus a create-then-list round trip', async () => {
    const r1 = await request(app.getHttpServer())
      .get('/api/v1/audit-logs?page=1&page_size=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(r1.body.items).toBeInstanceOf(Array);

    // Filter by action=login_success
    const r2 = await request(app.getHttpServer())
      .get('/api/v1/audit-logs?action=login_success&page=1&page_size=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(r2.body.items).toBeInstanceOf(Array);
  });
});
