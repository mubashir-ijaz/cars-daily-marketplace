import { NextResponse } from 'next/server';
import { isSource } from '@/lib/sources';
import { checkIngestKey } from '@/lib/ingestAuth';
import { saveStatus, type BotStatus } from '@/lib/status';

export const dynamic = 'force-dynamic';

// The scanner reports its state here (running or not, places, filters, skipped dealers).
//   POST /api/status   Authorization: Bearer <INGEST_KEY>   { source, status: {...} }
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0);
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);

export async function POST(req: Request) {
  const bad = checkIngestKey(req);
  if (bad) return bad;
  let body: { source?: unknown; status?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Bad JSON.' }, { status: 400 }); }
  if (!isSource(body.source)) return NextResponse.json({ ok: false, error: 'Unknown source.' }, { status: 400 });
  const r = (body.status ?? {}) as Record<string, unknown>;
  const round = (r.round ?? {}) as Record<string, unknown>;
  const today = (r.today ?? {}) as Record<string, unknown>;
  const status: BotStatus = {
    at: Date.now(),
    running: r.running === true,
    current: str(r.current, 120),
    lastScan: int(r.lastScan),
    round: { done: int(round.done), total: int(round.total) },
    byState: arr(r.byState, 60).map((x) => { const o = x as Record<string, unknown>; return { name: str(o.name, 40), done: int(o.done), total: int(o.total) }; }),
    areas: arr(r.areas, 60).map((a) => ({ name: str((a as { name?: unknown })?.name, 80), done: (a as { done?: unknown })?.done === true })),
    filters: arr(r.filters, 30).map((f) => [str((f as unknown[])?.[0], 40), str((f as unknown[])?.[1], 200)] as [string, string]),
    today: {
      checked: int(today.checked), good: int(today.good), skipped: int(today.skipped),
      reasons: arr(today.reasons, 12).map((x) => [str((x as unknown[])?.[0], 120), int((x as unknown[])?.[1])] as [string, number]),
    },
    skipped: arr(r.skipped, 60).map((d) => {
      const o = d as Record<string, unknown>;
      const u = str(o.url, 500);
      return { t: int(o.t), title: str(o.title, 160), price: typeof o.price === 'number' ? o.price : null, location: str(o.location, 100), url: /^https:\/\//.test(u) ? u : '', why: str(o.why, 160) };
    }),
  };
  await saveStatus(body.source, status);
  return NextResponse.json({ ok: true });
}
