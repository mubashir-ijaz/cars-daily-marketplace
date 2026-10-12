import type { Car } from './types';
import { getSource } from './sources';
import { minProfit } from './classify';

// Optional email alerts through Resend (resend.com). Set RESEND_API_KEY and
// ALERT_EMAIL_TO in Vercel. Without your own verified domain, Resend only
// delivers to the address you signed up with.

const usd = (n: number | null) => (n == null ? '—' : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US'));
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export async function emailNewCars(source: string, created: Car[], siteUrl: string | null) {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ALERT_EMAIL_TO;
  if (!key || !to || !created.length) return null;
  const deals = created.filter((c) => c.kind === 'deal').sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));
  const novin = created.filter((c) => c.kind === 'novin');
  const src = getSource(source).short;

  const parts: string[] = [];
  if (deals.length) parts.push(`${deals.length} deal${deals.length > 1 ? 's' : ''}`);
  if (novin.length) parts.push(`${novin.length} no-VIN`);
  const best = deals[0]?.profit;
  const subject = `${src}: ${parts.join(', ')}${best != null ? ` — best +${usd(best)}` : ''}`;

  const td = 'padding:6px 10px;border-bottom:1px solid #eee;vertical-align:top';
  const table = (cars: Car[], showMmr: boolean) => `<table style="border-collapse:collapse;font-size:14px">
    <tr style="color:#6b7280;text-align:left"><th style="${td}">Vehicle</th><th style="${td}">Price</th>${showMmr ? `<th style="${td}">MMR</th><th style="${td}">Spread</th>` : ''}<th style="${td}">Miles</th><th style="${td}">Location</th></tr>
    ${cars.map((c) => `<tr><td style="${td}"><a href="${esc(c.url)}">${esc(c.title || 'Vehicle')}</a>${c.vin ? `<div style="color:#6b7280;font-size:12px">${esc(c.vin)}</div>` : ''}</td>
      <td style="${td}">${usd(c.price)}</td>${showMmr ? `<td style="${td}">${usd(c.mmr)}</td><td style="${td};color:#047857;font-weight:700">+${usd(c.profit)}</td>` : ''}
      <td style="${td}">${c.mileage != null ? c.mileage.toLocaleString('en-US') : '—'}</td><td style="${td}">${esc(c.location || '')}</td></tr>`).join('')}
  </table>`;

  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif">
    ${deals.length ? `<h3>New deals (MMR spread ≥ ${usd(minProfit())})</h3>${table(deals, true)}` : ''}
    ${novin.length ? `<h3>New listings without VIN</h3>${table(novin, false)}` : ''}
    ${siteUrl ? `<p><a href="${esc(siteUrl)}">Open the dashboard</a></p>` : ''}
  </div>`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: process.env.ALERT_EMAIL_FROM || 'Cars Daily <onboarding@resend.dev>', to: to.split(',').map((s) => s.trim()), subject, html }),
  });
  if (!r.ok) return `Email failed (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`;
  return 'sent';
}
