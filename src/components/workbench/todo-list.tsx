import Link from 'next/link';

export function TodoList({ items }: { items: { id: string; title: string; href: string }[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">暂无待办</p>;
  }
  return (
    <ul className="space-y-2">
      {items.map((i) => (
        <li key={i.id} className="flex justify-between items-center py-1">
          <span className="font-mono text-sm">{i.title}</span>
          <Link href={i.href} className="text-blue-600 text-sm">查看 →</Link>
        </li>
      ))}
    </ul>
  );
}
