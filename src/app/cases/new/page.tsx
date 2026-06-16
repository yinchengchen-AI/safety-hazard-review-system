import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RegisterForm } from './register-form';
import { PageShell } from '@/components/layout/page-shell';

export default async function NewCasePage() {
  await auth();
  const [enterprises, hazardTypes] = await Promise.all([
    prisma.enterprise.findMany({ orderBy: { name: 'asc' } }),
    prisma.hazardType.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  return (
    <PageShell title="登记案件">
      <RegisterForm enterprises={enterprises} hazardTypes={hazardTypes} />
    </PageShell>
  );
}
