'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Car, Day, Kind } from '@/lib/types';

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

// Quick filters on the extra listing details.
type Flag = 'phone' | 'clean' | 'owner1' | 'carfax' | 'noIssues';
const FLAGS: { id: Flag; label: string; test: (c: Car) => boolean }[] = [
  { id: 'phone', label: 'Has phone', test: (c) => !!c.phone },
  { id: 'clean', label: 'Clean title', test: (c) => /^clean/i.test(c.titleStatus ?? '') },
  { id: 'owner1', label: '1 owner', test: (c) => c.owners === 1 },
  { id: 'carfax', label: 'Clean Carfax', test: (c) => c.carfax === 'Clean Carfax' },
  { id: 'noIssues', label: 'No issues listed', test: (c) => !c.issues },
];

const ownersText = (n: number) => `${n} owner${n > 1 ? 's' : ''}`;
const isBadTitle = (t: string) => /salvage|rebuilt|no title|lien/i.test(t);

export default function CarsView({ cars, kind, day, sourceName }: { cars: Car[]; kind: Kind; day: Day; sourceName: string }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>(kind === 'deal' ? 'profit' : 'new');
  const [flags, setFlags] = useState<Set<Flag>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, tick] = useState(0);

  // Pull new cars every 2 minutes while the tab is visible.
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) { router.refresh(); tick((x) => x + 1); } }, 120_000);
    return () => clearInterval(t);
  }, [router]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const active = FLAGS.filter((f) => flags.has(f.id));
    return cars
      .filter((c) => !hidden.has(c.id))
      .filter((c) => active.every((f) => f.test(c)))
      .filter((c) => !needle || [c.title, c.vin, c.location, c.mmrName, c.search, c.phone, c.sellerName, c.description]
        .join(' ').toLowerCase().includes(needle))
      .sort(SORTS[sort]);
  }, [cars, q, sort, flags, hidden]);

  function toggle(f: Flag) {
    setFlags((s) => { const n = new Set(s); if (n.has(f)) n.delete(f); else n.add(f); return n; });
  }

  async function hide(c: Car) {
    setHidden((h) => new Set(h).add(c.id));
    await fetch('/api/cars/hide', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ source: c.source, id: c.id }) });
    router.refresh();
  }

  const best = list.reduce<number | null>((m, c) => (c.profit != null && (m == null || c.profit > m) ? c.profit : m), null);
  const withPhone = list.filter((c) => c.phone).length;

  return (
    <>
      <div className="stats">
        <div className="stat"><div className="k">{kind === 'deal' ? 'Deals' : 'No VIN'}</div><div className="v">{list.length}</div></div>
        <div className="stat"><div className="k">With phone</div><div className="v">{withPhone}</div></div>
        <div className="stat"><div className="k">{kind === 'deal' ? 'Best spread' : 'Lowest price'}</div>
          <div className="v">{kind === 'deal' ? (best != null ? '+' + usd(best) : '—') : usd(list.reduce<number | null>((m, c) => (c.price != null && (m == null || c.price < m) ? c.price : m), null))}</div></div>
      </div>

      <div className="bar">
        <input type="search" placeholder="Search make, model, VIN, city, phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          {kind === 'deal' && <option value="profit">Biggest spread</option>}
          <option value="new">Newest</option>
          <option value="priceAsc">Price: low → high</option>
          <option value="milesAsc">Miles: low → high</option>
        </select>
      </div>
      <div className="flags">
        {FLAGS.map((f) => (
          <button key={f.id} type="button" className={flags.has(f.id) ? 'on' : ''} aria-pressed={flags.has(f.id)} onClick={() => toggle(f.id)}>{f.label}</button>
        ))}
      </div>

      <div className="grid">
        {!list.length && (
          <div className="empty">
            {cars.length ? 'No cars match your filters.' : day === 'yesterday'
              ? `No ${sourceName} cars from yesterday.`
              : kind === 'deal'
                ? `No ${sourceName} deals today yet. They appear here after the scanner runs.`
                : `No ${sourceName} listings without a VIN today yet.`}
          </div>
        )}
        {list.map((c) => {
          const chips: { t: string; tone?: 'good' | 'bad' }[] = [];
          if (c.titleStatus) chips.push({ t: `Title: ${c.titleStatus}`, tone: isBadTitle(c.titleStatus) ? 'bad' : /^clean/i.test(c.titleStatus) ? 'good' : undefined });
          if (c.owners != null) chips.push({ t: ownersText(c.owners), tone: c.owners === 1 ? 'good' : undefined });
          if (c.carfax) chips.push({ t: c.carfax, tone: c.carfax === 'Clean Carfax' ? 'good' : undefined });
          if (c.accidents) chips.push({ t: c.accidents, tone: c.accidents === 'No accidents' ? 'good' : 'bad' });
          if (c.issues) chips.push({ t: c.issues, tone: 'bad' });
          const specs = [c.transmission, c.exteriorColor && `${c.exteriorColor} ext`, c.interiorColor && `${c.interiorColor} int`, c.fuel].filter(Boolean).join(' · ');
          const seller = [c.sellerName, c.sellerJoined && `on FB since ${c.sellerJoined}`].filter(Boolean).join(' · ');
          return (
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
                  <div className="sub">{[c.location, c.search, `found ${ago(c.firstSeen)}`, c.listed].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="nums">
                  <div className="n"><div className="k">Asking</div><div className="v">{usd(c.price)}</div></div>
                  <div className="n"><div className="k">MMR</div><div className="v">{usd(c.mmr)}</div></div>
                  <div className="n"><div className="k">Miles</div><div className="v">{c.mileage != null ? c.mileage.toLocaleString('en-US') : '—'}</div></div>
                </div>
                {kind === 'deal' && <div className="spread"><span>Spread</span><span>+{usd(c.profit)}</span></div>}
                {c.phone && (
                  <div className="phone">
                    {c.phone.split(', ').map((p) => <a key={p} href={`tel:${p.replace(/\D/g, '')}`}>📞 {p}</a>)}
                  </div>
                )}
                {!!chips.length && (
                  <div className="chips">{chips.map((x) => <span key={x.t} className={`chip ${x.tone ?? ''}`}>{x.t}</span>)}</div>
                )}
                {specs && <div className="sub">{specs}</div>}
                {seller && <div className="sub">Seller: {seller}</div>}
                {c.vin && <div className="vin">VIN {c.vin}{c.mmrName ? ` · ${c.mmrName}` : ''}</div>}
                {c.description && (
                  <details className="desc">
                    <summary>Seller&apos;s description</summary>
                    <p>{c.description}</p>
                  </details>
                )}
                <a className="view" href={c.url} target="_blank" rel="noopener noreferrer">View car</a>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
