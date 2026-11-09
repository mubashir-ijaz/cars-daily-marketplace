import { Redis } from '@upstash/redis';

/** What the scanner reports about itself: is it running, which places, which filters, which dealers it skipped. */
export type BotStatus = {
  at: number;
  running: boolean;
  current: string;
  lastScan: number;
  round: { done: number; total: number };
  byState: { name: string; done: number; total: number }[];
  areas: { name: string; done: boolean }[];
  filters: [string, string][];
  today: { checked: number; good: number; skipped: number; reasons: [string, number][] };
  skipped: { t: number; title: string; price: number | null; location: string; url: string; why: string }[];
};

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const KEY = (source: string) => `status:${source}`;
const redis = url && token ? new Redis({ url, token, automaticDeserialization: false }) : null;
const g = globalThis as unknown as { __botStatus?: Record<string, string> };

export async function saveStatus(source: string, s: BotStatus) {
  const json = JSON.stringify(s);
  if (redis) await redis.set(KEY(source), json, { ex: 7 * 86400 });
  else (g.__botStatus ??= {})[source] = json;
}

export async function loadStatus(source: string): Promise<BotStatus | null> {
  try {
    const raw = redis ? ((await redis.get(KEY(source))) as string | null) : (g.__botStatus ?? {})[source];
    return raw ? (JSON.parse(raw) as BotStatus) : null;
  } catch { return null; }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');
const int = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0);
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);

/** Cleans whatever the scanner sent (size limits, types) into a BotStatus. */
export function cleanStatus(raw: unknown): BotStatus {
  const r = (raw ?? {}) as Record<string, unknown>;
  const round = (r.round ?? {}) as Record<string, unknown>;
  const today = (r.today ?? {}) as Record<string, unknown>;
  return {
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
}
