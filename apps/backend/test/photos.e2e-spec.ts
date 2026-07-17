import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { UrlSignerService } from '../src/storage/url-signer.service';

import * as path from 'path';

/** Build a 200x200 PNG from the committed fixture. */
function makePng(): Buffer {
  return require('fs').readFileSync(path.join(__dirname, 'fixtures', '200x200.png'));
}

describe('Photos (e2e)', () => {
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
    const signer = app.get(UrlSignerService);

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

  afterAll(async () => {
    await app.close();
  });

  it('uploads a PNG and serves it via signed URL (200), rejects without sig (401)', async () => {
    const png = makePng();
    const up = await request(app.getHttpServer())
      .post('/api/v1/photos/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', png, { filename: 'tiny.png', contentType: 'image/png' })
      .expect(201);
    expect(up.body.temp_token).toBeDefined();
    expect(up.body.original_url).toMatch(/sig=/);
    expect(up.body.thumbnail_url).toMatch(/sig=/);
    expect(up.body.width).toBe(200);
    expect(up.body.height).toBe(200);

    // Serve the signed URL
    const ok = await request(app.getHttpServer()).get(up.body.original_url).expect(200);
    expect(ok.headers['content-type']).toBe('image/png');
    const hashOk = createHash('sha256').update(ok.body).digest('hex');
    const hashExpected = createHash('sha256').update(png).digest('hex');
    expect(hashOk).toBe(hashExpected);

    // No sig/exp/token → 401
    const noSig = await request(app.getHttpServer()).get(`/api/v1/photos/${(await prisma.photos.findFirst({ where: { temp_token: up.body.temp_token } }))!.id}/image?size=original`);
    expect([401, 404]).toContain(noSig.status);
  });

  it('binds a photo to a task_hazard', async () => {
    const png = makePng();
    const up = await request(app.getHttpServer())
      .post('/api/v1/photos/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', png, { filename: 'tiny.png', contentType: 'image/png' })
      .expect(201);

    // Create a task + task_hazard to bind to
    const ent = await prisma.enterprises.create({ data: { name: `photo_ent_${Date.now()}` } });
    const batch = await prisma.batches.create({ data: { name: 'b', total_count: 1, success_count: 1, fail_count: 0 } });
    const h = await prisma.hazards.create({
      data: { enterprise_id: ent.id, batch_id: batch.id, content: 'x', description: 'x', status: 'pending', review_count: 0 },
    });
    const t = await prisma.review_tasks.create({
      data: { id: require('crypto').randomUUID(), name: 'P', creator_id: (await prisma.users.findFirst({ where: { username: 'admin' } }))!.id, status: 'pending' },
    });
    const th = await prisma.task_hazards.create({ data: { task_id: t.id, hazard_id: h.id } });

    await request(app.getHttpServer())
      .post(`/api/v1/photos/${up.body.temp_token}/bind`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ task_hazard_id: th.id })
      .expect(200);

    const photo = await prisma.photos.findFirst({ where: { task_hazard_id: th.id } });
    expect(photo?.task_hazard_id).toBe(th.id);
  });

  // P0-1: serve without sig/exp must return 401. With the legacy
  // ?token=<jwt> path removed the photo endpoint refuses any
  // unauthenticated request.
  it('rejects photo fetch without HMAC signature (P0-1)', async () => {
    const png = makePng();
    const up = await request(app.getHttpServer())
      .post('/api/v1/photos/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', png, { filename: 'tiny.png', contentType: 'image/png' })
      .expect(201);

    const photo = await prisma.photos.findFirst({ where: { temp_token: up.body.temp_token } });

    // No sig / exp / token at all → 401.
    const r1 = await request(app.getHttpServer())
      .get(`/api/v1/photos/${photo!.id}/image?size=original`)
      .expect(401);
    expect(r1.body.detail).toMatch(/signed URL/);

    // Legacy ?token=<jwt> is no longer accepted even with a valid token.
    const r2 = await request(app.getHttpServer())
      .get(`/api/v1/photos/${photo!.id}/image?size=original&token=${adminToken}`)
      .expect(401);
    expect(r2.body.detail).toMatch(/signed URL/);
  });

  // P0-3: a non-uploader non-admin user must not be able to bind
  // someone else's photo. We need a second user for this.
  it('rejects bind from non-uploader non-admin (P0-3)', async () => {
    // Create an inspector user (non-admin) with a known password.
    const inspectorName = `inspector_${Date.now()}`;
    const inspectorHash = bcrypt.hashSync('inspector-pw', 12);
    await prisma.users.create({
      data: { username: inspectorName, password_hash: inspectorHash, role: 'inspector', is_active: true },
    });
    const inspectorLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ username: inspectorName, password: 'inspector-pw' })
      .expect(200);
    const inspectorCookie = inspectorLogin.headers['set-cookie']?.[0] ?? '';
    const inspectorMatch = inspectorCookie.match(/access_token=([^;]+)/);
    const inspectorToken = inspectorMatch ? decodeURIComponent(inspectorMatch[1]) : '';

    // Admin uploads a photo (admin is the uploader).
    const png = makePng();
    const up = await request(app.getHttpServer())
      .post('/api/v1/photos/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', png, { filename: 'tiny.png', contentType: 'image/png' })
      .expect(201);

    // Inspector tries to bind admin's photo → 400 (P0-3).
    const ent = await prisma.enterprises.create({ data: { name: `bind_ent_${Date.now()}` } });
    const batch = await prisma.batches.create({ data: { name: 'b', total_count: 1, success_count: 1, fail_count: 0 } });
    const h = await prisma.hazards.create({
      data: { enterprise_id: ent.id, batch_id: batch.id, content: 'x', description: 'x', status: 'pending', review_count: 0 },
    });
    const admin = await prisma.users.findFirst({ where: { username: 'admin' } });
    const t = await prisma.review_tasks.create({
      data: { id: require('crypto').randomUUID(), name: 'P', creator_id: admin!.id, status: 'pending' },
    });
    const th = await prisma.task_hazards.create({ data: { task_id: t.id, hazard_id: h.id } });

    const r = await request(app.getHttpServer())
      .post(`/api/v1/photos/${up.body.temp_token}/bind`)
      .set('Authorization', `Bearer ${inspectorToken}`)
      .send({ task_hazard_id: th.id })
      .expect(400);
    expect(r.body.detail).toMatch(/uploader or an admin/);

    // Verify the bind did not happen.
    const photo = await prisma.photos.findFirst({ where: { temp_token: up.body.temp_token } });
    expect(photo?.task_hazard_id).toBeNull();
    expect(photo?.temp_token).toBe(up.body.temp_token);
  });
});
