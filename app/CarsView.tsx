'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Car, Kind } from '@/lib/types';

const usd = (n: number | null | undefined) =>
  n == null ? '—' : (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');

function ago(t: number) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

type Sort = 'profit' | 'new' | 'priceAsc' | 'milesAsc';
const SORTS: Record<Sort, (a: Car, b: Car) => number> = {
  profit: (a, b) => (b.profit ?? -1e9) - (a.profit ?? -1e9),
  new: (a, b) => b.firstSeen - a.firstSeen,
  priceAsc: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9),
  milesAsc: (a, b) => (a.mileage ?? 1e9) - (b.mileage ?? 1e9),
};

export default function CarsView({ cars, kind, sourceName }: { cars: Car[]; kind: Kind; sourceName: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>(kind === 'deal' ? 'profit' : 'new');
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, tick] = useState(0);

  // Pull new cars every 2 minutes while the tab is visible.
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) { router.refresh(); tick((x) => x + 1); } }, 120_000);
    return () => clearInterval(t);
  }, [router]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cars
      .filter((c) => !hidden.has(c.id))
      .filter((c) => !needle || [c.title, c.vin, c.location, c.mmrName, c.search].join(' ').toLowerCase().includes(needle))
      .sort(SORTS[sort]);
  }, [cars, q, sort, hidden]);

  async function hide(c: Car) {
    setHidden((h) => new Set(h).add(c.id));
    await fetch('/api/cars/hide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: c.source, id: c.id }) });
    router.refresh();
  }

  const best = list.reduce<number | null>((m, c) => (c.profit != null && (m == null || c.profit > m) ? c.profit : m), null);
  const newToday = list.filter((c) => Date.now() - c.firstSeen < 86_400_000).length;

  return (
    <>
      <div className="stats">
        <div className="stat"><div className="k">{kind === 'deal' ? 'Deals' : 'No VIN'}</div><div className="v">{list.length}</div></div>
        <div className="stat"><div className="k">New 24h</div><div className="v">{newToday}</div></div>
        <div className="stat"><div className="k">{kind === 'deal' ? 'Best spread' : 'Lowest price'}</div>
          <div className="v">{kind === 'deal' ? (best != null ? '+' + usd(best) : '—') : usd(list.reduce<number | null>((m, c) => (c.price != null && (m == null || c.price < m) ? c.price : m), null))}</div></div>
      </div>

      <div className="bar">
        <input type="search" placeholder="Search make, model, VIN, city…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          {kind === 'deal' && <option value="profit">Biggest spread</option>}
          <option value="new">Newest</option>
          <option value="priceAsc">Price: low → high</option>
          <option value="milesAsc">Miles: low → high</option>
        </select>
      </div>

      <div className="grid">
        {!list.length && (
          <div className="empty">
            {cars.length ? 'No cars match your search.' : kind === 'deal'
              ? `No ${sourceName} deals yet. They appear here after the scanner runs.`
              : `No ${sourceName} listings without a VIN yet.`}
          </div>
        )}
        {list.map((c) => (
          <article className="car" key={c.id} id={`car-${c.id}`}>
            <div className="ph">
              {c.img && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.img} alt="" loading="lazy" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
              )}
              <span className={`badge ${kind === 'novin' ? 'nv' : ''}`}>{kind === 'deal' ? 'Deal' : 'No VIN'}</span>
              <button className="hide" title="Hide this car" aria-label="Hide this car" onClick={() => hide(c)}>×</button>
            </div>
            <div className="cb">
              <div>
                <div className="ti">{c.title || 'Vehicle'}</div>
                <div className="sub">{[c.location, c.search, ago(c.firstSeen)].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="nums">
                <div className="n"><div className="k">Asking</div><div className="v">{usd(c.price)}</div></div>
                <div className="n"><div className="k">MMR</div><div className="v">{usd(c.mmr)}</div></div>
                <div className="n"><div className="k">Miles</div><div className="v">{c.mileage != null ? c.mileage.toLocaleString('en-US') : '—'}</div></div>
              </div>
              {kind === 'deal' && <div className="spread"><span>Spread</span><span>+{usd(c.profit)}</span></div>}
              {c.vin && <div className="vin">VIN {c.vin}{c.mmrName ? ` · ${c.mmrName}` : ''}</div>}
              <a className="view" href={c.url} target="_blank" rel="noopener noreferrer">View car</a>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
