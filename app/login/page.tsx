import { BRAND, TAGLINE } from '@/lib/brand';
import Logo from '../components/Logo';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

type Search = Promise<{ error?: string; next?: string }>;

export default async function Login({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  return (
    <div className="login">
      <section className="login-hero">
        <Logo size={56} />
        <h1>{BRAND}</h1>
        <p className="lead">{TAGLINE}</p>
        <ul>
          <li><b>Every private-seller car</b> on Facebook Marketplace, checked automatically</li>
          <li><b>Priced against Manheim MMR</b> — only cars with $1,000+ spread</li>
          <li><b>Seller phone, title, owners &amp; Carfax</b> pulled from the listing</li>
          <li><b>Instant email alerts</b> the moment a deal appears</li>
        </ul>
      </section>
      <section className="login-card">
        <h2>Welcome back</h2>
        <p className="muted">Sign in to see today&apos;s deals.</p>
        <LoginForm next={sp.next || '/'} error={!!sp.error} />
        <p className="fine">Private dashboard for {BRAND}.</p>
      </section>
    </div>
  );
}
