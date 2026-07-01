import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Notifications (e2e)', () => {
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

  it('list / unread-count / mark-read flow', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/v1/notifications?page=1&page_size=5')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body.items).toBeInstanceOf(Array);
    expect(typeof list.body.unread_count).toBe('number');

    const u = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(typeof u.body.count).toBe('number');

    // mark-all-read is idempotent
    await request(app.getHttpServer())
      .post('/api/v1/notifications/read-all')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(204);
  });
});
