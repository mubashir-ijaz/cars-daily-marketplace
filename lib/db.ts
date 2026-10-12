import { Redis } from '@upstash/redis';
import type { Car, Kind } from './types';

// Storage: Upstash Redis (add it from the Vercel dashboard → Storage /
// Marketplace → Upstash Redis; Vercel sets the env vars automatically).
// Without those env vars an in-memory store is used — fine for local dev only.

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
export const hasDatabase = !!(url && token);

const MAX_PER_LIST = 3000;
const hashKey = (source: string) => `cars:${source}`;
const listKey = (source: string, kind: Kind) => `list:${source}:${kind}`;

export type UpsertResult = { created: Car[]; updated: number; removed: number };

interface Store {
  upsert(source: string, cars: Car[], dropIds: string[]): Promise<UpsertResult>;
  list(source: string, kind: Kind, limit?: number): Promise<Car[]>;
  counts(source: string): Promise<Record<Kind, number>>;
  hide(source: string, id: string): Promise<void>;
}

// ---------- Redis ----------

class RedisStore implements Store {
  r = new Redis({ url: url!, token: token!, automaticDeserialization: false });

  private async getMany(source: string, ids: string[]): Promise<(Car | null)[]> {
    if (!ids.length) return [];
    const vals = (await this.r.hmget(hashKey(source), ...ids)) as Record<string, string | null> | null;
    return ids.map((id) => {
      const v = vals?.[id];
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
      if (!car.hidden) p.zadd(listKey(source, car.kind), { score: car.firstSeen, member: car.id });
    });
    // Listings that no longer qualify (e.g. re-priced under MIN_PROFIT).
    for (const id of dropIds) {
      p.zrem(listKey(source, 'deal'), id);
      p.zrem(listKey(source, 'novin'), id);
      p.hdel(hashKey(source), id);
    }
    if (cars.length || dropIds.length) await p.exec();
    await this.trim(source);
    return { created, updated, removed: dropIds.length };
  }

  private async trim(source: string) {
    for (const kind of ['deal', 'novin'] as Kind[]) {
      const n = await this.r.zcard(listKey(source, kind));
      if (n <= MAX_PER_LIST) continue;
      const old = (await this.r.zrange(listKey(source, kind), 0, n - MAX_PER_LIST - 1)) as string[];
      if (!old.length) continue;
      await this.r.zrem(listKey(source, kind), ...old);
      await this.r.hdel(hashKey(source), ...old);
    }
  }

  async list(source: string, kind: Kind, limit = 500): Promise<Car[]> {
    const ids = (await this.r.zrange(listKey(source, kind), 0, limit - 1, { rev: true })) as string[];
    return (await this.getMany(source, ids)).filter((c): c is Car => !!c && !c.hidden);
  }

  async counts(source: string) {
    const [deal, novin] = await Promise.all([this.r.zcard(listKey(source, 'deal')), this.r.zcard(listKey(source, 'novin'))]);
    return { deal, novin };
  }

  async hide(source: string, id: string) {
    const [car] = await this.getMany(source, [id]);
    if (!car) return;
    car.hidden = true;
    const p = this.r.pipeline();
    p.hset(hashKey(source), { [id]: JSON.stringify(car) });
    p.zrem(listKey(source, 'deal'), id);
    p.zrem(listKey(source, 'novin'), id);
    await p.exec();
  }
}

// ---------- in-memory (local dev) ----------

class MemoryStore implements Store {
  m = new Map<string, Car>();
  private k = (s: string, id: string) => `${s}:${id}`;

  async upsert(source: string, cars: Car[], dropIds: string[]): Promise<UpsertResult> {
    const created: Car[] = [];
    let updated = 0;
    for (const car of cars) {
      const old = this.m.get(this.k(source, car.id));
      if (old) { car.firstSeen = old.firstSeen; car.hidden = old.hidden; updated++; } else created.push(car);
      this.m.set(this.k(source, car.id), car);
    }
    dropIds.forEach((id) => this.m.delete(this.k(source, id)));
    return { created, updated, removed: dropIds.length };
  }
  async list(source: string, kind: Kind, limit = 500) {
    return [...this.m.values()].filter((c) => c.source === source && c.kind === kind && !c.hidden)
      .sort((a, b) => b.firstSeen - a.firstSeen).slice(0, limit);
  }
  async counts(source: string) {
    const all = [...this.m.values()].filter((c) => c.source === source && !c.hidden);
    return { deal: all.filter((c) => c.kind === 'deal').length, novin: all.filter((c) => c.kind === 'novin').length };
  }
  async hide(source: string, id: string) {
    const c = this.m.get(this.k(source, id));
    if (c) c.hidden = true;
  }
}

const g = globalThis as unknown as { __carsStore?: Store };
export const store: Store = g.__carsStore ??= hasDatabase ? new RedisStore() : new MemoryStore();
