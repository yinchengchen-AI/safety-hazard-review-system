import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronRight } from 'lucide-react';

export function TodoList({ items }: { items: { id: string; title: string; href: string }[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">待办任务</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无待办</p>
        ) : (
          <ul className="space-y-2">
            {items.map((i) => (
              <li key={i.id} className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <span className="font-mono text-sm">{i.title}</span>
                <Button asChild variant="ghost" size="sm" className="h-8 gap-1 text-gov-blue">
                  <Link href={i.href}>
                    处理 <ChevronRight className="h-4 w-4" />
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
