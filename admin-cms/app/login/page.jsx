'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setErr('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, pass }),
    });
    if (res.ok) {
      router.push('/');
      router.refresh();
    } else {
      setErr('Invalid credentials');
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <h1>🎰 LottoWin</h1>
        <p className="sub">Admin CMS · Insta Win 4/40 &amp; 3/30</p>
        <form onSubmit={submit}>
          <label htmlFor="user">Username</label>
          <input
            id="user"
            placeholder="Admin username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
            required
          />
          <label htmlFor="pass" style={{ marginTop: '0.75rem' }}>
            Password
          </label>
          <input
            id="pass"
            type="password"
            placeholder="Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
            required
          />
          {err && (
            <div className="flash err" style={{ marginTop: '0.85rem', marginBottom: 0 }}>
              {err}
            </div>
          )}
          <button type="submit" className="btn">
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
