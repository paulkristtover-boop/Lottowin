import AdminShell from '@/components/AdminShell';
import MaintenancePanel from '@/components/MaintenancePanel';
import { query } from '@/lib/db';
import { usd } from '@/lib/format';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function OpsPage() {
  let termsCount = 0;
  let users = 0;
  try {
    const t = await query(
      `SELECT COUNT(*)::int AS c FROM users WHERE terms_accepted_at IS NOT NULL`
    );
    termsCount = t.rows[0]?.c || 0;
    const u = await query(`SELECT COUNT(*)::int AS c FROM users`);
    users = u.rows[0]?.c || 0;
  } catch {
    /* columns may not exist yet */
  }

  let pendingWd = 0;
  let pendingDep = 0;
  try {
    const w = await query(`SELECT COUNT(*)::int AS c FROM withdrawals WHERE status = 'pending'`);
    pendingWd = w.rows[0]?.c || 0;
    const d = await query(
      `SELECT COUNT(*)::int AS c FROM deposit_intents WHERE status = 'pending' AND expires_at > NOW()`
    ).catch(() => ({ rows: [{ c: 0 }] }));
    pendingDep = d.rows[0]?.c || 0;
  } catch {
    /* ignore */
  }

  return (
    <AdminShell title="Ops & Maintenance">
      <div className="grid">
        <div className="stat">
          <div className="label">Pending withdrawals</div>
          <div className="value">{pendingWd}</div>
        </div>
        <div className="stat">
          <div className="label">Open deposit intents</div>
          <div className="value">{pendingDep}</div>
        </div>
        <div className="stat">
          <div className="label">Terms accepted</div>
          <div className="value">
            {termsCount}
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)', fontWeight: 500 }}>
              {' '}
              / {users}
            </span>
          </div>
        </div>
      </div>

      <MaintenancePanel />

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Quick links</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <Link href="/withdrawals" className="btn">
            Withdrawals
          </Link>
          <Link href="/deposits" className="btn ghost">
            Deposits
          </Link>
          <Link href="/contests" className="btn ghost">
            Contests
          </Link>
          <Link href="/broadcast" className="btn ghost">
            Broadcast “we&apos;re back”
          </Link>
          <Link href="/settings" className="btn ghost">
            Settings
          </Link>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 0, marginTop: '1rem' }}>
          After maintenance: turn OFF here or <code>/maintenance off</code> in Telegram, then broadcast
          users to send <code>/start</code>.
        </p>
      </div>
    </AdminShell>
  );
}
