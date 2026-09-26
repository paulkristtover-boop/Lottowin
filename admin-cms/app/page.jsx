import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { usd } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const [users, bal, tickets, pendingWd, pendingDep] = await Promise.all([
    query(`SELECT COUNT(*) AS c FROM users`),
    query(`SELECT COALESCE(SUM(balance_usd),0) AS s FROM users`),
    query(
      `SELECT COUNT(*) AS c, COALESCE(SUM(cost_usd),0) AS wagered, COALESCE(SUM(total_prize_usd),0) AS paid FROM tickets`
    ),
    query(`SELECT COUNT(*) AS c FROM withdrawals WHERE status = 'pending'`),
    query(`SELECT COUNT(*) AS c FROM deposits WHERE status = 'pending'`),
  ]);

  return (
    <AdminShell title="Dashboard">
      <div className="grid">
        <div className="stat">
          <div className="label">Users</div>
          <div className="value">{users.rows[0].c}</div>
        </div>
        <div className="stat">
          <div className="label">User Balances</div>
          <div className="value">{usd(bal.rows[0].s)}</div>
        </div>
        <div className="stat">
          <div className="label">Tickets</div>
          <div className="value">{tickets.rows[0].c}</div>
        </div>
        <div className="stat">
          <div className="label">Total Wagered</div>
          <div className="value">{usd(tickets.rows[0].wagered)}</div>
        </div>
        <div className="stat">
          <div className="label">Prizes Paid</div>
          <div className="value">{usd(tickets.rows[0].paid)}</div>
        </div>
        <div className="stat">
          <div className="label">Pending Withdrawals</div>
          <div className="value">{pendingWd.rows[0].c}</div>
        </div>
        <div className="stat">
          <div className="label">Pending Deposits</div>
          <div className="value">{pendingDep.rows[0].c}</div>
        </div>
      </div>
    </AdminShell>
  );
}
