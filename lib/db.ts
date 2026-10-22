import { Redis } from '@upstash/redis';
import type { Car, Day, Dealer, Kind } from './types';
import { DAY_MS, KEEP_MS, cleanList } from './classify';

// Storage: Upstash Redis (add it from the Vercel dashboard → Storage /
// Marketplace → Upstash Redis; Vercel sets the env vars automatically).
// Without those env vars an in-memory store is used — fine for local dev only.
//
// Cars live for 48 h from when they were first found: the first 24 h under
// "Today", the next 24 h under "Yesterday", then they are deleted.

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const hasDatabase = !!(url && token);

const MAX_PER_LIST = 3000;
const KINDS: Kind[] = ['deal', 'novin'];
const hashKey = (source: string) => `cars:${source}`;
const listKey = (source: string, kind: Kind) => `list:${source}:${kind}`;
// Every stored id (hidden ones too), scored by firstSeen — used to delete old cars.
const allKey = (source: string) => `all:${source}`;
// Dealers never expire: sellerId -> Dealer JSON.
const dealerKey = (source: string) => `dealers:${source}`;

/** firstSeen range [min, max] for a day tab. */
export function dayRange(day: Day, now = Date.now()): [number, number] {
  return day === 'today' ? [now - DAY_MS, now + DAY_MS] : [now - KEEP_MS, now - DAY_MS - 1];
}

export type UpsertResult = { created: Car[]; updated: number; removed: number };
export type Counts = Record<Day, Record<Kind, number>>;

interface Store {
  upsert(source: string, cars: Car[], dropIds: string[]): Promise<UpsertResult>;
  list(source: string, kind: Kind, day: Day, limit?: number): Promise<Car[]>;
  counts(source: string): Promise<Counts>;
  hide(source: string, id: string, hidden?: boolean): Promise<void>;
  prune(source: string): Promise<number>;
  dealers(source: string): Promise<Dealer[]>;
  /** Adds or updates dealers (keeps the earliest firstSeen). */
  saveDealers(source: string, list: Dealer[]): Promise<number>;
  removeDealers(source: string, ids: string[]): Promise<number>;
}

const mergeDealer = (old: Dealer | undefined, d: Dealer): Dealer =>
  old ? { ...old, ...d, name: d.name ?? old.name, cars: d.cars ?? old.cars, titles: d.titles.length ? d.titles : old.titles,
    location: d.location ?? old.location, firstSeen: Math.min(old.firstSeen, d.firstSeen), lastSeen: Math.max(old.lastSeen, d.lastSeen) } : d;

// ---------- Redis ----------

class RedisStore implements Store {
  r = new Redis({ url: url!, token: token!, automaticDeserialization: false });

  private async getMany(source: string, ids: string[]): Promise<(Car | null)[]> {
    if (!ids.length) return [];
    // With automaticDeserialization off, HMGET returns an array in field order;
    // older client versions return a { field: value } object. Accept both.
    const vals = (await this.r.hmget(hashKey(source), ...ids)) as (string | null)[] | Record<string, string | null> | null;
    return ids.map((id, i) => {
      const v = Array.isArray(vals) ? vals[i] : vals?.[id];
      if (!v) return null;
      try { return JSON.parse(v) as Car; } catch { return null; }
    });
  }

  async upsert(source: string, cars: Car[], dropIds: string[]): Promise<UpsertResult> {
    const prev = await this.getMany(source, cars.map((c) => c.id));
    const p = this.r.pipeline();
    const created: Car[] = [];
    let updated = 0;
    cars.forEach((car, i) => {
      const old = prev[i];
      if (old) {
        car.firstSeen = old.firstSeen;
        car.hidden = old.hidden;
        if (old.kind !== car.kind) p.zrem(listKey(source, old.kind), car.id);
        updated++;
      } else created.push(car);
      p.hset(hashKey(source), { [car.id]: JSON.stringify(car) });
      p.zadd(allKey(source), { score: car.firstSeen, member: car.id });
      if (!car.hidden) p.zadd(listKey(source, car.kind), { score: car.firstSeen, member: car.id });
    });
    // Listings that no longer qualify (re-priced under MIN_PROFIT, dealer, too old).
    for (const id of dropIds) {
      for (const k of KINDS) p.zrem(listKey(source, k), id);
      p.zrem(allKey(source), id);
      p.hdel(hashKey(source), id);
    }
    if (cars.length || dropIds.length) await p.exec();
    await this.prune(source);
    await this.trim(source);
    return { created, updated, removed: dropIds.length };
  }

  /** Deletes cars first found more than 48 h ago. */
  async prune(source: string) {
    const cutoff = Date.now() - KEEP_MS;
    const ids = new Set<string>();
    for (const key of [allKey(source), ...KINDS.map((k) => listKey(source, k))]) {
      for (const id of (await this.r.zrange(key, 0, cutoff, { byScore: true })) as string[]) ids.add(id);
    }
    if (!ids.size) return 0;
    const list = [...ids];
    const p = this.r.pipeline();
    for (const key of [allKey(source), ...KINDS.map((k) => listKey(source, k))]) p.zremrangebyscore(key, 0, cutoff);
    for (let i = 0; i < list.length; i += 500) p.hdel(hashKey(source), ...list.slice(i, i + 500));
    await p.exec();
    return list.length;
  }

  private async trim(source: string) {
    for (const kind of KINDS) {
      const n = await this.r.zcard(listKey(source, kind));
      if (n <= MAX_PER_LIST) continue;
      const old = (await this.r.zrange(listKey(source, kind), 0, n - MAX_PER_LIST - 1)) as string[];
      if (!old.length) continue;
      await this.r.zrem(listKey(source, kind), ...old);
      await this.r.hdel(hashKey(source), ...old);
    }
  }

