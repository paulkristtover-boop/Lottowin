import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { usd } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function ContestsPage() {
  let periods = [];
  let payouts = [];
  let daily = [];
  try {
    const p = await query(
      `SELECT * FROM contest_periods ORDER BY starts_at DESC LIMIT 20`
    );
    periods = p.rows;
    const pay = await query(
      `SELECT cp.*, u.username FROM contest_payouts cp
       LEFT JOIN users u ON u.telegram_id = cp.user_id
       ORDER BY cp.created_at DESC LIMIT 50`
    );
    payouts = pay.rows;

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const board = await query(
      `SELECT t.user_id, u.username, COALESCE(SUM(t.cost_usd),0) AS volume
       FROM tickets t
       LEFT JOIN users u ON u.telegram_id = t.user_id
       WHERE t.created_at >= $1 AND t.cost_usd > 0
       GROUP BY t.user_id, u.username
       ORDER BY volume DESC LIMIT 15`,
      [dayStart.toISOString()]
    );
    daily = board.rows;
  } catch (e) {
    return (
      <AdminShell title="Contests">
        <div className="card">
          <p style={{ color: 'var(--muted)' }}>
            Contest tables not ready. Run <code>scripts/migrate-contests.sql</code> on Postgres.
          </p>
          <pre style={{ fontSize: '0.8rem' }}>{String(e.message)}</pre>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Contests">
      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Today — cash wager leaders (UTC)</h3>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>User</th>
              <th>Volume</th>
            </tr>
          </thead>
          <tbody>
            {daily.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: 'var(--muted)' }}>
                  No cash tickets today
                </td>
              </tr>
            )}
            {daily.map((r, i) => (
              <tr key={r.user_id}>
                <td>{i + 1}</td>
                <td>
                  {r.username ? `@${r.username}` : r.user_id}
                </td>
                <td>{usd(r.volume)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Contest periods</h3>
        <table>
          <thead>
            <tr>
              <th>Kind</th>
              <th>Period</th>
              <th>Pool</th>
              <th>Status</th>
              <th>Ends</th>
            </tr>
          </thead>
          <tbody>
            {periods.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--muted)' }}>
                  No periods settled yet
                </td>
              </tr>
            )}
            {periods.map((r) => (
              <tr key={r.id}>
                <td>{r.kind}</td>
                <td>{r.period_key}</td>
                <td>{usd(r.pool_usd)}</td>
                <td>
                  <span className={`badge ${r.status === 'settled' ? 'green' : 'blue'}`}>
                    {r.status}
                  </span>
                </td>
                <td>{r.ends_at ? new Date(r.ends_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Recent payouts</h3>
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Rank</th>
              <th>Volume</th>
              <th>Prize</th>
            </tr>
          </thead>
          <tbody>
            {payouts.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--muted)' }}>
                  No contest payouts yet
                </td>
              </tr>
            )}
            {payouts.map((r) => (
              <tr key={r.id}>
                <td>{r.username ? `@${r.username}` : r.user_id}</td>
                <td>#{r.rank}</td>
                <td>{usd(r.volume_usd)}</td>
                <td>{usd(r.prize_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
