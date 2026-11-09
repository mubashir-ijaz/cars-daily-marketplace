import type { BotStatus } from '@/lib/status';

const ago = (t: number) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  if (m < 1440) return `${Math.round(m / 60)} h ago`;
  return `${Math.round(m / 1440)} d ago`;
};

/** Top card: is the bot working, which places it covers, and the filters it applies. */
export default function BotStatusCard({ status }: { status: BotStatus | null }) {
  const fresh = !!status && Date.now() - status.at < 20 * 60_000; // the extension reports every few minutes
  const state = !status ? 'off' : !fresh ? 'off' : status.running ? 'run' : 'idle';
  const label = state === 'run' ? 'Bot is running' : state === 'idle' ? 'Bot is on · waiting for the next scan' : 'Bot offline';
  const sub = !status
    ? 'No report from the scanner yet. Open the extension and click Scan now.'
    : !fresh ? `Last report ${ago(status.at)}. Check that Chrome and the extension are open.`
    : state === 'run' ? `Now checking: ${status.current || '…'}`
    : status.lastScan ? `Last scan ${ago(status.lastScan)}` : 'Waiting';
  const pct = status && status.round.total ? Math.min(100, Math.round((status.round.done / status.round.total) * 100)) : 0;
  return (
    <section className="bot" aria-label="Bot status">
      <div className="bot-head">
        <span className={`bdot ${state}`} />
        <div>
          <div className="bot-title">{label}</div>
          <div className="bot-sub">{sub}</div>
        </div>
        {status && fresh && (
          <div className="bot-nums">
            <div><b>{status.today.checked}</b><span>cars checked</span></div>
            <div><b>{status.today.good}</b><span>good deals</span></div>
            <div><b>{status.today.skipped}</b><span>filtered out</span></div>
          </div>
        )}
      </div>
      {status && (
        <div className="bot-grid">
          <div>
            <div className="gh">Filters running</div>
            <ul className="flt">
              {status.filters.map(([k, v]) => <li key={k}><span>{k}</span><b>{v}</b></li>)}
            </ul>
            {!!status.today.reasons.length && (
              <details className="why">
                <summary>Why cars were filtered out</summary>
                <ul className="flt">{status.today.reasons.map(([k, n]) => <li key={k}><span>{k}</span><b>{n}</b></li>)}</ul>
              </details>
            )}
          </div>
          <div>
            <div className="gh">Locations · round {status.round.done}/{status.round.total} ({pct}%)</div>
            <div className="bar-p"><i style={{ width: `${pct}%` }} /></div>
            <div className="states">
              {status.byState.map((st) => (
                <div key={st.name} className="strow">
                  <span>{st.name}</span>
                  <i><u style={{ width: `${st.total ? Math.round((st.done / st.total) * 100) : 0}%` }} /></i>
                  <b>{st.done}/{st.total}</b>
                </div>
              ))}
            </div>
            {!!status.areas.length && (
              <details className="why">
                <summary>Recently scanned cities ({status.areas.length})</summary>
                <div className="locs">{status.areas.map((a) => <span key={a.name} className="loc done">{a.name}</span>)}</div>
              </details>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
