import type { Car, Kind } from './types';

export const DAY_MS = 86_400_000;
/** Cars are kept for 48 h after they were first found, then deleted. */
export const KEEP_MS = 2 * DAY_MS;

export const minProfit = () => {
  const raw = process.env.MIN_PROFIT;
  const n = Number(raw);
  return raw && Number.isFinite(n) ? n : 1000;
};

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(/[$,\s]/g, '')) : Number(v);
  return v == null || v === '' || !Number.isFinite(n) ? null : Math.round(n);
};
const str = (v: unknown, max = 300): string | null =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
const httpsUrl = (v: unknown): string | null => {
  const s = str(v, 2000);
  if (!s) return null;
  try { return new URL(s).protocol === 'https:' ? s : null; } catch { return null; }
};

// RVs, semis, equipment, bikes, boats, containers… — never shown.
const NOT_CAR = /\b(kubota|bobcat|john deere|caterpillar|excavator|skid steer|tractor|forklift|forr?est river|wildwood|keystone|jayco|travel trailer|toy hauler|camper|motorhome|rv|peterbilt|kenworth|freightliner|volvo vnl|volvo [678]\d0|international (lt|prostar|lonestar|durastar|\d{4})|semi ?truck|container|conex|boat|pontoon|yacht|jet ?ski|harley|motorcycle|dirt ?bike|atv|utv|can-?\s*am|polaris|golf ?cart|trailer(?!\s+hitch))\b/i;
export const looksLikeCar = (title: string | null | undefined) =>
  !!title && /^(19[3-9]\d|20[0-3]\d)\s+[a-z]/i.test(title.trim()) && !NOT_CAR.test(title);

/**
 * A no-VIN car is only shown when Manheim knew it (MMR by name) or the scanner explained why it has no MMR
 * (older scanners sent every no-VIN listing, including RVs and equipment).
 */
export const showable = (c: Car) => looksLikeCar(c.title) && (c.kind === 'deal' || c.mmr != null || !!c.mmrNote);

/** Same car listed twice (relisted, or found from two locations). */
export const dupKey = (c: Car) => c.vin ? `vin:${c.vin}`
  : `t:${(c.title ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')}|${c.price ?? ''}|${(c.sellerName || c.location || '').toLowerCase()}`;

/** Keeps the first car of each dupKey (lists are newest first) and drops non-cars. */
export function cleanList(cars: Car[]): Car[] {
  const seen = new Set<string>();
  return cars.filter((c) => {
    if (!showable(c)) return false;
    const k = dupKey(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Turns a raw listing from a scanner into a stored Car, or null when it
 * doesn't belong on the dashboard (has a VIN but the spread is under MIN_PROFIT).
 */
export function toCar(source: string, raw: Record<string, unknown>, now = Date.now()): Car | null {
  const id = str(raw.id, 100);
  const url = httpsUrl(raw.url);
  if (!id || !url) return null;
  // Individual sellers only.
  if (raw.dealer === true || raw.status === 'dealer') return null;
  const firstSeen = num(raw.firstSeen) ?? now;
  if (now - firstSeen > KEEP_MS) return null;

  const vinRaw = str(raw.vin, 30)?.toUpperCase() ?? null;
  const vin = vinRaw && /^[A-HJ-NPR-Z0-9]{17}$/.test(vinRaw) ? vinRaw : null;
  const price = num(raw.price);
  const mmrBase = num(raw.mmrBase);
  const mmrGrade = num(raw.mmrGrade);
  const mmr = mmrGrade ?? mmrBase;
  const profit = mmr != null && price != null ? mmr - price : null;

  const mmrBy = vin ? 'vin' : mmr != null ? 'name' : null;
  // Deals priced by name (no VIN) go to Deals too; other no-VIN cars stay in No VIN, with their MMR or a note.
  let kind: Kind;
  if (profit != null && profit >= minProfit()) kind = 'deal';
  else if (!vin) kind = 'novin';
  else return null;
  if (!looksLikeCar(str(raw.title, 200)) && !vin) return null;
  if (!vin && mmr == null && !str(raw.mmrNote, 300)) return null;

  return {
    source, id, kind, url,
    title: str(raw.title, 200),
    price,
    mileage: num(raw.mileage),
    vin,
    year: num(raw.year),
    location: str(raw.location, 120),
    search: str(raw.search, 80),
    img: httpsUrl(raw.img),
    mmrName: str(raw.mmrName, 200),
    mmrBase, mmrGrade, mmr, profit, mmrBy,
    mmrNote: str(raw.mmrNote, 300),
    description: str(raw.description, 1600),
    phone: str(raw.phone, 80),
    titleStatus: str(raw.titleStatus, 60),
    owners: num(raw.owners),
    carfax: str(raw.carfax, 40),
    accidents: str(raw.accidents, 40),
    issues: str(raw.issues, 200),
    transmission: str(raw.transmission, 20),
    exteriorColor: str(raw.exteriorColor, 30),
    interiorColor: str(raw.interiorColor, 30),
    fuel: str(raw.fuel, 30),
    sellerName: str(raw.sellerName, 60),
    sellerJoined: num(raw.sellerJoined),
    sellerCars: num(raw.sellerCars),
    sellerListings: num(raw.sellerListings),
    listed: str(raw.listed, 40),
    firstSeen,
    updatedAt: now,
  };
}
