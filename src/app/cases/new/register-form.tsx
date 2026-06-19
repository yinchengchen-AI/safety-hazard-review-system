'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

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
    <form onSubmit={submit} className="space-y-4 max-w-3xl">
      <input type="hidden" name="enterpriseId" value={enterpriseId} />
      <input type="hidden" name="hazardTypeId" value={hazardTypeId} />
      <input type="hidden" name="severity" value={severity} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gov-blue">企业信息</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>选择企业 *</Label>
            <Select value={enterpriseId} onValueChange={setEnterpriseId} required>
              <SelectTrigger>
                <SelectValue placeholder="请选择企业" />
              </SelectTrigger>
              <SelectContent>
                {enterprises.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>隐患类型 *</Label>
            <Select value={hazardTypeId} onValueChange={setHazardTypeId} required>
              <SelectTrigger>
                <SelectValue placeholder="请选择隐患类型" />
              </SelectTrigger>
              <SelectContent>
                {hazardTypes.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-gov-blue">隐患信息</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label>严重程度 *</Label>
            <Select value={severity} onValueChange={setSeverity} required>
              <SelectTrigger>
                <SelectValue placeholder="请选择" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MAJOR">重大</SelectItem>
                <SelectItem value="MODERATE">较大</SelectItem>
                <SelectItem value="MINOR">一般</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source">来源 *</Label>
            <Input id="source" name="source" placeholder="监管检查/举报/上级交办" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">整改期限 *</Label>
            <Input id="deadline" name="deadline" type="date" required />
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="address">地址</Label>
            <Input id="address" name="address" placeholder="请输入地址" />
          </div>

          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="description">隐患描述 *</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="请详细描述隐患情况"
              required
              className="min-h-[100px]"
            />
          </div>
        </CardContent>
      </Card>

      {err && <p className="text-sm text-destructive">{err}</p>}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          取消
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 提交中...
            </>
          ) : (
            '登记案件'
          )}
        </Button>
      </div>
    </form>
  );
}
