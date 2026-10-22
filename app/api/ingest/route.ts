import { NextResponse } from 'next/server';
import { isSource } from '@/lib/sources';
import { toCar } from '@/lib/classify';
import { store, hasDatabase } from '@/lib/db';
import { checkIngestKey } from '@/lib/ingestAuth';
import { emailNewCars } from '@/lib/notify';

export const dynamic = 'force-dynamic';

// Scanners POST here:
//   Authorization: Bearer <INGEST_KEY>
//   { "source": "facebook", "listings": [ { id, url, title, price, mileage, vin, mmrBase, mmrGrade, ... } ] }
// Kept only when it is a car (not a bike / RV / container…) with a price. Sellers with DEALER_CARS (3)+ cars,
// dealership wording, or on the dealer list → Dealer cars. Checked individuals → Deals when MMR - price >= MIN_PROFIT
// (default 1000), else Individual with their profit or loss. MMR comes from the VIN or, without one, from the title.
export async function POST(req: Request) {
  const bad = checkIngestKey(req);
  if (bad) return bad;

  let body: { source?: unknown; listings?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: 'Bad JSON.' }, { status: 400 }); }
  if (!isSource(body.source)) return NextResponse.json({ ok: false, error: 'Unknown source.' }, { status: 400 });
  if (!Array.isArray(body.listings)) return NextResponse.json({ ok: false, error: 'listings must be an array.' }, { status: 400 });
  if (body.listings.length > 500) return NextResponse.json({ ok: false, error: 'Max 500 listings per request.' }, { status: 413 });

  const source = body.source;
  const now = Date.now();
  const keep = [];
  const drop: string[] = [];
  const dealerIds = new Set((await store.dealers(source)).map((d) => d.id));
  for (const raw of body.listings) {
    if (!raw || typeof raw !== 'object') continue;
    const car = toCar(source, raw as Record<string, unknown>, now);
    if (car) {
      if (car.sellerId && dealerIds.has(car.sellerId)) car.kind = 'dealer';
      keep.push(car);
    } else if (typeof (raw as { id?: unknown }).id === 'string') drop.push((raw as { id: string }).id);
  }

  const res = await store.upsert(source, keep, drop);
  // Link used in emails: SITE_URL if set, else Vercel's production domain, else this request's host.
  const host = process.env.SITE_URL?.replace(/\/+$/, '')
    || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : new URL(req.url).origin);
  const site = `${host}/?source=${source}`;
  let email: string | null = null;
  try { email = await emailNewCars(source, res.created, site); } catch (e) { email = 'Email failed: ' + (e as Error).message; }

  return NextResponse.json({
    ok: true,
    database: hasDatabase ? 'redis' : 'memory (not saved — connect Upstash Redis)',
    received: body.listings.length,
    stored: keep.length,
    new: res.created.length,
    newDeals: res.created.filter((c) => c.kind === 'deal').length,
    newNoVin: res.created.filter((c) => c.kind === 'novin').length,
    newIndividual: res.created.filter((c) => c.kind === 'deal' || c.kind === 'individual').length,
    newDealer: res.created.filter((c) => c.kind === 'dealer').length,
    skipped: drop.length,
    email,
  });
}
