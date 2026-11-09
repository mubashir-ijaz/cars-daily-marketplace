import { NextResponse } from 'next/server';
import { isSource } from '@/lib/sources';
import { checkIngestKey } from '@/lib/ingestAuth';
import { saveStatus, cleanStatus } from '@/lib/status';

export const dynamic = 'force-dynamic';

// The scanner reports its state here (running or not, places, filters, skipped dealers).
//   POST /api/status   Authorization: Bearer <INGEST_KEY>   { source, status: {...} }
export async function POST(req: Request) {
  const bad = checkIngestKey(req);
  if (bad) return bad;
  let body: { source?: unknown; status?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Bad JSON.' }, { status: 400 }); }
  if (!isSource(body.source)) return NextResponse.json({ ok: false, error: 'Unknown source.' }, { status: 400 });
  await saveStatus(body.source, cleanStatus(body.status));
  return NextResponse.json({ ok: true });
}
