import { NextResponse } from 'next/server';
import { safeEqual } from '@/lib/auth';
import { sendEmail } from '@/lib/notify';

export const dynamic = 'force-dynamic';

// Open https://<your-site>/api/test-email?key=<INGEST_KEY> to send yourself a test email.
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get('key') ?? '';
  if (!process.env.INGEST_KEY || !safeEqual(key, process.env.INGEST_KEY)) {
    return NextResponse.json({ ok: false, error: 'Add ?key=<your INGEST_KEY> to the URL.' }, { status: 401 });
  }
  try {
    const result = await sendEmail('Cars Daily test email', '<p style="font-family:system-ui,Arial">Email alerts are working. You will get an email like this when the scanner finds a deal.</p>');
    return NextResponse.json({ ok: result === 'sent', result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 });
  }
}
