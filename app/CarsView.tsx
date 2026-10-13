'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Car, Day, Kind } from '@/lib/types';

const usd = (n: number | null | undefined) =>
  n == null ? '—' : (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
const miles = (n: number | null | undefined) => (n == null ? '—' : n.toLocaleString('en-US'));

function ago(t: number) {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
}

type Sort = 'profit' | 'new' | 'priceAsc' | 'milesAsc' | 'yearDesc';
const SORTS: Record<Sort, (a: Car, b: Car) => number> = {
  profit: (a, b) => (b.profit ?? -1e9) - (a.profit ?? -1e9),
  new: (a, b) => b.firstSeen - a.firstSeen,
  priceAsc: (a, b) => (a.price ?? 1e9) - (b.price ?? 1e9),
  milesAsc: (a, b) => (a.mileage ?? 1e9) - (b.mileage ?? 1e9),
  yearDesc: (a, b) => (b.year ?? 0) - (a.year ?? 0),
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
const telHref = (p: string) => `tel:${p.replace(/\D/g, '')}`;

const Svg = ({ d, size = 16 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d={d} /></svg>
);
const P = {
  phone: 'M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z',
  ext: 'M14 3v2h3.6l-9.8 9.8 1.4 1.4L19 6.4V10h2V3zm5 16H5V5h7V3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14a2 2 0 0 0 2-2v-7h-2z',
  pin: 'M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7m0 9.5a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5',
  copy: 'M16 1H4a2 2 0 0 0-2 2v14h2V3h12zm3 4H8a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2m0 16H8V7h11z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8m0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4',
  car: 'M18.9 6c-.2-.6-.8-1-1.4-1h-11c-.7 0-1.2.4-1.4 1L3 12v8c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-1h12v1c0 .6.4 1 1 1h1c.6 0 1-.4 1-1v-8zM6.5 16a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3m11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3M5 11l1.5-4.5h11L19 11z',
  x: 'M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z',
};

function CopyVin({ vin }: { vin: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(vin); } catch {
      const t = document.createElement('textarea'); t.value = vin; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  }
  return (
    <button type="button" className="vin" onClick={copy} title="Copy VIN">
      <span>VIN {vin}</span> <Svg d={done ? P.check : P.copy} size={14} /> <span className="sr">{done ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

function Photo({ src }: { src: string | null }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <div className="noimg"><Svg d={P.car} size={44} /></div>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBad(true)} />;
}

export default function CarsView({ cars, kind, day, sourceName, otherHref, yesterdayHref }: {
  cars: Car[]; kind: Kind; day: Day; sourceName: string; otherHref: string; yesterdayHref: string | null;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<Sort>(kind === 'deal' ? 'profit' : 'new');
  const [flags, setFlags] = useState<Set<Flag>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ car: Car; msg: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

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

  const filtering = !!q.trim() || flags.size > 0;

  function toggle(f: Flag) {
    setFlags((s) => { const n = new Set(s); if (n.has(f)) n.delete(f); else n.add(f); return n; });
  }
  function clearFilters() { setQ(''); setFlags(new Set()); }

  function showToast(car: Car, msg: string) {
    setToast({ car, msg });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }

  async function setHiddenOnServer(c: Car, value: boolean) {
    const r = await fetch('/api/cars/hide', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: c.source, id: c.id, hidden: value }),
    }).catch(() => null);
    return !!r?.ok;
  }

  async function hide(c: Car) {
    setHidden((h) => new Set(h).add(c.id));
    showToast(c, 'Car hidden');
    if (!(await setHiddenOnServer(c, true))) {
      setHidden((h) => { const n = new Set(h); n.delete(c.id); return n; });
      showToast(c, 'Could not hide — please try again');
    }
  }

  async function undo() {
    if (!toast) return;
    const c = toast.car;
    setToast(null);
    setHidden((h) => { const n = new Set(h); n.delete(c.id); return n; });
    await setHiddenOnServer(c, false);
    router.refresh();
  }

  const deals = list.filter((c) => c.profit != null);
  const totalSpread = deals.reduce((s, c) => s + (c.profit ?? 0), 0);
  const best = deals.reduce<number | null>((m, c) => (m == null || (c.profit ?? 0) > m ? c.profit : m), null);
  const withPhone = list.filter((c) => c.phone).length;
  const lowest = list.reduce<number | null>((m, c) => (c.price != null && (m == null || c.price < m) ? c.price : m), null);
  const withMiles = list.filter((c) => c.mileage != null);
  const avgMiles = withMiles.length ? withMiles.reduce((s, c) => s + (c.mileage ?? 0), 0) / withMiles.length : null;

  return (
    <>
      <div className="stats">
        <div className="stat"><div className="k">{kind === 'deal' ? 'Deals' : 'Cars'}</div><div className="v">{list.length}</div></div>
        {kind === 'deal' ? (
          <>
            <div className="stat accent"><div className="k">Total spread</div><div className="v">{totalSpread ? '+' + usd(totalSpread) : '—'}</div></div>
            <div className="stat"><div className="k">Best deal</div><div className="v">{best != null ? '+' + usd(best) : '—'}</div></div>
          </>
        ) : (
          <>
            <div className="stat"><div className="k">Lowest price</div><div className="v">{usd(lowest)}</div></div>
            <div className="stat"><div className="k">Avg miles</div><div className="v">{avgMiles != null ? miles(Math.round(avgMiles)) : '—'}</div></div>
          </>
        )}
        <div className="stat"><div className="k">With phone</div><div className="v">{withPhone}</div></div>
      </div>

      <div className="toolbar">
        <div className="bar">
          <label className="searchbox">
            <Svg d="M10 2a8 8 0 0 1 6.32 12.9l5.39 5.4-1.41 1.4-5.4-5.39A8 8 0 1 1 10 2m0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12" />
            <input type="search" placeholder="Search make, model, VIN, city, phone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search cars" />
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
            {kind === 'deal' && <option value="profit">Sort: Biggest spread</option>}
            <option value="new">Sort: Newest first</option>
            <option value="priceAsc">Sort: Price low → high</option>
            <option value="milesAsc">Sort: Miles low → high</option>
            <option value="yearDesc">Sort: Year new → old</option>
          </select>
        </div>
        <div className="flags" role="group" aria-label="Quick filters">
          {FLAGS.map((f) => (
            <button key={f.id} type="button" className={flags.has(f.id) ? 'on' : ''} aria-pressed={flags.has(f.id)} onClick={() => toggle(f.id)}>
              {flags.has(f.id) && <Svg d={P.check} size={14} />} {f.label}
            </button>
          ))}
          {filtering && <button type="button" className="clear" onClick={clearFilters}>Clear filters</button>}
          <span className="showing">{list.length} of {cars.length - hidden.size} shown</span>
        </div>
      </div>

      <div className="grid">
        {!list.length && (
          <div className="empty">
            <div className="empty-ic"><Svg d={P.car} size={36} /></div>
            {filtering && cars.length ? (
              <>
                <h3>No cars match these filters</h3>
                <button type="button" className="btn" onClick={clearFilters}>Clear filters</button>
              </>
            ) : (
              <>
                <h3>{day === 'yesterday' ? 'Nothing from yesterday' : kind === 'deal' ? 'No deals yet today' : 'No no-VIN cars yet today'}</h3>
                <p className="muted">
                  {kind === 'deal'
                    ? `The scanner checks ${sourceName} all day. New deals show up here automatically — and you get an email.`
                    : `Listings from ${sourceName} without a VIN will show up here as they are found.`}
                </p>
                <div className="empty-actions">
                  <Link className="btn" href={otherHref}>{kind === 'deal' ? 'See No VIN cars' : 'See deals'}</Link>
                  {yesterdayHref && <Link className="btn ghost-btn" href={yesterdayHref}>See yesterday</Link>}
                </div>
              </>
            )}
          </div>
        )}
        {list.map((c) => {
          const chips: { t: string; tone?: 'good' | 'bad' }[] = [];
          if (c.titleStatus) chips.push({ t: `Title: ${c.titleStatus}`, tone: isBadTitle(c.titleStatus) ? 'bad' : /^clean/i.test(c.titleStatus) ? 'good' : undefined });
          if (c.owners != null) chips.push({ t: ownersText(c.owners), tone: c.owners === 1 ? 'good' : undefined });
          if (c.carfax) chips.push({ t: c.carfax, tone: c.carfax === 'Clean Carfax' ? 'good' : undefined });
          if (c.accidents) chips.push({ t: c.accidents, tone: c.accidents === 'No accidents' ? 'good' : 'bad' });
          if (c.issues) chips.push({ t: c.issues, tone: 'bad' });
          const specs = [c.transmission, c.exteriorColor && `${c.exteriorColor} exterior`, c.interiorColor && `${c.interiorColor} interior`, c.fuel].filter(Boolean).join(' · ');
          const isNew = Date.now() - c.firstSeen < 2 * 3600_000;
          return (
            <article className="car" key={c.id} id={`car-${c.id}`}>
              <div className="ph">
                <Photo src={c.img} />
                <div className="ph-top">
                  {kind === 'deal'
                    ? <span className="badge">+{usd(c.profit)} spread</span>
                    : <span className="badge nv">No VIN</span>}
                  {isNew && <span className="badge new">New</span>}
                </div>
                <button type="button" className="hide" title="Hide this car" aria-label={`Hide ${c.title || 'this car'}`} onClick={() => hide(c)}>
                  <Svg d={P.x} size={16} />
                </button>
                <div className="ph-price">{usd(c.price)}</div>
              </div>
              <div className="cb">
                <div>
                  <h3 className="ti">{c.title || 'Vehicle'}</h3>
                  <div className="sub">
                    {c.location && <span className="loc"><Svg d={P.pin} size={13} /> {c.location}</span>}
                    <span>Found {ago(c.firstSeen)}</span>
                    {c.listed && <span>{c.listed}</span>}
                  </div>
                </div>
                <div className="nums">
                  <div className="n"><div className="k">Asking</div><div className="v">{usd(c.price)}</div></div>
                  <div className="n"><div className="k">MMR</div><div className="v">{usd(c.mmr)}</div></div>
                  <div className="n"><div className="k">Miles</div><div className="v">{miles(c.mileage)}</div></div>
                </div>
                {kind === 'deal' && (
                  <div className="spread"><span>Potential profit</span><span>+{usd(c.profit)}</span></div>
                )}
                {!!chips.length && (
                  <div className="chips">{chips.map((x) => <span key={x.t} className={`chip ${x.tone ?? ''}`}>{x.t}</span>)}</div>
                )}
                {specs && <div className="specs">{specs}</div>}
                {(c.sellerName || c.sellerJoined) && (
                  <div className="seller"><Svg d={P.user} size={14} /> {c.sellerName || 'Private seller'}{c.sellerJoined ? ` · on Facebook since ${c.sellerJoined}` : ''}</div>
                )}
                {c.vin && <CopyVin vin={c.vin} />}
                {c.mmrName && <div className="mmrname">MMR: {c.mmrName}</div>}
                {c.description && (
                  <details className="desc">
                    <summary>Seller&apos;s description</summary>
                    <p>{c.description}</p>
                  </details>
                )}
                <div className="actions">
                  {c.phone && c.phone.split(', ').map((p) => (
                    <a key={p} className="btn call" href={telHref(p)}><Svg d={P.phone} /> {p}</a>
                  ))}
                  <a className="btn primary" href={c.url} target="_blank" rel="noopener noreferrer">
                    View listing <Svg d={P.ext} size={14} />
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {toast && (
        <div className="toast" role="status">
          <span>{toast.msg}</span>
          <button type="button" onClick={undo}>Undo</button>
          <button type="button" className="tx" aria-label="Close" onClick={() => setToast(null)}><Svg d={P.x} size={14} /></button>
        </div>
      )}
    </>
  );
}
