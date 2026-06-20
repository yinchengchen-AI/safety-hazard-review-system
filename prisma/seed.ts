import {
  PrismaClient,
  UserRole,
  UserStatus,
  CaseStatus,
  CaseSeverity,
  ReviewStatus,
  Conclusion,
  ItemResult,
  AuditDecision,
  NotificationType,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function ymd(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const NOW = new Date();
const TODAY_PREFIX = ymd(NOW);
const PASSWORD = 'password123';

type SeedUser = { name: string; email: string; role: UserRole };
type SeedEnterprise = {
  name: string;
  unifiedSocialCreditId: string;
  industry: string;
  address: string;
  contactName: string;
  contactPhone: string;
};
type SeedTemplate = {
  code: string;
  name: string;
  items: { content: string; sortOrder: number; required: boolean; evidenceRequired: boolean }[];
};

const USERS: SeedUser[] = [
  { name: '监管员甲', email: 'inspector@example.com', role: UserRole.INSPECTOR },
  { name: '监管员乙', email: 'inspector2@example.com', role: UserRole.INSPECTOR },
  { name: '监管员丙', email: 'inspector3@example.com', role: UserRole.INSPECTOR },
  { name: '监管员丁', email: 'inspector4@example.com', role: UserRole.INSPECTOR },
  { name: '监管员戊', email: 'inspector5@example.com', role: UserRole.INSPECTOR },
  { name: '科长甲', email: 'chief@example.com', role: UserRole.CHIEF },
  { name: '科长乙', email: 'chief2@example.com', role: UserRole.CHIEF },
  { name: '科长丙', email: 'chief3@example.com', role: UserRole.CHIEF },
  { name: '局长甲', email: 'director@example.com', role: UserRole.DIRECTOR },
  { name: '系统管理员', email: 'admin@example.com', role: UserRole.ADMIN },
];

const ENTERPRISES: SeedEnterprise[] = [
  { name: '示范化工有限公司', unifiedSocialCreditId: '91110000XXXXXX0001', industry: '化工', address: '示范市示范区 1 号', contactName: '张总', contactPhone: '13800000001' },
  { name: '蓝海机械制造', unifiedSocialCreditId: '91110000XXXXXX0002', industry: '机械', address: '示范市示范区 2 号', contactName: '李经理', contactPhone: '13800000002' },
  { name: '阳光纺织厂', unifiedSocialCreditId: '91110000XXXXXX0003', industry: '纺织', address: '示范市示范区 3 号', contactName: '王主任', contactPhone: '13800000003' },
  { name: '东盛建材', unifiedSocialCreditId: '91110000XXXXXX0004', industry: '建材', address: '示范市示范区 4 号', contactName: '赵总', contactPhone: '13800000004' },
  { name: '南海食品加工', unifiedSocialCreditId: '91110000XXXXXX0005', industry: '食品', address: '示范市示范区 5 号', contactName: '钱经理', contactPhone: '13800000005' },
  { name: '北辰物流', unifiedSocialCreditId: '91110000XXXXXX0006', industry: '物流', address: '示范市示范区 6 号', contactName: '孙站长', contactPhone: '13800000006' },
  { name: '中科电子', unifiedSocialCreditId: '91110000XXXXXX0007', industry: '电子', address: '示范市示范区 7 号', contactName: '周工', contactPhone: '13800000007' },
  { name: '金山矿业', unifiedSocialCreditId: '91110000XXXXXX0008', industry: '矿业', address: '示范市示范区 8 号', contactName: '吴总', contactPhone: '13800000008' },
  { name: '银河制药', unifiedSocialCreditId: '91110000XXXXXX0009', industry: '制药', address: '示范市示范区 9 号', contactName: '郑总', contactPhone: '13800000009' },
  { name: '东方电气', unifiedSocialCreditId: '91110000XXXXXX0010', industry: '电气', address: '示范市示范区 10 号', contactName: '冯总', contactPhone: '13800000010' },
  { name: '华兴塑料制品', unifiedSocialCreditId: '91110000XXXXXX0011', industry: '塑料', address: '示范市示范区 11 号', contactName: '陈总', contactPhone: '13800000011' },
  { name: '万通汽修', unifiedSocialCreditId: '91110000XXXXXX0012', industry: '汽修', address: '示范市示范区 12 号', contactName: '褚总', contactPhone: '13800000012' },
  { name: '瑞祥印刷', unifiedSocialCreditId: '91110000XXXXXX0013', industry: '印刷', address: '示范市示范区 13 号', contactName: '卫总', contactPhone: '13800000013' },
  { name: '金穗粮油', unifiedSocialCreditId: '91110000XXXXXX0014', industry: '粮油', address: '示范市示范区 14 号', contactName: '蒋总', contactPhone: '13800000014' },
  { name: '宏达建筑', unifiedSocialCreditId: '91110000XXXXXX0015', industry: '建筑', address: '示范市示范区 15 号', contactName: '沈总', contactPhone: '13800000015' },
];

const HAZARD_TYPES = [
  { code: 'FIRE', name: '消防安全', category: '消防', sortOrder: 1 },
  { code: 'SPECIAL_EQUIPMENT', name: '特种设备', category: '特种设备', sortOrder: 2 },
  { code: 'HAZMAT', name: '危化品', category: '危化品', sortOrder: 3 },
  { code: 'ELECTRICAL', name: '电气安全', category: '电气', sortOrder: 4 },
];

const TEMPLATES: SeedTemplate[] = [
  {
    code: 'FIRE',
    name: '消防安全复核清单 v1',
    items: [
      { content: '灭火器是否在有效期内', sortOrder: 1, required: true, evidenceRequired: true },
      { content: '疏散通道是否畅通', sortOrder: 2, required: true, evidenceRequired: true },
      { content: '应急照明是否正常', sortOrder: 3, required: true, evidenceRequired: false },
      { content: '消防栓是否有水', sortOrder: 4, required: true, evidenceRequired: true },
      { content: '员工消防培训记录', sortOrder: 5, required: false, evidenceRequired: false },
    ],
  },
  {
    code: 'SPECIAL_EQUIPMENT',
    name: '特种设备复核清单 v1',
    items: [
      { content: '设备是否在检验有效期内', sortOrder: 1, required: true, evidenceRequired: true },
      { content: '操作人员是否持证', sortOrder: 2, required: true, evidenceRequired: true },
      { content: '安全保护装置是否完好', sortOrder: 3, required: true, evidenceRequired: false },
      { content: '日常运行记录是否完整', sortOrder: 4, required: true, evidenceRequired: false },
    ],
  },
  {
    code: 'HAZMAT',
    name: '危化品复核清单 v1',
    items: [
      { content: '储存区域是否合规', sortOrder: 1, required: true, evidenceRequired: true },
      { content: 'MSDS 是否上墙', sortOrder: 2, required: true, evidenceRequired: true },
      { content: '双人双锁制度是否落实', sortOrder: 3, required: true, evidenceRequired: false },
      { content: '应急处置物资是否齐备', sortOrder: 4, required: true, evidenceRequired: true },
      { content: '台账记录是否完整', sortOrder: 5, required: false, evidenceRequired: false },
    ],
  },
  {
    code: 'ELECTRICAL',
    name: '电气安全复核清单 v1',
    items: [
      { content: '配电箱是否张贴警示标识', sortOrder: 1, required: true, evidenceRequired: false },
      { content: '漏电保护是否正常', sortOrder: 2, required: true, evidenceRequired: true },
      { content: '接地是否可靠', sortOrder: 3, required: true, evidenceRequired: true },
      { content: '线路敷设是否规范', sortOrder: 4, required: true, evidenceRequired: false },
    ],
  },
];

const SOURCES = ['监管检查', '举报', '上级交办', '专项检查', '年度例行'];
const SEVERITIES: CaseSeverity[] = [CaseSeverity.MAJOR, CaseSeverity.MODERATE, CaseSeverity.MINOR];
const SEVERITY_WEIGHTS = [0.3, 0.4, 0.3]; // 30% MAJOR, 40% MODERATE, 30% MINOR

const DESCRIPTIONS: Record<string, string[]> = {
  FIRE: [
    '车间灭火器超期未检',
    '疏散通道堆放杂物',
    '应急照明灯不亮',
    '消防栓无水',
    '员工消防培训记录缺失',
  ],
  SPECIAL_EQUIPMENT: [
    '叉车未年检',
    '锅炉操作工无证',
    '压力表超期',
    '安全阀未校验',
  ],
  HAZMAT: [
    '危化品库房双人双锁未落实',
    'MSDS 未上墙',
    '台账记录不全',
    '应急物资缺失',
  ],
  ELECTRICAL: [
    '配电箱未接地',
    '漏电保护失灵',
    '线路私拉乱接',
    '配电室堆放杂物',
  ],
};

const CONCLUSIONS: Conclusion[] = [Conclusion.PASS, Conclusion.PARTIAL, Conclusion.FAIL];
const ITEM_RESULTS: ItemResult[] = [ItemResult.PASS, ItemResult.FAIL, ItemResult.NA];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickWeighted<T>(arr: T[], weights: number[]): T {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < arr.length; i++) {
    acc += weights[i];
    if (r < acc) return arr[i];
  }
  return arr[arr.length - 1];
}

function nextCaseCode(seq: number): string {
  return `${TODAY_PREFIX}-${String(seq).padStart(4, '0')}`;
}

async function ensureUsers(hashed: string) {
  const result: Record<string, string> = {};
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, status: UserStatus.ACTIVE },
      create: {
        name: u.name,
        email: u.email,
        passwordHash: hashed,
        role: u.role,
        status: UserStatus.ACTIVE,
      },
    });
    result[u.role] = result[u.role] ?? user.id;
    if (!result[u.email]) result[u.email] = user.id;
  }
  return result;
}

