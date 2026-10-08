'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, pass }),
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setErr('Invalid username or password');
        setLoading(false);
      }
    } catch {
      setErr('Network error — try again');
      setLoading(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-brand">🎰</div>
        <h1>LottoWin</h1>
        <p className="sub">Admin CMS · Insta Win 4/40 &amp; 3/30</p>
        <form onSubmit={submit}>
          <label htmlFor="user">Username</label>
          <input
            id="user"
            name="username"
            placeholder="Admin username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            autoFocus
            required
            disabled={loading}
          />
          <label htmlFor="pass">Password</label>
          <input
            id="pass"
            name="password"
            type="password"
            placeholder="Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            required
            disabled={loading}
          />
          {err && (
            <div className="flash err" role="alert">
              {err}
            </div>
          )}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
