import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.users.findFirst({ where: { username: 'admin' } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log('admin user already exists, skipping seed');
    return;
  }
  const password_hash = bcrypt.hashSync('admin123', 12);
  await prisma.users.create({
    data: {
      id: randomUUID(),
      username: 'admin',
      password_hash,
      role: 'admin',
      is_active: true,
    },
  });
  // eslint-disable-next-line no-console
  console.log('admin user created: admin / admin123');
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error('seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
