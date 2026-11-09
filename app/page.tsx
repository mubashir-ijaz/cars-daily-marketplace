import Link from 'next/link';
import { getSource } from '@/lib/sources';
import { store, hasDatabase } from '@/lib/db';
import { minProfit, minPrice, cleanList } from '@/lib/classify';
import { loadStatus } from '@/lib/status';
import { sheetCars, sheetStatus } from '@/lib/sheet';
import { passwordEnabled } from '@/lib/auth';
import { BRAND, TAGLINE } from '@/lib/brand';
import TopBar from './components/TopBar';
import BotStatusCard from './components/BotStatus';
import CarsView from './CarsView';

export const dynamic = 'force-dynamic';

type Search = Promise<{ source?: string; tab?: string }>;

const ago = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};
const usd = (n: number | null) => (n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US'));

export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const source = getSource(sp.source);
  const tab: 'deal' | 'skipped' = sp.tab === 'skipped' ? 'skipped' : 'deal';
  await store.prune(source.id).catch(() => 0); // cars older than 24 h are deleted
  // Cars come from the Google Sheet the scanner writes to (and from the database, if the old scanner still posts there).
  const [stored, fromSheet, sheetSt, dbSt] = await Promise.all([
    store.list(source.id, 'deal', 'today').catch(() => []),
    sheetCars(source.id),
    sheetStatus(),
    loadStatus(source.id),
  ]);
  const since = Date.now() - 86_400_000;
  const all = cleanList([...fromSheet, ...stored].filter((c) => c.firstSeen > since && c.kind === 'deal').sort((a, b) => b.firstSeen - a.firstSeen), 'deal');
  const cars = tab === 'deal' ? all : [];
  const status = sheetSt && (!dbSt || sheetSt.at >= dbSt.at) ? sheetSt : dbSt;
  const dealCount = all.length;
  const skipped = (status?.skipped ?? []).filter((d) => Date.now() - d.t < 86_400_000);
  const minLabel = `${usd(minProfit())}+`;
  const href = (t: 'deal' | 'skipped') => `/?source=${source.id}&tab=${t}`;

  return (
    <>
      <TopBar brand={BRAND} tagline={TAGLINE} canLogout={passwordEnabled()} />
      <main className="wrap main1">
        {!hasDatabase && (
          <div className="banner">No database connected — cars are kept in memory only. In Vercel, add Upstash Redis under Storage and redeploy.</div>
        )}

        <BotStatusCard status={status} />

        <nav className="tabs" aria-label="Views">
          <Link href={href('deal')} className={tab === 'deal' ? 'on' : ''} aria-current={tab === 'deal' ? 'page' : undefined}>
            Deals <span className="count">{dealCount}</span>
          </Link>
          <Link href={href('skipped')} className={tab === 'skipped' ? 'on' : ''} aria-current={tab === 'skipped' ? 'page' : undefined}>
            Skipped dealers <span className="count">{skipped.length}</span>
          </Link>
        </nav>

        {tab === 'deal' ? (
          <>
            <div className="hero">
              <h1>Deals — profit {minLabel}</h1>
              <p className="muted">Private sellers asking at least {usd(minPrice())}, priced below Manheim MMR. Ads are read in full; cars with salvage titles, structural damage or engine / transmission problems never show. Cars clear after 24 hours.</p>
            </div>
            <CarsView key={`${source.id}-deal`} cars={cars} kind="deal" day="today" sourceName={source.name} otherHref={null} yesterdayHref={null} />
          </>
        ) : (
          <>
            <div className="hero">
              <h1>Skipped dealers</h1>
              <p className="muted">Cars the bot did not take because the seller looks like a dealer or flipper (several other car ads, or dealership wording). Last 24 hours.</p>
            </div>
            {!skipped.length ? (
              <div className="empty"><h3>No skipped dealers yet</h3><p className="muted">They appear here as the bot filters them out.</p></div>
            ) : (
              <div className="skiplist">
                {skipped.map((d) => (
                  <a key={d.url + d.t} className="skiprow" href={d.url || undefined} target="_blank" rel="noopener noreferrer">
                    <div><b>{d.title || 'Car'}</b><span className="muted"> · {d.location}</span></div>
                    <div className="muted">{usd(d.price)} · {d.why} · {ago(d.t)}</div>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </main>
      <footer className="foot">© {new Date().getFullYear()} {BRAND} · MMR values from Manheim · Listings from public marketplaces</footer>
    </>
  );
}
