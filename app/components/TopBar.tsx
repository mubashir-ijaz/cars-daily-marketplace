'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from './Logo';

export default function TopBar({ brand, tagline, canLogout }: { brand: string; tagline: string; canLogout: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [updated, setUpdated] = useState(() => Date.now());
  const [, tick] = useState(0);

  // Pull new cars every 2 minutes while the tab is visible; keep the "updated" label fresh.
  useEffect(() => {
    const t = setInterval(() => {
      tick((x) => x + 1);
      if (!document.hidden && Date.now() - updated > 120_000) refresh();
    }, 30_000);
    return () => clearInterval(t);
  });

  function refresh() {
    start(() => { router.refresh(); setUpdated(Date.now()); });
  }

  const mins = Math.floor((Date.now() - updated) / 60000);
  return (
    <header className="top">
      <div className="top-row">
        <Link href="/" className="brand" aria-label={`${brand} home`}>
          <Logo />
          <span className="brand-text">
            <span className="brand-name">{brand}</span>
            <span className="brand-tag">{tagline}</span>
          </span>
        </Link>
        <span className="spacer" />
        <span className="live" title="Dashboard refreshes automatically every 2 minutes">
          <span className="dot" /> {pending ? 'Updating…' : mins < 1 ? 'Live · just now' : `Live · ${mins} min ago`}
        </span>
        <button className="ghost" onClick={refresh} disabled={pending} aria-label="Refresh now" title="Refresh now">
          <svg width="16" height="16" viewBox="0 0 24 24" className={pending ? 'spin' : ''} aria-hidden="true"><path fill="currentColor" d="M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z" /></svg>
          <span className="hide-sm">Refresh</span>
        </button>
        {canLogout && (
          <form action="/api/logout" method="post">
            <button className="ghost" aria-label="Log out" title="Log out">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M10 17v-3H3v-4h7V7l5 5zM12 3h7a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-7v-2h7V5h-7z" /></svg>
              <span className="hide-sm">Log out</span>
            </button>
          </form>
        )}
      </div>
    </header>
  );
}
