'use client';

import { useState } from 'react';

export default function LoginForm({ next, error }: { next: string; error: boolean }) {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <form action="/api/login" method="post" onSubmit={() => setBusy(true)}>
      <label htmlFor="pw" className="lbl">Password</label>
      <div className="pw">
        <input id="pw" type={show ? 'text' : 'password'} name="password" placeholder="Enter your password" autoComplete="current-password" autoFocus required />
        <button type="button" className="eye" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      <input type="hidden" name="next" value={next} />
      {error && <div className="err" role="alert">That password is not correct. Please try again.</div>}
      <button type="submit" className="go" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