  async list(source: string, kind: Kind, day: Day, limit = 500): Promise<Car[]> {
    const [min, max] = dayRange(day);
    const ids = (await this.r.zrange(listKey(source, kind), max, min, { byScore: true, rev: true, offset: 0, count: limit })) as string[];
    const dealerIds = new Set((await this.r.hkeys(dealerKey(source))) as string[]);
    return cleanList((await this.getMany(source, ids)).filter((c): c is Car => !!c && !c.hidden && !(c.sellerId && dealerIds.has(c.sellerId))));
  }

  /** Counts what the tabs show (no duplicates or non-cars). */
  async counts(source: string): Promise<Counts> {
    const out = { today: { deal: 0, novin: 0 }, yesterday: { deal: 0, novin: 0 } } as Counts;
    await Promise.all((['today', 'yesterday'] as Day[]).flatMap((day) => KINDS.map(async (kind) => {
      out[day][kind] = (await this.list(source, kind, day)).length;
    })));
    return out;
  }

  async dealers(source: string): Promise<Dealer[]> {
    const all = (await this.r.hgetall(dealerKey(source))) as Record<string, string> | null;
    return Object.values(all ?? {}).flatMap((v) => { try { return [JSON.parse(v) as Dealer]; } catch { return []; } });
  }

  async saveDealers(source: string, list: Dealer[]) {
    if (!list.length) return 0;
    const old = (await this.r.hmget(dealerKey(source), ...list.map((d) => d.id))) as (string | null)[] | Record<string, string | null> | null;
    const fields: Record<string, string> = {};
    list.forEach((d, i) => {
      const v = Array.isArray(old) ? old[i] : old?.[d.id];
      let prev: Dealer | undefined;
      try { prev = v ? JSON.parse(v) : undefined; } catch { prev = undefined; }
      fields[d.id] = JSON.stringify(mergeDealer(prev, d));
    });
    await this.r.hset(dealerKey(source), fields);
    return list.length;
  }

  async removeDealers(source: string, ids: string[]) {
    return ids.length ? this.r.hdel(dealerKey(source), ...ids) : 0;
  }

  /** hidden=false brings a hidden car back (the "Undo" button). */
  async hide(source: string, id: string, hidden = true) {
    const [car] = await this.getMany(source, [id]);
    if (!car) return;
    car.hidden = hidden;
    const p = this.r.pipeline();
    p.hset(hashKey(source), { [id]: JSON.stringify(car) });
    if (hidden) for (const k of KINDS) p.zrem(listKey(source, k), id);
    else p.zadd(listKey(source, car.kind), { score: car.firstSeen, member: id });
    await p.exec();
  }
}

// ---------- in-memory (local dev) ----------

class MemoryStore implements Store {
  m = new Map<string, Car>();
  d = new Map<string, Dealer>();
  async dealers(source: string) { return [...this.d.entries()].filter(([k]) => k.startsWith(source + ':')).map(([, v]) => v); }
  async saveDealers(source: string, list: Dealer[]) {
    for (const x of list) this.d.set(`${source}:${x.id}`, mergeDealer(this.d.get(`${source}:${x.id}`), x));
    return list.length;
  }
  async removeDealers(source: string, ids: string[]) { let n = 0; for (const id of ids) if (this.d.delete(`${source}:${id}`)) n++; return n; }
  private k = (s: string, id: string) => `${s}:${id}`;
  private inDay = (c: Car, day: Day) => { const [min, max] = dayRange(day); return c.firstSeen >= min && c.firstSeen <= max; };

  async upsert(source: string, cars: Car[], dropIds: string[]): Promise<UpsertResult> {
    const created: Car[] = [];
    let updated = 0;
    for (const car of cars) {
      const old = this.m.get(this.k(source, car.id));
      if (old) { car.firstSeen = old.firstSeen; car.hidden = old.hidden; updated++; } else created.push(car);
      this.m.set(this.k(source, car.id), car);
    }
    dropIds.forEach((id) => this.m.delete(this.k(source, id)));
    await this.prune(source);
    return { created, updated, removed: dropIds.length };
  }
  async prune(source: string) {
    const cutoff = Date.now() - KEEP_MS;
    let n = 0;
    for (const [k, c] of this.m) if (c.source === source && c.firstSeen < cutoff) { this.m.delete(k); n++; }
    return n;
  }
  async list(source: string, kind: Kind, day: Day, limit = 500) {
    return cleanList([...this.m.values()].filter((c) => c.source === source && c.kind === kind && !c.hidden && this.inDay(c, day)
      && !(c.sellerId && this.d.has(`${source}:${c.sellerId}`)))
      .sort((a, b) => b.firstSeen - a.firstSeen).slice(0, limit));
  }
  async counts(source: string) {
    const n = async (day: Day, kind: Kind) => (await this.list(source, kind, day)).length;
    return { today: { deal: await n('today', 'deal'), novin: await n('today', 'novin') }, yesterday: { deal: await n('yesterday', 'deal'), novin: await n('yesterday', 'novin') } };
  }
  async hide(source: string, id: string, hidden = true) {
    const c = this.m.get(this.k(source, id));
    if (c) c.hidden = hidden;
  }
}

const g = globalThis as unknown as { __carsStore?: Store };
export const store: Store = g.__carsStore ??= hasDatabase ? new RedisStore() : new MemoryStore();
