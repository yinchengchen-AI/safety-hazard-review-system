import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { SyncService } from '@/services/sync';
import { handleError, problem } from '@/lib/api-error';

const ItemSchema = z.object({
  clientId: z.string().uuid(),
  opType: z.string(),
  payload: z.any(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    const { items } = z.object({ items: z.array(ItemSchema).max(50) }).parse(await req.json());
    const results: Array<{ clientId: string; status: string; error?: string }> = [];
    for (const item of items) {
      const q = await SyncService.enqueue(session.user.id, item.clientId, item.opType, item.payload);
      try {
        await SyncService.processOne(q.id);
        results.push({ clientId: item.clientId, status: 'synced' });
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        results.push({ clientId: item.clientId, status: 'failed', error: message });
      }
    }
    return NextResponse.json({ results });
  } catch (e) {
    return handleError(e);
  }
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return problem(401, 'unauthorized', 'Login required');
  try {
    const items = await SyncService.listPending(session.user.id);
    return NextResponse.json({ items });
  } catch (e) {
    return handleError(e);
  }
}
