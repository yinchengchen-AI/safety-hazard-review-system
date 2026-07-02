import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';
import { UrlSignerService } from '../src/storage/url-signer.service';

/** Build a 200x200 PNG in memory. */
function makePng(): Buffer {
  return require('fs').readFileSync('/tmp/200x200.png');
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
    adminToken = login.body.access_token;
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
});
