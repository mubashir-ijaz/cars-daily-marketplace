import Link from 'next/link';
import { SOURCES, getSource } from '@/lib/sources';
import { store, hasDatabase } from '@/lib/db';
import { minProfit } from '@/lib/classify';
import { passwordEnabled } from '@/lib/auth';
import { BRAND, TAGLINE } from '@/lib/brand';
import type { Day, Kind } from '@/lib/types';
import TopBar from './components/TopBar';
import CarsView from './CarsView';

export const dynamic = 'force-dynamic';

type Search = Promise<{ source?: string; tab?: string; day?: string }>;

const Icon = ({ d }: { d: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d={d} /></svg>
);
const I = {
  fb: 'M14 13.5h2.5l1-4H14v-2c0-1 0-2 2-2h1.5V2.14A28 28 0 0 0 14.6 2C11.9 2 10 3.66 10 6.7v2.8H7v4h3V22h4z',
  sun: 'M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10m0-5 2 3h-4zm0 20-2-3h4zM2 12l3-2v4zm20 0-3 2v-4z',
  clock: 'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20m.5 5H11v6l5.2 3.2.8-1.3-4.5-2.7z',
  money: 'M11.8 10.9c-2.3-.6-3-1.2-3-2.1 0-1.1 1-1.8 2.7-1.8 1.8 0 2.4.8 2.5 2.1h2.2a4 4 0 0 0-3.2-3.8V3h-3v2.2C8 5.6 6.6 6.8 6.6 8.8c0 2.3 1.9 3.5 4.8 4.2 2.6.6 3.1 1.5 3.1 2.5 0 .7-.5 1.9-2.7 1.9-2.1 0-2.9-.9-3-2.1H6.6c.1 2.2 1.8 3.5 3.8 3.9V21h3v-2.2c1.9-.4 3.5-1.5 3.5-3.6 0-2.8-2.4-3.8-5.1-4.3',
  search: 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9',
};

export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const source = getSource(sp.source);
  const kind: Kind = sp.tab === 'novin' ? 'novin' : 'deal';
  const day: Day = sp.day === 'yesterday' ? 'yesterday' : 'today';
  await store.prune(source.id).catch(() => 0); // drop cars older than 48 h
  const [cars, counts, allCounts] = await Promise.all([
    store.list(source.id, kind, day),
    store.counts(source.id),
    Promise.all(SOURCES.map(async (s) => {
      const c = await store.counts(s.id);
      return [s.id, c.today.deal + c.today.novin + c.yesterday.deal + c.yesterday.novin] as const;
    })),
  ]);
  const totals = Object.fromEntries(allCounts);
  const min = minProfit();
  const minLabel = `$${min.toLocaleString('en-US')}+`;
  const href = (p: { source?: string; tab?: Kind; day?: Day }) =>
    `/?source=${p.source ?? source.id}&day=${p.day ?? day}&tab=${p.tab ?? kind}`;

  return (
    <>
      <TopBar brand={BRAND} tagline={TAGLINE} canLogout={passwordEnabled()} />

      <div className="layout">
        <aside className="side" aria-label="Filters">
          <div className="grp">
            <div className="gh">Marketplace</div>
            <nav className="opts">
              {SOURCES.map((s) => (
                <Link key={s.id} href={href({ source: s.id })} className={s.id === source.id ? 'on' : ''} aria-current={s.id === source.id ? 'page' : undefined}>
                  <span className="ol"><Icon d={I.fb} /> {s.short}</span> <span className="count">{totals[s.id] ?? 0}</span>
                </Link>
              ))}
              <span className="soon" title="More marketplaces can be added">+ More soon</span>
            </nav>
          </div>
          <div className="grp">
            <div className="gh">When found</div>
            <nav className="opts">
              <Link href={href({ day: 'today' })} className={day === 'today' ? 'on' : ''} aria-current={day === 'today' ? 'page' : undefined}>
                <span className="ol"><Icon d={I.sun} /> Today</span> <span className="count">{counts.today.deal + counts.today.novin}</span>
              </Link>
              <Link href={href({ day: 'yesterday' })} className={day === 'yesterday' ? 'on' : ''} aria-current={day === 'yesterday' ? 'page' : undefined}>
                <span className="ol"><Icon d={I.clock} /> Yesterday</span> <span className="count">{counts.yesterday.deal + counts.yesterday.novin}</span>
              </Link>
            </nav>
          </div>
          <div className="grp">
            <div className="gh">Type</div>
            <nav className="opts">
              <Link href={href({ tab: 'deal' })} className={kind === 'deal' ? 'on' : ''} aria-current={kind === 'deal' ? 'page' : undefined}>
                <span className="ol"><Icon d={I.money} /> Deals {minLabel}</span> <span className="count">{counts[day].deal}</span>
              </Link>
              <Link href={href({ tab: 'novin' })} className={kind === 'novin' ? 'on' : ''} aria-current={kind === 'novin' ? 'page' : undefined}>
                <span className="ol"><Icon d={I.search} /> No VIN</span> <span className="count">{counts[day].novin}</span>
              </Link>
            </nav>
          </div>
          <div className="info">
            <b>How it works</b>
            <p>Private-seller listings are scanned all day and priced against Manheim MMR. Cars show under <b>Today</b> for 24 hours, then <b>Yesterday</b>, and clear after 48 hours. Dealer listings are filtered out.</p>
          </div>
        </aside>

        <main className="wrap">
          {!hasDatabase && (
            <div className="banner">No database connected — cars are kept in memory only. In Vercel, add Upstash Redis under Storage and redeploy.</div>
          )}
          <div className="hero">
            <div>
              <div className="eyebrow">{source.name} · {day === 'today' ? 'Last 24 hours' : '24–48 hours ago'}</div>
              <h1>{kind === 'deal' ? `Deals with ${minLabel} spread` : 'Cars without a VIN'}</h1>
              <p className="muted">
                {kind === 'deal'
                  ? 'Private sellers asking less than Manheim MMR. Biggest spread first.'
                  : 'No VIN in the listing, so MMR can’t be pulled — worth a call or a message to check by hand.'}
              </p>
            </div>
          </div>
          <CarsView key={`${source.id}-${kind}-${day}`} cars={cars} kind={kind} day={day} sourceName={source.name}
            otherHref={kind === 'deal' ? href({ tab: 'novin' }) : href({ tab: 'deal' })}
            yesterdayHref={day === 'today' ? href({ day: 'yesterday' }) : null} />
        </main>
      </div>
      <footer className="foot">© {new Date().getFullYear()} {BRAND} · MMR values from Manheim · Listings from public marketplaces</footer>
    </>
  );
}
