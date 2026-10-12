import { NextResponse } from 'next/server';
import { AUTH_COOKIE, authToken, passwordEnabled, safeEqual } from '@/lib/auth';

export async function POST(req: Request) {
  const form = await req.formData();
  const password = String(form.get('password') ?? '');
  const next = String(form.get('next') ?? '/');
  const dest = new URL(next.startsWith('/') && !next.startsWith('//') ? next : '/', req.url);

  if (!passwordEnabled()) return NextResponse.redirect(dest, 303);
  if (!safeEqual(password, process.env.DASHBOARD_PASSWORD!)) {
    const back = new URL('/login', req.url);
    back.searchParams.set('error', '1');
    back.searchParams.set('next', dest.pathname + dest.search);
    return NextResponse.redirect(back, 303);
  }
  const res = NextResponse.redirect(dest, 303);
  res.cookies.set(AUTH_COOKIE, await authToken(), {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 60,
  });
  return res;
}
