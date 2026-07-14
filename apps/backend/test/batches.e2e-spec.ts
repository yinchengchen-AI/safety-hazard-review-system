import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { PrismaService } from '../src/prisma/prisma.service';

async function buildImportBuffer(rows: Record<string, string | number | Date | null>[]): Promise<Buffer> {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('导入模板');
  const headers = [
    '上报单位', '行业领域', '企业类型', '企业名称', '统一社会信用代码',
    '属地', '详细地址', '负责人', '隐患分类', '隐患描述', '隐患位置',
    '检查方式', '检查人', '检查时间', '判定依据', '违反判定依据具体条款',
    '是否整改', '实际整改完成时间', '整改责任部门/责任人', '整改措施',
    '举报情况备注',
  ];
  ws.addRow(headers);
  for (const row of rows) {
    ws.addRow(headers.map((h) => row[h] ?? ''));
  }
  return Buffer.from(await wb.xlsx.writeBuffer() as ArrayBuffer);
}

describe('Batches (e2e)', () => {
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
    const setCookie = login.headers['set-cookie']?.[0] ?? '';
    const match = setCookie.match(/access_token=([^;]+)/);
    adminToken = match ? decodeURIComponent(match[1]) : '';
  });

  afterAll(async () => {
    await app.close();
  });

  it('imports rows with SAVEPOINT, dedup, and import_errors persistence', async () => {
    const uniq = `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    // First import: two valid rows.
    const firstBuffer = await buildImportBuffer([
      { '企业名称': uniq, '隐患描述': 'H1', '隐患位置': '1F' },
      { '企业名称': uniq, '隐患描述': 'H2', '隐患位置': '2F' },
    ]);
    const first = await request(app.getHttpServer())
      .post('/api/v1/batches/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', firstBuffer, { filename: 'a.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(201);
    expect(first.body.success_count).toBe(2);
    expect(first.body.fail_count).toBe(0);

    // Second import: one good row, one duplicate of H1, one with empty description.
    const secondBuffer = await buildImportBuffer([
      { '企业名称': uniq, '隐患描述': 'H3', '隐患位置': '3F' },
      { '企业名称': uniq, '隐患描述': 'H1', '隐患位置': '1F' },
      { '企业名称': uniq, '隐患描述': '', '隐患位置': '4F' },
    ]);
    const second = await request(app.getHttpServer())
      .post('/api/v1/batches/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', secondBuffer, { filename: 'b.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(201);
    expect(second.body.success_count).toBe(1);
    expect(second.body.fail_count).toBe(2);

    // import_errors are persisted
    const errors = await request(app.getHttpServer())
      .get(`/api/v1/batches/${second.body.batch.id}/errors`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(errors.body.length).toBe(2);
    // Make sure H1, H2 and H3 are still there (H1 duplicated row fails, but original H1 exists).
    const hazards = await prisma.hazards.count({
      where: { enterprise_id: { in: (await prisma.enterprises.findMany({ where: { name: uniq } })).map((e) => e.id) } },
    });
    expect(hazards).toBe(3);
  });

  it('previews rows without writing to DB', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/batches/preview')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        rows: [
          { enterprise_name: 'X', description: 'd1' },
          { enterprise_name: 'X', description: '' },
        ],
      })
      .expect(201);
    expect(res.body.total).toBe(2);
    expect(res.body.items[0].errors.length).toBe(0);
    expect(res.body.items[1].errors).toContain('隐患描述不能为空');
  });

  it('reuses a single enterprise record when the same credit_code appears multiple times', async () => {
    const uniq = `e_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const creditCode = `91${Date.now()}`;

    const buffer = await buildImportBuffer([
      { '企业名称': uniq, '统一社会信用代码': creditCode, '隐患描述': 'H1', '隐患位置': '1F' },
      { '企业名称': uniq, '统一社会信用代码': creditCode, '隐患描述': 'H2', '隐患位置': '2F' },
      { '企业名称': `${uniq}-alias`, '统一社会信用代码': creditCode, '隐患描述': 'H3', '隐患位置': '3F' },
    ]);
    const res = await request(app.getHttpServer())
      .post('/api/v1/batches/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', buffer, { filename: 'dedup.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(201);
    expect(res.body.success_count).toBe(3);

    const enterprises = await prisma.enterprises.findMany({
      where: { credit_code: creditCode },
    });
    expect(enterprises.length).toBe(1);
  });
});
