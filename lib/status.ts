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
