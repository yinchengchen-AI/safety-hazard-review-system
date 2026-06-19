import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const hashed = await bcrypt.hash('password123', 10);
  const inspector = await prisma.user.upsert({
    where: { email: 'inspector@example.com' },
    update: {},
    create: {
      name: '监管员甲',
      email: 'inspector@example.com',
      passwordHash: hashed,
      role: UserRole.INSPECTOR,
    },
  });
  await prisma.user.upsert({
    where: { email: 'chief@example.com' },
    update: {},
    create: {
      name: '科长甲',
      email: 'chief@example.com',
      passwordHash: hashed,
      role: UserRole.CHIEF,
    },
  });
  await prisma.user.upsert({
    where: { email: 'director@example.com' },
    update: {},
    create: {
      name: '局长甲',
      email: 'director@example.com',
      passwordHash: hashed,
      role: UserRole.DIRECTOR,
    },
  });
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      name: '系统管理员',
      email: 'admin@example.com',
      passwordHash: hashed,
      role: UserRole.ADMIN,
    },
  });

  const enterprise = await prisma.enterprise.upsert({
    where: { unifiedSocialCreditId: '91110000XXXXXX0001' },
    update: {},
    create: {
      name: '示范化工有限公司',
      unifiedSocialCreditId: '91110000XXXXXX0001',
      industry: '化工',
      address: '示范市示范区 1 号',
      contactName: '张总',
      contactPhone: '13800000001',
    },
  });

  const fireHazard = await prisma.hazardType.upsert({
    where: { code: 'FIRE' },
    update: {},
    create: { code: 'FIRE', name: '消防安全', category: '消防', sortOrder: 1 },
  });
  await prisma.hazardType.upsert({
    where: { code: 'SPECIAL_EQUIPMENT' },
    update: {},
    create: { code: 'SPECIAL_EQUIPMENT', name: '特种设备', category: '特种设备', sortOrder: 2 },
  });
  await prisma.hazardType.upsert({
    where: { code: 'HAZMAT' },
    update: {},
    create: { code: 'HAZMAT', name: '危化品', category: '危化品', sortOrder: 3 },
  });
  await prisma.hazardType.upsert({
    where: { code: 'ELECTRICAL' },
    update: {},
    create: { code: 'ELECTRICAL', name: '电气安全', category: '电气', sortOrder: 4 },
  });

  const fireTemplate = await prisma.checklistTemplate.create({
    data: {
      hazardTypeId: fireHazard.id,
      name: '消防安全复核清单 v1',
      version: 1,
      active: true,
      createdById: admin.id,
      items: {
        create: [
          { content: '灭火器是否在有效期内', sortOrder: 1, required: true, evidenceRequired: true },
          { content: '疏散通道是否畅通', sortOrder: 2, required: true, evidenceRequired: true },
          { content: '应急照明是否正常', sortOrder: 3, required: true, evidenceRequired: false },
          { content: '消防栓是否有水', sortOrder: 4, required: true, evidenceRequired: true },
          { content: '员工消防培训记录', sortOrder: 5, required: false, evidenceRequired: false },
        ],
      },
    },
  });

  console.log('Seed complete:', {
    inspector: inspector.email,
    enterprise: enterprise.name,
    fireTemplate: fireTemplate.id,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
