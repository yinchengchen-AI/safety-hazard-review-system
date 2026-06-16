'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

type Item = { id: string; content: string; required: boolean };
type Template = { id: string; name: string; items: Item[] };
type Review = {
  id: string;
  claimedById?: string | null;
  items: Array<{ itemId: string; result: string; note: string | null }>;
};

export function ReviewForm({
  caseId,
  reviewId,
  template,
  review,
}: {
  caseId: string;
  reviewId: string;
  template: Template;
  review: Review;
}) {
  const router = useRouter();
  const [claimed, setClaimed] = useState(!!review.claimedById);
  const [results, setResults] = useState<Record<string, { result: string; note: string }>>(() => {
    const init: Record<string, { result: string; note: string }> = {};
    for (const it of review.items) init[it.itemId] = { result: it.result, note: it.note || '' };
    return init;
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [conclusion, setConclusion] = useState('');
  const [summary, setSummary] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  async function claim() {
    const res = await fetch(`/api/cases/${caseId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'claim' }),
    });
    if (res.ok) {
      setClaimed(true);
    } else {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      alert(j.message || '认领失败');
    }
  }

  async function saveItem(itemId: string, result: string, note: string) {
    setResults((r) => ({ ...r, [itemId]: { result, note } }));
    await fetch(`/api/cases/${caseId}/review/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewId, itemId, result, note }),
    });
  }

  async function uploadPhoto(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/photos', { method: 'POST', body: fd });
    if (res.ok) {
      const { storageKey } = (await res.json()) as { storageKey: string };
      setPhotos((p) => [...p, storageKey]);
    }
  }

  async function submit() {
    const res = await fetch(`/api/cases/${caseId}/review`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conclusion, summary, photos }),
    });
    if (res.ok) {
      router.push(`/cases/${caseId}`);
    } else {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      alert(j.message || '提交失败');
    }
  }

  if (!claimed) {
    return <Button onClick={claim}>开始复核</Button>;
  }

  return (
    <div className="space-y-6">
      {template.items.map((item) => (
        <div key={item.id} className="border rounded p-3 space-y-2">
          <div className="font-medium">
            {item.content}
            {item.required && <span className="text-red-500">*</span>}
          </div>
          <div className="flex gap-2 text-sm">
            {(['PASS', 'FAIL', 'NA'] as const).map((r) => (
              <label key={r} className="flex items-center gap-1">
                <input
                  type="radio"
                  name={`r-${item.id}`}
                  value={r}
                  checked={results[item.id]?.result === r}
                  onChange={() => saveItem(item.id, r, results[item.id]?.note || '')}
                />
                {r === 'PASS' ? '通过' : r === 'FAIL' ? '不通过' : 'N/A'}
              </label>
            ))}
          </div>
          <Input
            placeholder="备注（可选）"
            defaultValue={results[item.id]?.note}
            onBlur={(e) => saveItem(item.id, results[item.id]?.result || 'NA', e.target.value)}
          />
        </div>
      ))}
      <div>
        <h3 className="font-medium mb-2">照片</h3>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => Array.from(e.target.files || []).forEach(uploadPhoto)}
        />
        <div className="grid grid-cols-4 gap-2 mt-2">
          {photos.map((k) => (
            <img key={k} src={`/api/photos/${k}`} alt="" className="w-full h-24 object-cover rounded" />
          ))}
        </div>
      </div>
      <div>
        <label className="font-medium">总体结论</label>
        <select
          className="block w-full border rounded p-2 mt-1"
          value={conclusion}
          onChange={(e) => setConclusion(e.target.value)}
        >
          <option value="">--</option>
          <option value="PASS">通过</option>
          <option value="FAIL">不通过</option>
          <option value="PARTIAL">部分通过</option>
        </select>
      </div>
      <Textarea placeholder="总体说明" value={summary} onChange={(e) => setSummary(e.target.value)} />
      <Button onClick={submit} disabled={!conclusion || !summary}>
        提交复核
      </Button>
    </div>
  );
}
