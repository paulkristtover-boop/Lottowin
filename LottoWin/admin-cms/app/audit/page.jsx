import { Suspense } from 'react';
import AdminShell from '@/components/AdminShell';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { query } from '@/lib/db';
import { dt } from '@/lib/format';
import { sp, offset } from '@/lib/filters';

export const dynamic = 'force-dynamic';

export default async function AuditPage({ searchParams }) {
  const params = await searchParams;
  const f = sp(params);
  const conditions = [];
  const values = [];
  let i = 1;

  if (f.q) {
    conditions.push(
      `(CAST(COALESCE(actor_id,0) AS TEXT) ILIKE $${i} OR COALESCE(action,'') ILIKE $${i} OR COALESCE(target_id,'') ILIKE $${i} OR COALESCE(target_type,'') ILIKE $${i})`
    );
    values.push(`%${f.q}%`);
    i++;
  }
  if (f.type) {
    conditions.push(`actor_type = $${i}`);
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
  const countRes = await query(`SELECT COUNT(*)::int AS c FROM audit_logs ${where}`, values);
  const total = countRes.rows[0]?.c || 0;

  const { rows } = await query(
    `SELECT * FROM audit_logs ${where}
     ORDER BY created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, f.limit, offset(f)]
  );

  return (
    <AdminShell title="Audit Log">
      <Suspense fallback={<div className="card">Loading filters…</div>}>
        <FilterBar
          resultCount={total}
          fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'Actor, action, target…' },
            {
              name: 'type',
              label: 'Actor type',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'admin', label: 'Admin' },
                { value: 'user', label: 'User' },
                { value: 'system', label: 'System' },
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
              <th>Actor</th>
              <th>Type</th>
              <th>Action</th>
              <th>Target</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--muted)' }}>
                  No audit entries match
                </td>
              </tr>
            )}
            {rows.map((a) => (
              <tr key={a.id}>
                <td>{a.actor_id || 'system'}</td>
                <td>{a.actor_type}</td>
                <td>{a.action}</td>
                <td>
                  {a.target_type} {a.target_id}
                </td>
                <td>{dt(a.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination base="/audit" filters={f} total={total} />
      </div>
    </AdminShell>
  );
}
