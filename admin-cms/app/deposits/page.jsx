import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { usd, dt } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function DepositsPage() {
  const { rows } = await query(
    `SELECT * FROM deposits ORDER BY detected_at DESC LIMIT 100`
  );

  return (
    <AdminShell title="Deposits">
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Chain</th>
              <th>Amount</th>
              <th>USD</th>
              <th>TX</th>
              <th>Status</th>
              <th>Detected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.user_id || '—'}</td>
                <td>{d.chain}</td>
                <td>{Number(d.amount_crypto).toFixed(4)}</td>
                <td>{usd(d.amount_usd)}</td>
                <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.tx_hash?.slice(0, 12)}…
                </td>
                <td>
                  <span className={`badge ${d.status === 'confirmed' ? 'green' : 'yellow'}`}>
                    {d.status}
                  </span>
                </td>
                <td>{dt(d.detected_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
