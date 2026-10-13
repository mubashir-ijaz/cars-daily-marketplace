import Link from 'next/link';
import { SOURCES, getSource } from '@/lib/sources';
import { store, hasDatabase } from '@/lib/db';
import { minProfit } from '@/lib/classify';
import { passwordEnabled } from '@/lib/auth';
import type { Day, Kind } from '@/lib/types';
import CarsView from './CarsView';

export const dynamic = 'force-dynamic';

type Search = Promise<{ source?: string; tab?: string; day?: string }>;

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
  const href = (p: { source?: string; tab?: Kind; day?: Day }) =>
    `/?source=${p.source ?? source.id}&day=${p.day ?? day}&tab=${p.tab ?? kind}`;

  return (
    <>
      <header className="top">
        <div className="top-row">
          <span className="brand">Cars Daily Marketplace</span>
          <span className="spacer" />
          {passwordEnabled() && (
            <form action="/api/logout" method="post"><button className="ghost">Log out</button></form>
          )}
        </div>
      </header>

      <div className="layout">
        <aside className="side" aria-label="Filters">
          <div className="grp">
            <div className="gh">Marketplace</div>
            <div className="opts">
              {SOURCES.map((s) => (
                <Link key={s.id} href={href({ source: s.id })} className={s.id === source.id ? 'on' : ''}>
                  {s.short} <span className="count">{totals[s.id] ?? 0}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="grp">
            <div className="gh">When found</div>
            <div className="opts">
              <Link href={href({ day: 'today' })} className={day === 'today' ? 'on' : ''}>
                Today <span className="count">{counts.today.deal + counts.today.novin}</span>
              </Link>
              <Link href={href({ day: 'yesterday' })} className={day === 'yesterday' ? 'on' : ''}>
                Yesterday <span className="count">{counts.yesterday.deal + counts.yesterday.novin}</span>
              </Link>
            </div>
          </div>
          <div className="grp">
            <div className="gh">Type</div>
            <div className="opts">
              <Link href={href({ tab: 'deal' })} className={kind === 'deal' ? 'on' : ''}>
                Deals ${min.toLocaleString('en-US')}+ <span className="count">{counts[day].deal}</span>
              </Link>
              <Link href={href({ tab: 'novin' })} className={kind === 'novin' ? 'on' : ''}>
                No VIN <span className="count">{counts[day].novin}</span>
              </Link>
            </div>
          </div>
          <p className="note">Cars stay under Today for 24 h, move to Yesterday, and are removed after 48 h. Dealer listings are skipped.</p>
        </aside>

        <main className="wrap">
          {!hasDatabase && (
            <div className="banner">No database connected — cars are kept in memory only. In Vercel, add Upstash Redis under Storage and redeploy.</div>
          )}
          <h1 className="heading">
            {source.name} · {day === 'today' ? 'Today' : 'Yesterday'} · {kind === 'deal' ? `Deals $${min.toLocaleString('en-US')}+` : 'No VIN'}
          </h1>
          <CarsView key={`${source.id}-${kind}-${day}`} cars={cars} kind={kind} day={day} sourceName={source.name} />
        </main>
      </div>
    </>
  );
}
