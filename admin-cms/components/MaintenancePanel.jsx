'use client';

import { useEffect, useState } from 'react';

export default function MaintenancePanel() {
  const [on, setOn] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    fetch('/api/maintenance')
      .then((r) => r.json())
      .then((d) => {
        setOn(!!d.maintenance);
        setMessage(d.message || '');
      })
      .catch(() => setFlash('Could not load status'))
      .finally(() => setLoading(false));
  }, []);

  async function save(nextOn) {
    setSaving(true);
    setFlash('');
    try {
      const res = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ on: nextOn, message }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Failed');
      setOn(!!d.maintenance);
      setFlash(nextOn ? 'Maintenance ON — users blocked on bot' : 'Maintenance OFF — bot open');
    } catch (e) {
      setFlash(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="card">Loading maintenance status…</div>;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>🛠️ Maintenance mode</h3>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
        When ON, non-admin Telegram users only see the maintenance message. Admins keep full access.
        Same flag as bot <code>/maintenance on|off</code>.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
        <span className={`badge ${on ? 'red' : 'green'}`}>{on ? 'ON' : 'OFF'}</span>
        <button type="button" className="btn" disabled={saving || on} onClick={() => save(true)}>
          Turn ON
        </button>
        <button type="button" className="btn ghost" disabled={saving || !on} onClick={() => save(false)}>
          Turn OFF
        </button>
      </div>
      <label htmlFor="mm">Custom message (optional)</label>
      <textarea
        id="mm"
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="🛠️ We are updating LottoWin. Please try again shortly."
        style={{ width: '100%', marginTop: '0.35rem' }}
      />
      <button
        type="button"
        className="btn ghost"
        style={{ marginTop: '0.75rem' }}
        disabled={saving}
        onClick={() => save(on)}
      >
        Save message
      </button>
      {flash && (
        <div className={`flash ${on && flash.includes('ON') ? 'err' : 'ok'}`} style={{ marginTop: '0.85rem' }}>
          {flash}
        </div>
      )}
    </div>
  );
}
