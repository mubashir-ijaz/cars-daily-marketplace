export const dynamic = 'force-dynamic';

type Search = Promise<{ error?: string; next?: string }>;

export default async function Login({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  return (
    <div className="login">
      <form action="/api/login" method="post">
        <h1>Cars Daily Marketplace</h1>
        <p>Enter the password to see today&apos;s cars.</p>
        <input type="password" name="password" placeholder="Password" autoComplete="current-password" autoFocus required />
        <input type="hidden" name="next" value={sp.next || '/'} />
        <button type="submit">Open dashboard</button>
        {sp.error && <div className="err">Wrong password.</div>}
      </form>
    </div>
  );
}
