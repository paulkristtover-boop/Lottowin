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
      <div className="login-box">
        <h2 style={{ marginTop: 0 }}>LottoWin Admin</h2>
        <form onSubmit={submit}>
          <input
            placeholder="Username"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            autoComplete="username"
          />
          <input
            type="password"
            placeholder="Password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            autoComplete="current-password"
          />
          {err && <p style={{ color: 'var(--red)', fontSize: '0.9rem' }}>{err}</p>}
          <button type="submit" className="btn" style={{ width: '100%' }}>
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
