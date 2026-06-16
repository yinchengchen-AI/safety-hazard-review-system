'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Enterprise = { id: string; name: string };
type HazardType = { id: string; name: string };

export function RegisterForm({
  enterprises,
  hazardTypes,
}: {
  enterprises: Enterprise[];
  hazardTypes: HazardType[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [enterpriseId, setEnterpriseId] = useState('');
  const [hazardTypeId, setHazardTypeId] = useState('');
  const [severity, setSeverity] = useState('MAJOR');

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    const fd = new FormData(e.currentTarget);
    const body = Object.fromEntries(fd.entries());
    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setLoading(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      setErr(j.message || '提交失败');
      return;
    }
    const c = await res.json();
    router.push(`/cases/${c.id}`);
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <input type="hidden" name="enterpriseId" value={enterpriseId} />
      <input type="hidden" name="hazardTypeId" value={hazardTypeId} />
      <input type="hidden" name="severity" value={severity} />

      <Select value={enterpriseId} onValueChange={setEnterpriseId} required>
        <SelectTrigger>
          <SelectValue placeholder="选择企业" />
        </SelectTrigger>
        <SelectContent>
          {enterprises.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={hazardTypeId} onValueChange={setHazardTypeId} required>
        <SelectTrigger>
          <SelectValue placeholder="隐患类型" />
        </SelectTrigger>
        <SelectContent>
          {hazardTypes.map((h) => (
            <SelectItem key={h.id} value={h.id}>
              {h.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={severity} onValueChange={setSeverity} required>
        <SelectTrigger>
          <SelectValue placeholder="严重程度" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="MAJOR">重大</SelectItem>
          <SelectItem value="MODERATE">较大</SelectItem>
          <SelectItem value="MINOR">一般</SelectItem>
        </SelectContent>
      </Select>

      <Input name="source" placeholder="来源" required />
      <Input name="address" placeholder="地址" />
      <Textarea name="description" placeholder="隐患描述" required />
      <Input name="deadline" type="date" required />
      {err && <p className="text-sm text-red-500">{err}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? '提交中...' : '登记'}
      </Button>
    </form>
  );
}
