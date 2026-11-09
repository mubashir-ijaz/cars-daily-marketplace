import type { Car } from './types';
import { toCar } from './classify';
import { cleanStatus, type BotStatus } from './status';

// The scanner saves the good cars and its status into a Google Sheet (through an Apps Script). This reads them back.
// The sheet only needs "Anyone with the link can view". Change SHEET_ID in Vercel only if you use another sheet.
const SHEET_ID = process.env.SHEET_ID || '1vd0emAhI9Vci8jfu3Y-BcwWPJhirTSGvSCVWDH6C98Y';

type Table = { cols: { label: string }[]; rows: { c: ({ v: unknown } | null)[] }[] };

async function gviz(sheet: string, range?: string): Promise<Table | null> {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=1&sheet=${encodeURIComponent(sheet)}${range ? `&range=${range}` : ''}`;
  try {
    const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    const m = /setResponse\(([\s\S]*)\);?\s*$/.exec(await r.text());
    if (!m) return null;
    const j = JSON.parse(m[1]);
    return j.status === 'ok' ? (j.table as Table) : null;
  } catch { return null; }
}

/** Cars saved in the sheet's "Cars" tab, run through the same rules as every other car (states, price, bad ads, MMR). */
export async function sheetCars(source = 'facebook'): Promise<Car[]> {
  const t = await gviz('Cars');
  if (!t) return [];
  const names = t.cols.map((c) => c.label);
  const now = Date.now();
  const out: Car[] = [];
  for (const row of t.rows) {
    const o: Record<string, unknown> = {};
    names.forEach((n, i) => { o[n] = row.c[i]?.v ?? null; });
    const car = toCar(source, {
      id: o.id, url: o.url, title: o.title, price: o.price, mileage: o.miles, year: o.year, location: o.location,
      img: o.image, mmrBase: o.mmr, mmrNote: o.mmr_basis, description: o.description, sellerCars: o.seller_cars, firstSeen: o.found,
    }, now);
    if (car) out.push(car);
  }
  return out;
}

/** The bot status the extension writes into the "Status" tab (one JSON cell). */
export async function sheetStatus(): Promise<BotStatus | null> {
  const t = await gviz('Status', 'A1:A1');
  const raw = t?.rows[0]?.c[0]?.v ?? t?.cols[0]?.label; // with headers=1 a single cell may be read as the header
  if (typeof raw !== 'string' || !raw.startsWith('{')) return null;
  try {
    const j = JSON.parse(raw);
    return { ...cleanStatus(j), at: typeof j.at === 'number' ? j.at : 0 };
  } catch { return null; }
}