async function ensureEnterprises() {
  const result: Record<string, string> = {};
  for (const e of ENTERPRISES) {
    const ent = await prisma.enterprise.upsert({
      where: { unifiedSocialCreditId: e.unifiedSocialCreditId },
      update: { name: e.name, industry: e.industry },
      create: e,
    });
    result[ent.id] = ent.name;
  }
  return result;
}

async function ensureHazardTypes() {
  const result: Record<string, string> = {};
  for (const h of HAZARD_TYPES) {
    const ht = await prisma.hazardType.upsert({
      where: { code: h.code },
      update: { name: h.name, category: h.category, sortOrder: h.sortOrder },
      create: h,
    });
    result[h.code] = ht.id;
  }
  return result;
}

async function ensureTemplates(hazardIds: Record<string, string>, createdById: string) {
  const result: Record<string, string> = {};
  for (const t of TEMPLATES) {
    const hazardId = hazardIds[t.code];
    if (!hazardId) continue;
    const existing = await prisma.checklistTemplate.findFirst({
      where: { hazardTypeId: hazardId, active: true, name: t.name },
      include: { items: true },
    });
    if (existing) {
      result[t.code] = existing.id;
      continue;
    }
    const tmpl = await prisma.checklistTemplate.create({
      data: {
        hazardTypeId: hazardId,
        name: t.name,
        version: 1,
        active: true,
        createdById,
        items: { create: t.items },
      },
    });
    result[t.code] = tmpl.id;
  }
  return result;
}

