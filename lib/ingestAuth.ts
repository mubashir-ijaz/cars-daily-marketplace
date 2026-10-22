import { NextResponse } from 'next/server';
import { safeEqual } from './auth';

/** Scanners authenticate with `Authorization: Bearer <INGEST_KEY>`. Returns an error response, or null when OK. */
export function checkIngestKey(req: Request): NextResponse | null {
  const key = process.env.INGEST_KEY;
  if (!key) return NextResponse.json({ ok: false, error: 'INGEST_KEY is not set on the server.' }, { status: 500 });
  const auth = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!safeEqual(auth, key)) return NextResponse.json({ ok: false, error: 'Bad ingest key.' }, { status: 401 });
  return null;
}
