import { Suspense } from 'react';
import AdminShell from '@/components/AdminShell';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { query } from '@/lib/db';
import { dt } from '@/lib/format';
import { sp, offset } from '@/lib/filters';

export const dynamic = 'force-dynamic';

export default async function FraudPage({ searchParams }) {
  const params = await searchParams;
  const f = sp(params);
  const conditions = [];
  const values = [];
  let i = 1;

  if (f.q) {
    conditions.push(`(CAST(user_id AS TEXT) ILIKE $${i} OR COALESCE(reason,'') ILIKE $${i})`);
    values.push(`%${f.q}%`);
    i++;
  }
  if (f.status === 'open') conditions.push(`resolved = FALSE`);
  else if (f.status === 'resolved') conditions.push(`resolved = TRUE`);
  if (f.type) {
    conditions.push(`severity = $${i}`);
    values.push(f.type);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRes = await query(`SELECT COUNT(*)::int AS c FROM fraud_flags ${where}`, values);
  const total = countRes.rows[0]?.c || 0;

  const { rows } = await query(
    `SELECT * FROM fraud_flags ${where}
     ORDER BY created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, f.limit, offset(f)]
  );

  return (
    <AdminShell title="Fraud Flags">
      <Suspense fallback={<div className="card">Loading filters…</div>}>
        <FilterBar
          resultCount={total}
          fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'User ID, reason…' },
            {
              name: 'status',
              label: 'Resolved',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'open', label: 'Open' },
                { value: 'resolved', label: 'Resolved' },
              ],
            },
            {
              name: 'type',
              label: 'Severity',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ],
            },
          ]}
        />
      </Suspense>
      <div className="card table-responsive">
        <table>
          <thead>
            <tr>
              <th>User</th>
              <th>Reason</th>
              <th>Severity</th>
              <th>Resolved</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--muted)' }}>
                  No fraud flags match
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.user_id}</td>
                <td>{row.reason}</td>
                <td>
                  <span
                    className={`badge ${
                      row.severity === 'high' ? 'red' : row.severity === 'medium' ? 'yellow' : ''
                    }`}
                  >
                    {row.severity}
                  </span>
                </td>
                <td>{row.resolved ? 'Yes' : 'No'}</td>
                <td>{dt(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination base="/fraud" filters={f} total={total} />
      </div>
    </AdminShell>
  );
}
