import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AUTH_COOKIE, isAuthed } from '@/lib/auth';
import { isSource } from '@/lib/sources';
import { store } from '@/lib/db';

// Hide a car from the dashboard (sold, bad deal, already called...).
// { hidden: false } un-hides it (Undo).
export async function POST(req: Request) {
  const jar = await cookies();
  if (!(await isAuthed(jar.get(AUTH_COOKIE)?.value))) return NextResponse.json({ ok: false }, { status: 401 });
  const { source, id, hidden } = (await req.json().catch(() => ({}))) as { source?: unknown; id?: unknown; hidden?: unknown };
  if (!isSource(source) || typeof id !== 'string') return NextResponse.json({ ok: false }, { status: 400 });
  await store.hide(source, id, hidden !== false);
  return NextResponse.json({ ok: true });
}
