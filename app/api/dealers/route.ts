import { NextResponse } from 'next/server';
import { isSource } from '@/lib/sources';
import { store } from '@/lib/db';
import { checkIngestKey } from '@/lib/ingestAuth';
import type { Dealer } from '@/lib/types';

export const dynamic = 'force-dynamic';

// The scanner's permanent dealer list, kept here so it survives extension updates and reinstalls.
//   GET  /api/dealers?source=facebook                      → { ok, dealers: Dealer[] }
//   POST /api/dealers { source, dealers?: Dealer[], remove?: string[] }
// Both need Authorization: Bearer <INGEST_KEY>.

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : null);

function toDealer(raw: unknown, now: number): Dealer | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = str(r.id, 40);
  if (!id || !/^\d+$/.test(id)) return null;
  return {
    id,
    name: str(r.name, 80),
    cars: int(r.cars),
    titles: Array.isArray(r.titles) ? r.titles.flatMap((t) => (str(t, 80) ? [str(t, 80)!] : [])).slice(0, 10) : [],
    reason: str(r.reason, 120) ?? 'profile',
    location: str(r.location, 80),
    firstSeen: int(r.firstSeen) ?? now,
    lastSeen: int(r.lastSeen) ?? now,
  };
}

export async function GET(req: Request) {
  const bad = checkIngestKey(req);
  if (bad) return bad;
  const source = new URL(req.url).searchParams.get('source') ?? 'facebook';
  if (!isSource(source)) return NextResponse.json({ ok: false, error: 'Unknown source.' }, { status: 400 });
  return NextResponse.json({ ok: true, dealers: await store.dealers(source) });
}

export async function POST(req: Request) {
  const bad = checkIngestKey(req);
  if (bad) return bad;
  let body: { source?: unknown; dealers?: unknown; remove?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Bad JSON.' }, { status: 400 }); }
  if (!isSource(body.source)) return NextResponse.json({ ok: false, error: 'Unknown source.' }, { status: 400 });
  const now = Date.now();
  const add = (Array.isArray(body.dealers) ? body.dealers : []).slice(0, 2000).map((d) => toDealer(d, now)).filter((d): d is Dealer => !!d);
  const remove = (Array.isArray(body.remove) ? body.remove : []).filter((x): x is string => typeof x === 'string' && /^\d+$/.test(x)).slice(0, 2000);
  const saved = await store.saveDealers(body.source, add);
  const removed = await store.removeDealers(body.source, remove);
  return NextResponse.json({ ok: true, saved, removed });
}
