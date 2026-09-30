import { Suspense } from 'react';
import AdminShell from '@/components/AdminShell';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { query } from '@/lib/db';
import { usd, dt } from '@/lib/format';
import { sp, offset } from '@/lib/filters';

export const dynamic = 'force-dynamic';

export default async function DepositsPage({ searchParams }) {
  const params = await searchParams;
  const f = sp(params);
  const conditions = [];
  const values = [];
  let i = 1;

  if (f.q) {
    conditions.push(
      `(CAST(user_id AS TEXT) ILIKE $${i} OR COALESCE(tx_hash,'') ILIKE $${i} OR COALESCE(chain,'') ILIKE $${i})`
    );
    values.push(`%${f.q}%`);
    i++;
  }
  if (f.status) {
    conditions.push(`status = $${i}`);
    values.push(f.status);
    i++;
  }
  if (f.chain) {
    conditions.push(`chain ILIKE $${i}`);
    values.push(`%${f.chain}%`);
    i++;
  }
  if (f.from) {
    conditions.push(`detected_at >= $${i}::date`);
    values.push(f.from);
    i++;
  }
  if (f.to) {
    conditions.push(`detected_at < ($${i}::date + INTERVAL '1 day')`);
    values.push(f.to);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRes = await query(`SELECT COUNT(*)::int AS c FROM deposits ${where}`, values);
  const total = countRes.rows[0]?.c || 0;

  const { rows } = await query(
    `SELECT * FROM deposits ${where}
     ORDER BY detected_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, f.limit, offset(f)]
  );

  return (
    <AdminShell title="Deposits">
      <Suspense fallback={<div className="card">Loading filters…</div>}>
        <FilterBar
          resultCount={total}
          fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'User ID, TX hash…' },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'confirmed', label: 'Confirmed' },
                { value: 'failed', label: 'Failed' },
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
              <th>User</th>
              <th>Chain</th>
              <th>Crypto</th>
              <th>USD</th>
              <th>TX</th>
              <th>Status</th>
              <th>Detected</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} style={{ color: 'var(--muted)' }}>
                  No deposits match
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.user_id || '—'}</td>
                <td>{d.chain}</td>
                <td>{Number(d.amount_crypto).toFixed(4)}</td>
                <td>{usd(d.amount_usd)}</td>
                <td style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.tx_hash ? `${d.tx_hash.slice(0, 14)}…` : '—'}
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
        <Pagination base="/deposits" filters={f} total={total} />
      </div>
    </AdminShell>
  );
}
