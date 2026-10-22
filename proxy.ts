import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_COOKIE, isAuthed } from '@/lib/auth';

// Pages need the dashboard password (when DASHBOARD_PASSWORD is set).
// /api/ingest has its own key; /login and /api/login must stay open.
export async function proxy(req: NextRequest) {
  if (await isAuthed(req.cookies.get(AUTH_COOKIE)?.value)) return NextResponse.next();
  if (req.nextUrl.pathname.startsWith('/api/')) return NextResponse.json({ ok: false, error: 'Login required' }, { status: 401 });
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  url.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!login|api/login|api/ingest|api/dealers|api/test-email|_next/|favicon.ico|icon.svg).*)'],
};
