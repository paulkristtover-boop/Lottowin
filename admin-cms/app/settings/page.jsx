import AdminShell from '@/components/AdminShell';

export default function SettingsPage() {
  return (
    <AdminShell title="Settings">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Env (Railway bot)</h3>
        <ul style={{ color: 'var(--muted)' }}>
          <li><code>TICKET_PRICE_USD</code> default 1</li>
          <li><code>JACKPOT_SHARE_PERCENT</code> default 50</li>
          <li><code>HOUSE_SHARE_PERCENT</code> default 40</li>
          <li><code>DRAW_HOUR_UTC</code> default 19 (= 20:00 WAT)</li>
          <li><code>TELEGRAM_CHANNEL_ID</code> for pot + results</li>
        </ul>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          No Telegram admin bot — manage draws, users, withdrawals here.
        </p>
      </div>
    </AdminShell>
  );
}