async function ensureItems(templates: Record<string, string>) {
  const result: Record<string, string[]> = {};
  for (const [code, tmplId] of Object.entries(templates)) {
    const items = await prisma.checklistItem.findMany({
      where: { templateId: tmplId },
      orderBy: { sortOrder: 'asc' },
    });
    result[code] = items.map((i) => i.id);
  }
  return result;
}

type UserMap = Record<string, string>;

function makeCasePlan(total: number) {
  // 15 PENDING_REVIEW, 12 PENDING_AUDIT, 10 IN_AUDIT, 13 CLOSED
  const plan: { status: CaseStatus; deadlineOffsetDays: number }[] = [];
  for (let i = 0; i < 15; i++) plan.push({ status: CaseStatus.PENDING_REVIEW, deadlineOffsetDays: pickOffsetForPending() });
  for (let i = 0; i < 12; i++) plan.push({ status: CaseStatus.PENDING_AUDIT, deadlineOffsetDays: pickOffsetForPendingAudit() });
  for (let i = 0; i < 10; i++) plan.push({ status: CaseStatus.IN_AUDIT, deadlineOffsetDays: pickOffsetForInAudit() });
  for (let i = 0; i < 13; i++) plan.push({ status: CaseStatus.CLOSED, deadlineOffsetDays: pickOffsetForClosed() });
  return plan.slice(0, total);
}

function pickOffsetForPending(): number {
  const r = Math.random();
  if (r < 0.15) return -2; // 15% already overdue
  if (r < 0.25) return 1;
  if (r < 0.55) return 3 + Math.floor(Math.random() * 5); // 3-7d
  if (r < 0.85) return 8 + Math.floor(Math.random() * 7); // 8-14d
  return 15 + Math.floor(Math.random() * 15); // 15-30d
}
function pickOffsetForPendingAudit(): number {
  const r = Math.random();
  if (r < 0.2) return -1;
  if (r < 0.6) return 1 + Math.floor(Math.random() * 3);
  return 4 + Math.floor(Math.random() * 7);
}
function pickOffsetForInAudit(): number {
  const r = Math.random();
  if (r < 0.3) return -1;
  if (r < 0.7) return 1 + Math.floor(Math.random() * 2);
  return 3 + Math.floor(Math.random() * 4);
}
function pickOffsetForClosed(): number {
  // closed cases: deadline in the past (or recent)
  return -1 * (1 + Math.floor(Math.random() * 14));
}

