'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BroadcastForm() {
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, audience }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult(data);
      setMessage('');
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Send broadcast</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
        Admin accounts are excluded. Requires <code>BOT_TOKEN</code> on the CMS environment.
      </p>
      <form onSubmit={submit}>
        <label>Audience</label>
        <select value={audience} onChange={(e) => setAudience(e.target.value)}>
          <option value="all">All players</option>
          <option value="active">Active (7 days)</option>
          <option value="depositors">Depositors only</option>
        </select>
        <label>Message (Markdown supported)</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Your announcement…"
          required
        />
        <button type="submit" className="btn" disabled={loading || !message.trim()}>
          {loading ? 'Sending…' : 'Send broadcast'}
        </button>
      </form>
      {error && <div className="flash err" style={{ marginTop: '0.75rem' }}>{error}</div>}
      {result && (
        <div className="flash ok" style={{ marginTop: '0.75rem' }}>
          Sent {result.sent} / {result.total} (failed {result.fail})
        </div>
      )}
    </div>
  );
}
