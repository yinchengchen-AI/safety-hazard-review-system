'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

type Review = {
  id: string;
  conclusion?: string | null;
  summary?: string | null;
  items: Array<{ id: string; result: string; note: string | null; item: { content: string } }>;
};

export function AuditForm({
  caseId,
  status,
  lockedByMe,
  review,
}: {
  caseId: string;
  status: string;
  lockedByMe: boolean;
  review: Review | undefined;
}) {
  const router = useRouter();
  const [comment, setComment] = useState('');
  const [signatureUrl, setSignatureUrl] = useState('');
  const [reason, setReason] = useState('');

  async function open() {
    await fetch(`/api/cases/${caseId}/audit`, { method: 'POST' });
    router.refresh();
  }

  async function sign() {
    const res = await fetch(`/api/cases/${caseId}/audit`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signatureUrl: signatureUrl || 'data:image/png;base64,placeholder',
        comment,
      }),
    });
    if (res.ok) {
      router.push(`/cases/${caseId}`);
    } else {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      alert(j.message || '签字失败');
    }
  }

  async function reject() {
    const res = await fetch(`/api/cases/${caseId}/audit?action=reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (res.ok) {
      router.push(`/cases/${caseId}`);
    } else {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      alert(j.message || '驳回失败');
    }
  }

  if (status === 'PENDING_AUDIT') {
    return <Button onClick={open}>领取审核</Button>;
  }
  if (status === 'IN_AUDIT' && !lockedByMe) {
    return <p className="text-sm text-muted-foreground">已被其他科长领取</p>;
  }

  return (
    <div className="space-y-4">
      <section>
        <h3 className="font-medium mb-2">复核结论</h3>
        <p>结论：{review?.conclusion || '-'}</p>
        <p>说明：{review?.summary || '-'}</p>
      </section>
      <section>
        <h3 className="font-medium mb-2">逐项结果</h3>
        {review?.items.map((i) => (
          <div key={i.id} className="text-sm py-1">
            {i.item.content} — <span className="font-mono">{i.result}</span>{' '}
            {i.note && `(${i.note})`}
          </div>
        ))}
      </section>
      <div className="space-y-2 border-t pt-4">
        <Input
          placeholder="签名 URL（生产用 canvas 签名板）"
          value={signatureUrl}
          onChange={(e) => setSignatureUrl(e.target.value)}
        />
        <Textarea
          placeholder="审核意见"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
        <Button onClick={sign} className="mr-2">
          通过 + 签字
        </Button>
        <div className="border-t pt-2 mt-2">
          <Input
            placeholder="驳回理由"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <Button onClick={reject} variant="destructive" className="mt-2" disabled={!reason}>
            驳回
          </Button>
        </div>
      </div>
    </div>
  );
}
