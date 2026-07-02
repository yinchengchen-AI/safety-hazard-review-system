import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ReviewTasks (e2e)', () => {
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

  async function makeHazard(name: string): Promise<string> {
    const uniq = `e_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const ent = await prisma.enterprises.create({ data: { name: uniq } });
    const batch = await prisma.batches.create({
      data: { name: 'b', total_count: 1, success_count: 1, fail_count: 0 },
    });
    const h = await prisma.hazards.create({
      data: {
        enterprise_id: ent.id,
        batch_id: batch.id,
        content: 'x',
        description: 'x',
        status: 'pending',
        review_count: 0,
      },
    });
    return h.id;
  }

  it('creates a task, reviews, then cancel reverts the hazard to pending + decrements review_count', async () => {
    const hid = await makeHazard('cancel');

    const create = await request(app.getHttpServer())
      .post('/api/v1/review-tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `T-${Date.now()}`, hazard_ids: [hid] })
      .expect(201);
    const taskId = create.body.id;
    expect(create.body.hazard_count).toBe(1);

    await request(app.getHttpServer())
      .post(`/api/v1/review-tasks/${taskId}/hazards/${hid}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ conclusion: 'ok', status_in_task: 'passed' })
      .expect(201);

    const afterReview = await prisma.hazards.findFirst({ where: { id: hid } });
    expect(afterReview?.status).toBe('passed');
    expect(afterReview?.review_count).toBe(1);

    // Cancel the task. Hazard must revert to pending with review_count=0.
    await request(app.getHttpServer())
      .post(`/api/v1/review-tasks/${taskId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);

    const afterCancel = await prisma.hazards.findFirst({ where: { id: hid } });
    expect(afterCancel?.status).toBe('pending');
    expect(afterCancel?.review_count).toBe(0);
    expect(afterCancel?.current_task_id).toBeNull();
  });

  it('completes a fully-reviewed task and rejects completion with unreviewed hazards', async () => {
    const h1 = await makeHazard('complete1');
    const h2 = await makeHazard('complete2');
    const create = await request(app.getHttpServer())
      .post('/api/v1/review-tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `TC-${Date.now()}`, hazard_ids: [h1, h2] })
      .expect(201);
    const taskId = create.body.id;

    // Review only one — completion must fail.
    await request(app.getHttpServer())
      .post(`/api/v1/review-tasks/${taskId}/hazards/${h1}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ conclusion: 'ok', status_in_task: 'passed' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/review-tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(400);

    // Review the second one — completion should succeed.
    await request(app.getHttpServer())
      .post(`/api/v1/review-tasks/${taskId}/hazards/${h2}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ conclusion: 'ok', status_in_task: 'failed' })
      .expect(201);
    const complete = await request(app.getHttpServer())
      .post(`/api/v1/review-tasks/${taskId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201);
    expect(complete.body.status).toBe('completed');
  });

  it('batch-review applies multiple conclusions in one call', async () => {
    const h1 = await makeHazard('batch1');
    const h2 = await makeHazard('batch2');
    const create = await request(app.getHttpServer())
      .post('/api/v1/review-tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `TB-${Date.now()}`, hazard_ids: [h1, h2] })
      .expect(201);
    const taskId = create.body.id;

    const res = await request(app.getHttpServer())
      .post(`/api/v1/review-tasks/${taskId}/batch-review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        items: [
          { hazard_id: h1, conclusion: 'ok', status_in_task: 'passed' },
          { hazard_id: h2, conclusion: 'no', status_in_task: 'failed' },
        ],
      })
      .expect(201);
    expect(res.body.length).toBe(2);

    const a = await prisma.hazards.findFirst({ where: { id: h1 } });
    const b = await prisma.hazards.findFirst({ where: { id: h2 } });
    expect(a?.status).toBe('passed');
    expect(b?.status).toBe('failed');
  });
});
