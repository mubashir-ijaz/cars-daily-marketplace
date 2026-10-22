import Link from 'next/link';
import { getSource } from '@/lib/sources';
import { store } from '@/lib/db';
import { passwordEnabled } from '@/lib/auth';
import { BRAND, TAGLINE } from '@/lib/brand';
import TopBar from '../components/TopBar';

export const dynamic = 'force-dynamic';

type Search = Promise<{ source?: string; q?: string }>;

const date = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Every seller the scanner found to be a dealer. Their cars never reach the dashboard.
export default async function DealersPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const source = getSource(sp.source);
  const q = (sp.q ?? '').trim().toLowerCase();
  const all = (await store.dealers(source.id)).sort((a, b) => b.lastSeen - a.lastSeen);
  const list = q ? all.filter((d) => [d.name, d.location, d.reason, ...d.titles].join(' ').toLowerCase().includes(q)) : all;

  return (
    <>
      <TopBar brand={BRAND} tagline={TAGLINE} canLogout={passwordEnabled()} />
      <main className="wrap dealers">
        <div className="hero">
          <div className="eyebrow"><Link href={`/?source=${source.id}`}>← Back to deals</Link></div>
          <h1>Dealers skipped ({all.length})</h1>
          <p className="muted">Sellers with 3+ cars on their {source.name} profile, or whose listings read like a dealership. The scanner skips their cars automatically.</p>
        </div>
        <form className="bar" action="/dealers">
          <input type="hidden" name="source" value={source.id} />
          <label className="searchbox">
            <input type="search" name="q" defaultValue={sp.q ?? ''} placeholder="Search name, city, car…" aria-label="Search dealers" />
          </label>
        </form>
        {!list.length ? (
          <div className="empty"><h3>{all.length ? 'No dealers match' : 'No dealers found yet'}</h3>
            <p className="muted">Dealers are added here as the scanner checks sellers.</p></div>
        ) : (
          <div className="dtable">
            <table>
              <thead><tr><th>Seller</th><th>Cars listed</th><th>Why</th><th>Some of their cars</th><th>Found</th></tr></thead>
              <tbody>
                {list.map((d) => (
                  <tr key={d.id}>
                    <td><a href={`https://www.facebook.com/marketplace/profile/${d.id}/`} target="_blank" rel="noopener noreferrer">{d.name || `Profile ${d.id}`}</a>
                      {d.location && <div className="muted">{d.location}</div>}</td>
                    <td className="num">{d.cars ?? '—'}</td>
                    <td>{d.reason}</td>
                    <td className="muted">{d.titles.slice(0, 3).join(' · ') || '—'}</td>
                    <td className="muted">{date(d.firstSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}