async function createCase(args: {
  seq: number;
  hazardCode: string;
  hazardId: string;
  enterpriseId: string;
  registeredById: string;
  reviewerId: string;
  auditorId: string;
  templateId: string;
  templateItems: string[];
  status: CaseStatus;
  severity: CaseSeverity;
  deadlineOffsetDays: number;
}) {
  const {
    seq,
    hazardCode,
    hazardId,
    enterpriseId,
    registeredById,
    reviewerId,
    auditorId,
    templateId,
    templateItems,
    status,
    severity,
    deadlineOffsetDays,
  } = args;
  const code = nextCaseCode(seq);
  const description = pick(DESCRIPTIONS[hazardCode] ?? ['安全隐患']);
  const source = pick(SOURCES);
  const deadline = new Date(NOW.getTime() + deadlineOffsetDays * DAY_MS);
  const registeredAt = new Date(NOW.getTime() - Math.floor(Math.random() * 10) * DAY_MS);

  const caseRow = await prisma.case.create({
    data: {
      code,
      enterpriseId,
      hazardTypeId: hazardId,
      severity,
      source,
      description: `${description}（${source}）`,
      address: ENTERPRISES.find((e) => e.name)?.address ?? '示范市',
      deadline,
      status,
      registeredById,
      registeredAt,
    },
  });

  // Build a review for every case
  if (status === CaseStatus.PENDING_REVIEW) {
    await prisma.review.create({
      data: {
        caseId: caseRow.id,
        reviewerId,
        templateId,
        status: ReviewStatus.IN_PROGRESS,
        startedAt: registeredAt,
        lastActiveAt: registeredAt,
      },
    });
  } else {
    // SUBMITTED review (with item results) for non-pending
    const submittedAt = new Date(deadline.getTime() - 2 * DAY_MS);
    const startedAt = new Date(submittedAt.getTime() - 3 * DAY_MS);
    const review = await prisma.review.create({
      data: {
        caseId: caseRow.id,
        reviewerId,
        templateId,
        status: ReviewStatus.SUBMITTED,
        startedAt,
        submittedAt,
        lastActiveAt: submittedAt,
        conclusion: pick(CONCLUSIONS),
        summary: `${description}复核完成，详见各项结果。`,
        score: 60 + Math.floor(Math.random() * 41), // 60-100
      },
    });

    // Per-item results: mostly PASS, some FAIL, occasional NA
    for (const itemId of templateItems) {
      const r = Math.random();
      const result = r < 0.85 ? ItemResult.PASS : r < 0.95 ? ItemResult.FAIL : ItemResult.NA;
      await prisma.reviewItemResult.create({
        data: {
          reviewId: review.id,
          itemId,
          result,
          note: result === ItemResult.FAIL ? '现场复核未达标，需整改' : null,
        },
      });
    }

    if (status === CaseStatus.IN_AUDIT) {
      await prisma.case.update({
        where: { id: caseRow.id },
        data: { lockedById: auditorId, lockedAt: submittedAt },
      });
    } else if (status === CaseStatus.CLOSED) {
      const signedAt = new Date(submittedAt.getTime() + 1 * DAY_MS);
      const closedAt = signedAt;
      await prisma.case.update({
        where: { id: caseRow.id },
        data: {
          closedAt,
          lockedById: auditorId,
          lockedAt: signedAt,
        },
      });
      await prisma.auditSignature.create({
        data: {
          caseId: caseRow.id,
          auditorId,
          decision: AuditDecision.PASS,
          comment: '复核结论符合要求，同意销案。',
          signatureUrl: `seed/signatures/${code}.png`,
          signedAt,
        },
      });
    }
  }

  // Audit log: registration
  await prisma.auditLog.create({
    data: {
      userId: registeredById,
      action: 'case:register',
      targetType: 'Case',
      targetId: caseRow.id,
      payload: { source, severity },
    },
  });

  return caseRow;
}

