import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { usd, dt } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage() {
  const { rows } = await query(
    `SELECT * FROM transactions ORDER BY created_at DESC LIMIT 150`
  );

  return (
    <AdminShell title="Transactions">
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Balance After</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td>{t.user_id}</td>
                <td>{t.type}</td>
                <td style={{ color: Number(t.amount_usd) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {usd(t.amount_usd)}
                </td>
                <td>{usd(t.balance_after)}</td>
                <td>{dt(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
