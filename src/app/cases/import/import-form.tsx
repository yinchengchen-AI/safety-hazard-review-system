'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

type Preview = {
  preview: true;
  rows: unknown[];
  errors: { rowNumber: number; field: string; message: string }[];
};

export function ImportForm() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function parseFile() {
    if (!file) return;
    setLoading(true);
    setErr('');
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    setLoading(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      setErr(j.message || '解析失败');
      return;
    }
    setPreview((await res.json()) as Preview);
  }

  async function commit() {
    if (!file) return;
    setLoading(true);
    setErr('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('confirm', 'true');
    const res = await fetch('/api/import', { method: 'POST', body: fd });
    setLoading(false);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      setErr(j.message || '导入失败');
      return;
    }
    router.push('/cases');
  }

  return (
    <div className="space-y-4">
      <input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <div className="flex gap-2">
        <Button onClick={parseFile} disabled={!file || loading}>
          解析
        </Button>
        {preview && (
          <Button onClick={commit} disabled={loading}>
            确认导入 ({preview.rows.length} 行)
          </Button>
        )}
      </div>
      {err && <p className="text-sm text-red-500">{err}</p>}
      {preview && (
        <div className="space-y-2 text-sm">
          <p>
            有效行: {preview.rows.length} | 错误行: {preview.errors.length}
          </p>
          {preview.errors.length > 0 && (
            <ul className="text-red-600 list-disc pl-5">
              {preview.errors.slice(0, 20).map((e, i) => (
                <li key={i}>
                  第 {e.rowNumber} 行 {e.field}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
