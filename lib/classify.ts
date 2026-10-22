import type { Car, Kind } from './types';

export const DAY_MS = 86_400_000;
/** Cars are kept for 48 h after they were first found, then deleted. */
export const KEEP_MS = 2 * DAY_MS;

/** The "No VIN" tab (cars without an MMR) is off unless SHOW_NO_VIN=true. Without it only $MIN_PROFIT+ deals are shown. */
export const showNoVin = () => process.env.SHOW_NO_VIN === 'true';

/** A seller with this many cars on their Marketplace profile is a dealer (default 3). */
export const dealerCars = () => Number(process.env.DEALER_CARS) || 3;
/** Individuals only: the scanner checked the seller's profile and found fewer than dealerCars() cars. */
const individual = (sellerCars: number | null | undefined) => sellerCars != null && sellerCars < dealerCars();

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
const NOT_CAR = /\b(ship|motor ?bike|bike|kawasaki|ducati|ktm|yamaha|suzuki (gsx\w*|hayabusa|boulevard\w*|burgman)|honda (grom|shadow|goldwing|rebel|cbr|crf|trx)|scooter|moped|kubota|bobcat|john deere|caterpillar|excavator|skid steer|tractor|forklift|forr?est river|wildwood|keystone|jayco|travel trailer|toy hauler|camper|motorhome|rv|peterbilt|kenworth|freightliner|volvo vnl|volvo [678]\d0|international (lt|prostar|lonestar|durastar|\d{4})|semi ?truck|container|conex|boat|pontoon|yacht|jet ?ski|harley|motorcycle|dirt ?bike|atv|utv|can-?\s*am|polaris|golf ?cart|trailer(?!\s+hitch))\b/i;
export const looksLikeCar = (title: string | null | undefined) =>
  !!title && /^(19[3-9]\d|20[0-3]\d)\s+[a-z]/i.test(title.trim()) && !NOT_CAR.test(title);

/** Every stored kind (for pruning). */
export const KINDS: Kind[] = ['deal', 'individual', 'dealer', 'novin'];
/** Stored kinds each tab reads: Individual = every individual-seller car, deals included; Dealer cars also picks up
 * cars whose seller was added to the dealer list after the car was stored. */
export const tabKinds = (tab: Kind): Kind[] =>
  tab === 'individual' ? ['deal', 'individual'] : tab === 'dealer' ? ['dealer', 'deal', 'individual'] : [tab];

/**
 * Whether a car belongs on a tab. A no-VIN car is only shown when Manheim knew it (MMR by name) or the scanner
 * explained why it has no MMR (older scanners sent every no-VIN listing, including RVs and equipment).
 */
export function showable(c: Car, tab: Kind = c.kind) {
  if (!looksLikeCar(c.title)) return false;
  if (tab === 'dealer') return true;
  if (!individual(c.sellerCars) || c.kind === 'dealer') return false;
  if (tab === 'individual') return c.mmr != null || !!c.mmrNote;
  if (tab === 'deal') return c.mmr != null && c.profit != null && c.profit >= minProfit();
  return showNoVin() && (c.mmr != null || !!c.mmrNote);
}

/** Same car listed twice (relisted, or found from two locations). */
export const dupKey = (c: Car) => c.vin ? `vin:${c.vin}`
  : `t:${(c.title ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')}|${c.price ?? ''}|${(c.sellerName || c.location || '').toLowerCase()}`;

/** Keeps the first car of each dupKey (lists are newest first) and drops non-cars. */
export function cleanList(cars: Car[], tab?: Kind): Car[] {
  const seen = new Set<string>();
  return cars.filter((c) => {
    if (!showable(c, tab)) return false;
    const k = dupKey(c);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * Turns a raw listing from a scanner into a stored Car, or null when it doesn't belong on the dashboard
 * (not a car, seller not checked, or no price / MMR to judge it by).
 */
export function toCar(source: string, raw: Record<string, unknown>, now = Date.now()): Car | null {
  const id = str(raw.id, 100);
  const url = httpsUrl(raw.url);
  if (!id || !url) return null;
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
  // Cars only. Dealers go to Dealer cars; individuals (seller checked, < DEALER_CARS cars) go to Deals when
  // MMR − price >= MIN_PROFIT (MMR by VIN or by name), else to Individual with their profit or loss.
  if (!looksLikeCar(str(raw.title, 200)) || price == null) return null;
  const sellerCars = num(raw.sellerCars);
  let kind: Kind;
  if (raw.dealer === true || raw.status === 'dealer' || (sellerCars != null && !individual(sellerCars))) kind = 'dealer';
  else if (!individual(sellerCars)) return null; // seller not checked yet
  else if (profit != null && profit >= minProfit()) kind = 'deal';
  else if (mmr != null || str(raw.mmrNote, 300)) kind = 'individual';
  else return null;

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
    sellerId: str(raw.sellerId, 40),
    sellerJoined: num(raw.sellerJoined),
    sellerCars: num(raw.sellerCars),
    sellerListings: num(raw.sellerListings),
    dealerReason: kind === 'dealer' ? str(raw.dealerReason, 200) : null,
    listed: str(raw.listed, 40),
    firstSeen,
    updatedAt: now,
  };
}
