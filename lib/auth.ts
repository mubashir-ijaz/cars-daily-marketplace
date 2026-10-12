// Optional password for the dashboard. Set DASHBOARD_PASSWORD in Vercel to turn
// it on. The cookie holds a hash of the password, never the password itself.
// Uses Web Crypto so it works in middleware (edge) and in route handlers.

export const AUTH_COOKIE = 'cdm_auth';

export const passwordEnabled = () => !!process.env.DASHBOARD_PASSWORD;

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const authToken = () => sha256(`cdm:v1:${process.env.DASHBOARD_PASSWORD ?? ''}`);

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function isAuthed(cookieValue: string | undefined) {
  if (!passwordEnabled()) return true;
  return !!cookieValue && safeEqual(cookieValue, await authToken());
}
