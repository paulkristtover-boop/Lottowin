import { Suspense } from 'react';
import AdminShell from '@/components/AdminShell';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { query } from '@/lib/db';
import { usd, dt } from '@/lib/format';
import { sp, offset } from '@/lib/filters';

export const dynamic = 'force-dynamic';

export default async function UsersPage({ searchParams }) {
  const params = await searchParams;
  const f = sp(params);
  const conditions = [];
  const values = [];
  let i = 1;

  if (f.q) {
    conditions.push(
      `(CAST(telegram_id AS TEXT) ILIKE $${i} OR COALESCE(username,'') ILIKE $${i} OR COALESCE(first_name,'') ILIKE $${i})`
    );
    values.push(`%${f.q}%`);
    i++;
  }
  if (f.banned === 'yes') conditions.push(`is_banned = TRUE`);
  else if (f.banned === 'no') conditions.push(`is_banned = FALSE`);
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
  const order =
    f.sort === 'balance' ? 'balance_usd DESC' : f.sort === 'wagered' ? 'total_wagered DESC' : 'created_at DESC';

  const countRes = await query(`SELECT COUNT(*)::int AS c FROM users ${where}`, values);
  const total = countRes.rows[0]?.c || 0;

  const { rows } = await query(
    `SELECT telegram_id, username, first_name, balance_usd, total_wagered, total_won, total_deposited,
            is_banned, created_at
     FROM users ${where}
     ORDER BY ${order}
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, f.limit, offset(f)]
  );

  return (
    <AdminShell title="Users">
      <Suspense fallback={<div className="card">Loading filters…</div>}>
        <FilterBar
          resultCount={total}
          fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'ID, username, name…' },
            {
              name: 'banned',
              label: 'Status',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'no', label: 'Active' },
                { value: 'yes', label: 'Banned' },
              ],
            },
            {
              name: 'sort',
              label: 'Sort',
              type: 'select',
              options: [
                { value: 'newest', label: 'Newest' },
                { value: 'balance', label: 'Balance' },
                { value: 'wagered', label: 'Wagered' },
              ],
            },
            { name: 'from', label: 'Joined from', type: 'date' },
            { name: 'to', label: 'Joined to', type: 'date' },
          ]}
        />
      </Suspense>
      <div className="card table-responsive">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Balance</th>
              <th>Deposited</th>
              <th>Wagered</th>
              <th>Won</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ color: 'var(--muted)' }}>
                  No users match your filters
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.telegram_id}>
                <td>{u.telegram_id}</td>
                <td>
                  {u.first_name || '—'} {u.username ? `(@${u.username})` : ''}
                </td>
                <td>{usd(u.balance_usd)}</td>
                <td>{usd(u.total_deposited)}</td>
                <td>{usd(u.total_wagered)}</td>
                <td>{usd(u.total_won)}</td>
                <td>
                  {u.is_banned ? (
                    <span className="badge red">Banned</span>
                  ) : (
                    <span className="badge green">Active</span>
                  )}
                </td>
                <td>{dt(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination base="/users" filters={f} total={total} />
      </div>
    </AdminShell>
  );
}
