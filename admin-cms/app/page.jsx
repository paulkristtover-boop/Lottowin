import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function usd(n) {
  const x = Number(n) || 0;
  return `$${x.toFixed(x >= 1 ? 2 : 6)}`;
}

export default async function Dashboard() {
  let draw = null;
  let users = 0;
  let pendingWd = 0;
  try {
    draw = (await query(`SELECT * FROM draws ORDER BY draw_date DESC LIMIT 1`)).rows[0];
    users = (await query(`SELECT COUNT(*)::int AS c FROM users`)).rows[0].c;
    pendingWd = (await query(`SELECT COUNT(*)::int AS c FROM withdrawals WHERE status = 'pending'`)).rows[0]?.c || 0;
  } catch (e) {
    return (
      <AdminShell title="Dashboard">
        <div className="card">Run <code>migrate-daily-jackpot.sql</code> — {String(e.message)}</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Dashboard">
      <div className="grid">
        <div className="stat"><div className="label">Users</div><div className="value">{users}</div></div>
        <div className="stat"><div className="label">Today pot</div><div className="value">{usd(draw?.pot_usd)}</div></div>
        <div className="stat"><div className="label">Lines sold</div><div className="value">{draw?.tickets_sold ?? 0}</div></div>
        <div className="stat"><div className="label">Draw status</div><div className="value" style={{ fontSize: '1.1rem' }}>{draw?.status || '—'}</div></div>
        <div className="stat"><div className="label">Pending WD</div><div className="value">{pendingWd}</div></div>
      </div>
      <div className="card">
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Daily Jackpot only · no instant games · admin via CMS (no Telegram admin panel).
          Channel posts: pot updates + draw results. Withdrawals: approve manually after on-chain pay.
        </p>
      </div>
    </AdminShell>
  );
}
