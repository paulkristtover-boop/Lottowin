import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { usd } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TreasuryPage() {
  const [dep, wd, bal, byChain, pendingWd] = await Promise.all([
    query(`SELECT COALESCE(SUM(amount_usd),0) AS s FROM deposits WHERE status = 'confirmed'`).catch(() => ({ rows: [{ s: 0 }] })),
    query(`SELECT COALESCE(SUM(amount_usd),0) AS s FROM withdrawals WHERE status = 'completed'`).catch(() => ({ rows: [{ s: 0 }] })),
    query(`SELECT COALESCE(SUM(balance_usd),0) AS s FROM users`).catch(() => ({ rows: [{ s: 0 }] })),
    query(
      `SELECT chain, COUNT(*)::int AS c, COALESCE(SUM(amount_usd),0) AS s
       FROM deposits WHERE status = 'confirmed'
       GROUP BY chain ORDER BY s DESC`
    ).catch(() => ({ rows: [] })),
    query(`SELECT COUNT(*)::int AS c FROM withdrawals WHERE status = 'pending'`).catch(() => ({ rows: [{ c: 0 }] })),
  ]);

  const deposited = Number(dep.rows[0].s);
  const withdrawn = Number(wd.rows[0].s);
  const liabilities = Number(bal.rows[0].s);
  const net = deposited - withdrawn - liabilities;

  const trc = process.env.TRC20_MASTER_ADDRESS || process.env.USDT_TRC20_ADDRESS || '— set TRC20_MASTER_ADDRESS —';
  const erc = process.env.ERC20_MASTER_ADDRESS || process.env.USDT_ERC20_ADDRESS || '— set ERC20_MASTER_ADDRESS —';
  const sol = process.env.SOL_MASTER_ADDRESS || process.env.USDT_SOL_ADDRESS || '— set SOL_MASTER_ADDRESS —';

  return (
    <AdminShell title="Treasury">
      <div className="grid">
        <div className="stat">
          <div className="label">Confirmed deposits</div>
          <div className="value">{usd(deposited)}</div>
        </div>
        <div className="stat">
          <div className="label">Completed withdrawals</div>
          <div className="value">{usd(withdrawn)}</div>
        </div>
        <div className="stat">
          <div className="label">User balances</div>
          <div className="value">{usd(liabilities)}</div>
        </div>
        <div className="stat">
          <div className="label">Net (approx)</div>
          <div className="value">{usd(net)}</div>
        </div>
        <div className="stat">
          <div className="label">Pending withdrawals</div>
          <div className="value">{pendingWd.rows[0].c}</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Master deposit addresses (USDT)</h3>
        <table>
          <tbody>
            <tr>
              <td><span className="badge blue">TRC-20</span> Tron</td>
              <td><code style={{ wordBreak: 'break-all' }}>{trc}</code></td>
            </tr>
            <tr>
              <td><span className="badge primary">ERC-20</span> Ethereum</td>
              <td><code style={{ wordBreak: 'break-all' }}>{erc}</code></td>
            </tr>
            <tr>
              <td><span className="badge green">SPL</span> Solana</td>
              <td><code style={{ wordBreak: 'break-all' }}>{sol}</code></td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 0 }}>
          Set via bot/CMS env: <code>TRC20_MASTER_ADDRESS</code>, <code>ERC20_MASTER_ADDRESS</code>,{' '}
          <code>SOL_MASTER_ADDRESS</code>, plus <code>ETHERSCAN_API_KEY</code>,{' '}
          <code>TRONGRID_API_KEY</code>, and <code>HELIUS_API_KEY</code> (Solana USDT). Scanner polls
          every 30s (unique-amount match).
        </p>
      </div>

      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Deposits by network</h3>
        <table>
          <thead>
            <tr>
              <th>Chain</th>
              <th>Count</th>
              <th>USD</th>
            </tr>
          </thead>
          <tbody>
            {(byChain.rows || []).length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: 'var(--muted)' }}>No confirmed deposits yet</td>
              </tr>
            )}
            {(byChain.rows || []).map((r) => (
              <tr key={r.chain || 'x'}>
                <td>{r.chain || '—'}</td>
                <td>{r.c}</td>
                <td>{usd(r.s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <p style={{ color: 'var(--muted)', margin: 0 }}>
          Keep enough USDT on both master wallets to cover user balances and pending withdrawals.
          Withdrawals are manual: bot notifies admins with <strong>SEND EXACTLY</strong> unique
          amount → send that exact USDT on-chain → <code>/approve ref txhash</code>. Fee is fixed
          per network and held with the payout; reject refunds amount + fee.
        </p>
      </div>
    </AdminShell>
  );
}
