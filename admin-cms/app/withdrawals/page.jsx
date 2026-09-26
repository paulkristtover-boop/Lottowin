import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { usd, dt } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function WithdrawalsPage() {
  const { rows } = await query(
    `SELECT w.*, u.username FROM withdrawals w
     LEFT JOIN users u ON u.telegram_id = w.user_id
     ORDER BY requested_at DESC LIMIT 100`
  );

  return (
    <AdminShell title="Withdrawals">
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Amount</th>
              <th>Chain</th>
              <th>Address</th>
              <th>Status</th>
              <th>Requested</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id}>
                <td>
                  {w.user_id} {w.username ? `(@${w.username})` : ''}
                </td>
                <td>{usd(w.amount_usd)}</td>
                <td>{w.chain}</td>
                <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {w.address}
                </td>
                <td>
                  <span
                    className={`badge ${
                      w.status === 'completed'
                        ? 'green'
                        : w.status === 'rejected'
                        ? 'red'
                        : 'yellow'
                    }`}
                  >
                    {w.status}
                  </span>
                </td>
                <td>{dt(w.requested_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>
        Approve/reject via Telegram bot: <code>/approve &lt;id&gt; [txhash]</code> or{' '}
        <code>/reject &lt;id&gt; reason</code>
      </p>
    </AdminShell>
  );
}
