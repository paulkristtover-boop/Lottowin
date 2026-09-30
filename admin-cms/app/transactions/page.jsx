import { Suspense } from 'react';
import AdminShell from '@/components/AdminShell';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { query } from '@/lib/db';
import { usd, dt } from '@/lib/format';
import { sp, offset } from '@/lib/filters';

export const dynamic = 'force-dynamic';

export default async function TransactionsPage({ searchParams }) {
  const params = await searchParams;
  const f = sp(params);
  const conditions = [];
  const values = [];
  let i = 1;

  if (f.q) {
    conditions.push(`CAST(user_id AS TEXT) ILIKE $${i}`);
    values.push(`%${f.q}%`);
    i++;
  }
  if (f.type) {
    conditions.push(`type = $${i}`);
    values.push(f.type);
    i++;
  }
  if (f.from) {
    conditions.push(`created_at >= $${i}::date`);
    values.push(f.from);
    i++;
  }
  if (f.to) {
    conditions.push(`created_at < ($${i}::date + INTERVAL '1 day')`);
    values.push(f.to);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRes = await query(`SELECT COUNT(*)::int AS c FROM transactions ${where}`, values);
  const total = countRes.rows[0]?.c || 0;

  const { rows } = await query(
    `SELECT * FROM transactions ${where}
     ORDER BY created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, f.limit, offset(f)]
  );

  return (
    <AdminShell title="Transactions">
      <Suspense fallback={<div className="card">Loading filters…</div>}>
        <FilterBar
          resultCount={total}
          fields={[
            { name: 'q', label: 'User ID', type: 'text', placeholder: 'Telegram ID…' },
            {
              name: 'type',
              label: 'Type',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'deposit', label: 'Deposit' },
                { value: 'withdraw', label: 'Withdraw' },
                { value: 'play', label: 'Play' },
                { value: 'win', label: 'Win' },
                { value: 'bonus', label: 'Bonus' },
                { value: 'referral', label: 'Referral' },
                { value: 'adjustment', label: 'Adjustment' },
              ],
            },
            { name: 'from', label: 'From', type: 'date' },
            { name: 'to', label: 'To', type: 'date' },
          ]}
        />
      </Suspense>
      <div className="card table-responsive">
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
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--muted)' }}>
                  No transactions match
                </td>
              </tr>
            )}
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
        <Pagination base="/transactions" filters={f} total={total} />
      </div>
    </AdminShell>
  );
}
