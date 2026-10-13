import { BRAND } from './brand';
import nodemailer from 'nodemailer';
import type { Car } from './types';
import { getSource } from './sources';
import { minProfit } from './classify';

// Email alerts when the scanner finds new cars.
//   Gmail (recommended): GMAIL_USER + GMAIL_APP_PASSWORD (a Google "App password").
//   or Resend:           RESEND_API_KEY (+ ALERT_EMAIL_FROM with a verified domain).
// ALERT_EMAIL_TO: comma-separated recipients (defaults to GMAIL_USER).
// EMAIL_NO_VIN=false stops emails about cars without a VIN (they still show on the dashboard).

const usd = (n: number | null) => (n == null ? '—' : (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US'));
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function emailConfigured() {
  return !!((process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) || process.env.RESEND_API_KEY) && recipients().length > 0;
}

function recipients() {
  return (process.env.ALERT_EMAIL_TO || process.env.GMAIL_USER || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export async function sendEmail(subject: string, html: string): Promise<string> {
  const to = recipients();
  if (!to.length) return 'Email not configured (set ALERT_EMAIL_TO or GMAIL_USER).';

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com', port: 465, secure: true,
      auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '') },
    });
    await transport.sendMail({ from: `"Cars Daily" <${process.env.GMAIL_USER}>`, to, subject, html });
    return 'sent';
  }

  if (process.env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.ALERT_EMAIL_FROM || 'Cars Daily <onboarding@resend.dev>', to, subject, html }),
    });
    if (!r.ok) return `Email failed (HTTP ${r.status}): ${(await r.text()).slice(0, 200)}`;
    return 'sent';
  }
  return 'Email not configured (set GMAIL_USER and GMAIL_APP_PASSWORD in Vercel).';
}

// Phone, title, owners, Carfax… one line under the price.
function extras(c: Car) {
  const bits = [c.phone && `📞 <a href="tel:${esc(c.phone.split(',')[0].replace(/D/g, ''))}">${esc(c.phone)}</a>`,
    c.titleStatus && `Title: ${esc(c.titleStatus)}`, c.owners != null && `${c.owners} owner${c.owners > 1 ? 's' : ''}`,
    c.carfax && esc(c.carfax), c.accidents && esc(c.accidents), c.issues && `<span style="color:#b91c1c">${esc(c.issues)}</span>`].filter(Boolean);
  return bits.length ? `<div style="font-size:13px;margin-top:6px">${bits.join(' &nbsp;·&nbsp; ')}</div>` : '';
}

function dealCard(c: Car, dash: string | null) {
  return `<table role="presentation" width="100%" style="border:1px solid #e5e7eb;border-radius:10px;margin:0 0 12px;border-collapse:separate">
    <tr>${c.img ? `<td width="140" style="padding:10px;vertical-align:top"><img src="${esc(c.img)}" width="140" style="display:block;width:140px;border-radius:8px" alt=""></td>` : ''}
    <td style="padding:10px;vertical-align:top;font-size:14px">
      <div style="font-size:16px;font-weight:700"><a href="${esc(c.url)}" style="color:#0f2a4a;text-decoration:none">${esc(c.title || 'Vehicle')}</a></div>
      <div style="color:#6b7280;font-size:13px">${esc([c.location, c.search].filter(Boolean).join(' · '))}</div>
      <div style="margin:8px 0">Asking <b>${usd(c.price)}</b> &nbsp;·&nbsp; MMR <b>${usd(c.mmr)}</b> &nbsp;·&nbsp; ${c.mileage != null ? c.mileage.toLocaleString('en-US') + ' mi' : '— mi'}</div>
      <div style="display:inline-block;background:#ecfdf5;color:#047857;font-weight:800;padding:4px 10px;border-radius:999px">Spread +${usd(c.profit)}</div>
      ${extras(c)}
      ${c.vin ? `<div style="color:#6b7280;font-size:12px;margin-top:6px;font-family:Consolas,monospace">VIN ${esc(c.vin)}${c.mmrName ? ' · ' + esc(c.mmrName) : ''}</div>` : ''}
      <div style="margin-top:8px">
        ${dash ? `<a href="${esc(dash)}&tab=deal#car-${esc(c.id)}" style="background:#0f2a4a;color:#fff;padding:7px 14px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">View on dashboard</a>&nbsp;` : ''}
        <a href="${esc(c.url)}" style="background:#ffffff;color:#0f2a4a;border:1px solid #0f2a4a;padding:6px 13px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">Facebook listing</a>
      </div>
    </td></tr></table>`;
}

export async function emailNewCars(source: string, created: Car[], siteUrl: string | null) {
  if (!emailConfigured() || !created.length) return null;
  const deals = created.filter((c) => c.kind === 'deal').sort((a, b) => (b.profit ?? 0) - (a.profit ?? 0));
  const novin = process.env.EMAIL_NO_VIN === 'false' ? [] : created.filter((c) => c.kind === 'novin');
  if (!deals.length && !novin.length) return null;
  const src = getSource(source).short;

  const parts: string[] = [];
  if (deals.length) parts.push(`${deals.length} deal${deals.length > 1 ? 's' : ''}`);
  if (novin.length) parts.push(`${novin.length} no-VIN`);
  const best = deals[0]?.profit;
  const subject = `${BRAND} · ${src}: ${parts.join(', ')}${best != null ? ` — best +${usd(best)}` : ''}`;

  const td = 'padding:6px 10px;border-bottom:1px solid #eee;vertical-align:top';
  const btn = (href: string, label: string) =>
    `<a href="${esc(href)}" style="display:inline-block;background:#2563eb;color:#fff;padding:11px 20px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px">${label}</a>`;
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:640px">
    ${siteUrl ? `<p style="margin:0 0 16px">${btn(`${siteUrl}&tab=${deals.length ? 'deal' : 'novin'}`, 'Open dashboard — view cars')}</p>` : ''}
    ${deals.length ? `<h2 style="margin:0 0 10px">New deals — MMR spread ${usd(minProfit())}+</h2>${deals.map((c) => dealCard(c, siteUrl)).join('')}` : ''}
    ${novin.length ? `<h3 style="margin:18px 0 6px">No VIN — check these manually</h3>
      ${siteUrl ? `<p style="margin:0 0 8px"><a href="${esc(siteUrl)}&tab=novin">See all no-VIN cars on the dashboard</a></p>` : ''}
      <table style="border-collapse:collapse;font-size:14px">
      <tr style="color:#6b7280;text-align:left"><th style="${td}">Vehicle</th><th style="${td}">Price</th><th style="${td}">Miles</th><th style="${td}">Location</th><th style="${td}">Phone</th></tr>
      ${novin.map((c) => `<tr><td style="${td}"><a href="${esc(c.url)}">${esc(c.title || 'Vehicle')}</a></td><td style="${td}">${usd(c.price)}</td>
        <td style="${td}">${c.mileage != null ? c.mileage.toLocaleString('en-US') : '—'}</td><td style="${td}">${esc(c.location || '')}</td><td style="${td}">${c.phone ? `<a href="tel:${esc(c.phone.split(',')[0].replace(/D/g, ''))}">${esc(c.phone)}</a>` : ''}</td></tr>`).join('')}
      </table>` : ''}
    ${siteUrl ? `<p style="margin-top:18px">${btn(`${siteUrl}&tab=deal`, 'Open dashboard')}</p>` : ''}
  </div>`;
  return sendEmail(subject, html);
}
