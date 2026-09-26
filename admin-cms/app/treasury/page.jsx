import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { usd } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TreasuryPage() {
  const [dep, wd, bal] = await Promise.all([
    query(`SELECT COALESCE(SUM(amount_usd),0) AS s FROM deposits WHERE status = 'confirmed'`),
    query(`SELECT COALESCE(SUM(amount_usd),0) AS s FROM withdrawals WHERE status = 'completed'`),
    query(`SELECT COALESCE(SUM(balance_usd),0) AS s FROM users`),
  ]);

  const deposited = Number(dep.rows[0].s);
  const withdrawn = Number(wd.rows[0].s);
  const liabilities = Number(bal.rows[0].s);
  const net = deposited - withdrawn - liabilities;

  return (
    <AdminShell title="Treasury Overview">
      <div className="grid">
        <div className="stat">
          <div className="label">Total Confirmed Deposits</div>
          <div className="value">{usd(deposited)}</div>
        </div>
        <div className="stat">
          <div className="label">Total Completed Withdrawals</div>
          <div className="value">{usd(withdrawn)}</div>
        </div>
        <div className="stat">
          <div className="label">User Liability (balances)</div>
          <div className="value">{usd(liabilities)}</div>
        </div>
        <div className="stat">
          <div className="label">Net (approx house)</div>
          <div className="value">{usd(net)}</div>
        </div>
      </div>
      <div className="card">
        <p style={{ color: 'var(--muted)' }}>
          House edge comes from unclaimed prizes + the prize table. Always keep enough crypto
          on the treasury addresses to cover outstanding user balances.
        </p>
      </div>
    </AdminShell>
  );
}
