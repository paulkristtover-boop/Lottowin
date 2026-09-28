import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { usd } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const safe = async (sql) => {
    try { return await query(sql); } catch { return { rows: [{ c: 0, s: 0, wagered: 0, paid: 0 }] }; }
  };

  const [users, bal, tickets, pendingWd, pendingDep, tax, liab] = await Promise.all([
    safe(`SELECT COUNT(*) AS c FROM users`),
    safe(`SELECT COALESCE(SUM(balance_usd),0) AS s FROM users`),
    safe(`SELECT COUNT(*) AS c, COALESCE(SUM(cost_usd),0) AS wagered, COALESCE(SUM(total_prize_usd),0) AS paid FROM tickets`),
    safe(`SELECT COUNT(*) AS c FROM withdrawals WHERE status = 'pending'`),
    safe(`SELECT COUNT(*) AS c FROM deposits WHERE status = 'pending'`),
    safe(`SELECT COALESCE(SUM(tax_amount),0) AS s, COALESCE(SUM(ggr),0) AS g FROM tax_ledger`),
    safe(`SELECT COALESCE(prizes_paid,0) AS s FROM daily_liability WHERE period_date = CURRENT_DATE`),
  ]);

  return (
    <AdminShell title="Dashboard">
      <div className="grid">
        <div className="stat"><div className="label">Users</div><div className="value">{users.rows[0].c}</div></div>
        <div className="stat"><div className="label">User Balances</div><div className="value">{usd(bal.rows[0].s)}</div></div>
        <div className="stat"><div className="label">Tickets</div><div className="value">{tickets.rows[0].c}</div></div>
        <div className="stat"><div className="label">Wagered</div><div className="value">{usd(tickets.rows[0].wagered)}</div></div>
        <div className="stat"><div className="label">Prizes Paid</div><div className="value">{usd(tickets.rows[0].paid)}</div></div>
        <div className="stat"><div className="label">Pending WD</div><div className="value">{pendingWd.rows[0].c}</div></div>
        <div className="stat"><div className="label">Pending Deposits</div><div className="value">{pendingDep.rows[0].c}</div></div>
        <div className="stat"><div className="label">GGR Tax Accrued</div><div className="value">{usd(tax.rows[0].s)}</div></div>
        <div className="stat"><div className="label">Today Liability Used</div><div className="value">{usd(liab.rows[0]?.s || 0)}</div></div>
      </div>
      <div className="card">
        <strong>Startup controls active</strong>
        <ul style={{ color: 'var(--muted)', marginBottom: 0 }}>
          <li>Per-line / per-ticket / daily liability caps</li>
          <li>11% gaming tax ledger (export via /taxexport)</li>
          <li>Age + CAPTCHA gates · Fraud filters · RNG audit</li>
        </ul>
      </div>
    </AdminShell>
  );
}
