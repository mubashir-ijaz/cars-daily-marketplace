import Link from 'next/link';
import { SOURCES, getSource } from '@/lib/sources';
import { store, hasDatabase } from '@/lib/db';
import { minProfit } from '@/lib/classify';
import { passwordEnabled } from '@/lib/auth';
import type { Kind } from '@/lib/types';
import CarsView from './CarsView';

export const dynamic = 'force-dynamic';

type Search = Promise<{ source?: string; tab?: string }>;

export default async function Page({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const source = getSource(sp.source);
  const kind: Kind = sp.tab === 'novin' ? 'novin' : 'deal';
  const [cars, counts] = await Promise.all([store.list(source.id, kind), store.counts(source.id)]);
  const min = minProfit();

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
        <nav className="sources" aria-label="Marketplaces">
          {SOURCES.map((s) => (
            <Link key={s.id} href={`/?source=${s.id}`} className={s.id === source.id ? 'on' : ''}>{s.short}</Link>
          ))}
        </nav>
      </header>

      <main className="wrap">
        {!hasDatabase && (
          <div className="banner">No database connected — cars are kept in memory only. In Vercel, add Upstash Redis under Storage and redeploy.</div>
        )}
        <div className="kinds">
          <Link href={`/?source=${source.id}&tab=deal`} className={kind === 'deal' ? 'on' : ''}>
            Deals ${min.toLocaleString('en-US')}+ <span className="count">{counts.deal}</span>
          </Link>
          <Link href={`/?source=${source.id}&tab=novin`} className={kind === 'novin' ? 'on' : ''}>
            No VIN <span className="count">{counts.novin}</span>
          </Link>
        </div>
        <CarsView key={`${source.id}-${kind}`} cars={cars} kind={kind} sourceName={source.name} />
      </main>
    </>
  );
}
