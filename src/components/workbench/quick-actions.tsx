import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, Plus, BarChart3, Bell } from 'lucide-react';

const actions = [
  { href: '/cases', label: '我的案件', icon: ClipboardList },
  { href: '/cases/new', label: '登记案件', icon: Plus },
  { href: '/stats', label: '查看统计', icon: BarChart3 },
  { href: '/me/notifications', label: '通知中心', icon: Bell },
];

export function QuickActions() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">快捷入口</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.href}
              asChild
              variant="outline"
              className="h-auto flex-col gap-1 py-3"
            >
              <Link href={action.href}>
                <Icon className="h-5 w-5" />
                <span className="text-xs">{action.label}</span>
              </Link>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
