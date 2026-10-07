'use client';

import { useState } from 'react';

export default function MessageForm() {
  const [telegramId, setTelegramId] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setOk(false);
    try {
      const res = await fetch('/api/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramId, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setOk(true);
      setMessage('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <form onSubmit={submit}>
        <label>User Telegram ID</label>
        <input
          value={telegramId}
          onChange={(e) => setTelegramId(e.target.value)}
          placeholder="e.g. 123456789"
          required
        />
        <label>Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Your support reply…"
          required
        />
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Sending…' : 'Send official message'}
        </button>
      </form>
      {error && <div className="flash err" style={{ marginTop: '0.75rem' }}>{error}</div>}
      {ok && <div className="flash ok" style={{ marginTop: '0.75rem' }}>Delivered</div>}
    </div>
  );
}
