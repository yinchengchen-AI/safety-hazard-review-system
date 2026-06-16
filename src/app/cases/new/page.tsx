import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { RegisterForm } from './register-form';

export default async function NewCasePage() {
  await auth();
  const [enterprises, hazardTypes] = await Promise.all([
    prisma.enterprise.findMany({ orderBy: { name: 'asc' } }),
    prisma.hazardType.findMany({ where: { active: true }, orderBy: { sortOrder: 'asc' } }),
  ]);
  return (
    <main className="p-6 max-w-2xl">
      <h1 className="text-2xl font-semibold mb-4">登记案件</h1>
      <RegisterForm enterprises={enterprises} hazardTypes={hazardTypes} />
    </main>
  );
}
