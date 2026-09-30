import { Suspense } from 'react';
import AdminShell from '@/components/AdminShell';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { query } from '@/lib/db';
import { dt } from '@/lib/format';
import { sp, offset } from '@/lib/filters';

export const dynamic = 'force-dynamic';

export default async function SupportPage({ searchParams }) {
  const params = await searchParams;
  const f = sp(params);
  const conditions = [];
  const values = [];
  let i = 1;

  if (f.q) {
    conditions.push(
      `(CAST(s.user_id AS TEXT) ILIKE $${i} OR COALESCE(u.username,'') ILIKE $${i} OR COALESCE(s.message,'') ILIKE $${i})`
    );
    values.push(`%${f.q}%`);
    i++;
  }
  if (f.status) {
    conditions.push(`s.status = $${i}`);
    values.push(f.status);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRes = await query(
    `SELECT COUNT(*)::int AS c FROM support_tickets s
     LEFT JOIN users u ON u.telegram_id = s.user_id ${where}`,
    values
  );
  const total = countRes.rows[0]?.c || 0;

  const { rows } = await query(
    `SELECT s.*, u.username FROM support_tickets s
     LEFT JOIN users u ON u.telegram_id = s.user_id
     ${where}
     ORDER BY s.created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, f.limit, offset(f)]
  );

  return (
    <AdminShell title="Support Tickets">
      <Suspense fallback={<div className="card">Loading filters…</div>}>
        <FilterBar
          resultCount={total}
          fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'User, message…' },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'open', label: 'Open' },
                { value: 'replied', label: 'Replied' },
                { value: 'closed', label: 'Closed' },
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
              <th>Message</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--muted)' }}>
                  No tickets match
                </td>
              </tr>
            )}
            {rows.map((t) => (
              <tr key={t.id}>
                <td>
                  {t.user_id} {t.username ? `(@${t.username})` : ''}
                </td>
                <td style={{ maxWidth: 320 }}>{t.message}</td>
                <td>
                  <span className={`badge ${t.status === 'open' ? 'yellow' : 'green'}`}>{t.status}</span>
                </td>
                <td>{dt(t.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination base="/support" filters={f} total={total} />
      </div>
    </AdminShell>
  );
}
