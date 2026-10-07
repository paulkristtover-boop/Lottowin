import { Suspense } from 'react';
import AdminShell from '@/components/AdminShell';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { query } from '@/lib/db';
import { usd, dt } from '@/lib/format';
import { sp, offset } from '@/lib/filters';

export const dynamic = 'force-dynamic';

export default async function WithdrawalsPage({ searchParams }) {
  const params = await searchParams;
  const f = sp(params);
  const conditions = [];
  const values = [];
  let i = 1;

  if (f.q) {
    conditions.push(
      `(CAST(w.user_id AS TEXT) ILIKE $${i} OR COALESCE(u.username,'') ILIKE $${i} OR COALESCE(w.address,'') ILIKE $${i} OR CAST(w.id AS TEXT) ILIKE $${i})`
    );
    values.push(`%${f.q}%`);
    i++;
  }
  if (f.status) {
    conditions.push(`w.status = $${i}`);
    values.push(f.status);
    i++;
  }
  if (f.chain) {
    conditions.push(`w.chain ILIKE $${i}`);
    values.push(`%${f.chain}%`);
    i++;
  }
  if (f.from) {
    conditions.push(`w.requested_at >= $${i}::date`);
    values.push(f.from);
    i++;
  }
  if (f.to) {
    conditions.push(`w.requested_at < ($${i}::date + INTERVAL '1 day')`);
    values.push(f.to);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRes = await query(
    `SELECT COUNT(*)::int AS c FROM withdrawals w
     LEFT JOIN users u ON u.telegram_id = w.user_id ${where}`,
    values
  );
  const total = countRes.rows[0]?.c || 0;

  const { rows } = await query(
    `SELECT w.*, u.username FROM withdrawals w
     LEFT JOIN users u ON u.telegram_id = w.user_id
     ${where}
     ORDER BY w.requested_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, f.limit, offset(f)]
  );

  return (
    <AdminShell title="Withdrawals">
      <Suspense fallback={<div className="card">Loading filters…</div>}>
        <FilterBar
          resultCount={total}
          fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'User, address, ref ID…' },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'completed', label: 'Completed' },
                { value: 'rejected', label: 'Rejected' },
              ],
            },
            {
              name: 'chain',
              label: 'Chain',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'trc20', label: 'TRC-20' },
                { value: 'erc20', label: 'ERC-20' },
                { value: 'usdt_trc20', label: 'usdt_trc20' },
                { value: 'usdt_erc20', label: 'usdt_erc20' },
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
              <th>Ref</th>
              <th>User</th>
              <th>Amount</th>
              <th>Chain</th>
              <th>Address</th>
              <th>Status</th>
              <th>Requested</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: 'var(--muted)' }}>
                  No withdrawals match
                </td>
              </tr>
            )}
            {rows.map((w) => (
              <tr key={w.id}>
                <td style={{ fontSize: '0.75rem' }}>{String(w.id).slice(0, 8)}…</td>
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
                      w.status === 'completed' ? 'green' : w.status === 'rejected' ? 'red' : 'yellow'
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
        <Pagination base="/withdrawals" filters={f} total={total} />
      </div>
    </AdminShell>
  );
}