async function main() {
  const hashed = await bcrypt.hash(PASSWORD, 10);
  const users = await ensureUsers(hashed);
  const enterprises = await ensureEnterprises();
  const hazardIds = await ensureHazardTypes();
  const adminId = users['admin@example.com'];
  const templates = await ensureTemplates(hazardIds, adminId);
  const items = await ensureItems(templates);

  // Idempotency: skip if any cases for today's prefix exist
  const existing = await prisma.case.findFirst({
    where: { code: { startsWith: TODAY_PREFIX } },
  });
  if (existing) {
    console.log(`Seed: cases for ${TODAY_PREFIX} already exist, skipping 50-case batch.`);
    console.log('Counts:', {
      users: await prisma.user.count(),
      enterprises: await prisma.enterprise.count(),
      hazardTypes: await prisma.hazardType.count(),
      templates: await prisma.checklistTemplate.count(),
      cases: await prisma.case.count(),
    });
    return;
  }

  const inspectors = USERS.filter((u) => u.role === UserRole.INSPECTOR).map((u) => users[u.email]);
  const chiefs = USERS.filter((u) => u.role === UserRole.CHIEF).map((u) => users[u.email]);
  const enterpriseIds = Object.keys(enterprises);
  const hazardCodes = HAZARD_TYPES.map((h) => h.code);

  const plan = makeCasePlan(50);
  const seqStart = 1;
  for (let i = 0; i < plan.length; i++) {
    const p = plan[i];
    const code = hazardCodes[i % hazardCodes.length];
    const hazardId = hazardIds[code];
    const enterpriseId = enterpriseIds[i % enterpriseIds.length];
    const inspectorId = inspectors[i % inspectors.length];
    const chiefId = chiefs[i % chiefs.length];
    await createCase({
      seq: seqStart + i,
      hazardCode: code,
      hazardId,
      enterpriseId,
      registeredById: inspectorId,
      reviewerId: inspectorId,
      auditorId: chiefId,
      templateId: templates[code],
      templateItems: items[code],
      status: p.status,
      severity: pickWeighted(SEVERITIES, SEVERITY_WEIGHTS),
      deadlineOffsetDays: p.deadlineOffsetDays,
    });
  }

  // Notifications: deadline-soon for PENDING_REVIEW / PENDING_AUDIT with deadline < 3d
  const urgent = await prisma.case.findMany({
    where: {
      code: { startsWith: TODAY_PREFIX },
      status: { in: [CaseStatus.PENDING_REVIEW, CaseStatus.PENDING_AUDIT] },
      deadline: { lt: new Date(NOW.getTime() + 3 * DAY_MS) },
    },
    take: 10,
  });
  for (const c of urgent) {
    await prisma.notification.create({
      data: {
        userId: c.registeredById,
        type: NotificationType.DEADLINE_SOON,
        refType: 'Case',
        refId: c.id,
        title: `案件 ${c.code} 即将到期`,
        body: `截止 ${c.deadline.toISOString().slice(0, 10)}，请尽快处理。`,
      },
    });
  }
  // Overdue: cases with deadline in past
  const overdue = await prisma.case.findMany({
    where: {
      code: { startsWith: TODAY_PREFIX },
      status: { not: CaseStatus.CLOSED },
      deadline: { lt: NOW },
    },
    take: 5,
  });
  for (const c of overdue) {
    await prisma.notification.create({
      data: {
        userId: c.registeredById,
        type: NotificationType.DEADLINE_OVERDUE,
        refType: 'Case',
        refId: c.id,
        title: `案件 ${c.code} 已逾期`,
        body: '请立即处理。',
      },
    });
  }
  // Audit-pending broadcast to chiefs (for SUBMITTED cases)
  const submitted = await prisma.case.findMany({
    where: { code: { startsWith: TODAY_PREFIX }, status: CaseStatus.PENDING_AUDIT },
    take: 3,
  });
  for (const c of submitted) {
    for (const chiefId of chiefs) {
      await prisma.notification.create({
        data: {
          userId: chiefId,
          type: NotificationType.AUDIT_PENDING,
          refType: 'Case',
          refId: c.id,
          title: `新案件待审核：${c.code}`,
          body: '请尽快领取审核。',
        },
      });
    }
  }

  const counts = {
    users: await prisma.user.count(),
    enterprises: await prisma.enterprise.count(),
    hazardTypes: await prisma.hazardType.count(),
    templates: await prisma.checklistTemplate.count(),
    cases: await prisma.case.count(),
    reviews: await prisma.review.count(),
    reviewItemResults: await prisma.reviewItemResult.count(),
    auditSignatures: await prisma.auditSignature.count(),
    notifications: await prisma.notification.count(),
    auditLogs: await prisma.auditLog.count(),
  };
  console.log('Seed complete:', counts);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
