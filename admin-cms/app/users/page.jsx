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
  if (f.status === 'first_dep') conditions.push(`is_first_deposit_completed = TRUE`);
  else if (f.status === 'no_dep') conditions.push(`COALESCE(is_first_deposit_completed, FALSE) = FALSE`);
  else if (f.status === 'has_locked') conditions.push(`COALESCE(locked_tickets,0) > 0`);
  else if (f.status === 'has_free') conditions.push(`COALESCE(unlocked_tickets,0) > 0`);
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
    f.sort === 'balance'
      ? 'balance_usd DESC'
      : f.sort === 'wagered'
      ? 'total_wagered DESC'
      : f.sort === 'tickets'
      ? 'unlocked_tickets DESC NULLS LAST'
      : 'created_at DESC';

  const countRes = await query(`SELECT COUNT(*)::int AS c FROM users ${where}`, values).catch(() => ({
    rows: [{ c: 0 }],
  }));
  const total = countRes.rows[0]?.c || 0;

  const { rows } = await query(
    `SELECT telegram_id, username, first_name, balance_usd, total_wagered, total_won, total_deposited,
            is_banned, created_at,
            COALESCE(locked_tickets,0) AS locked_tickets,
            COALESCE(unlocked_tickets,0) AS unlocked_tickets,
            COALESCE(is_first_deposit_completed, FALSE) AS is_first_deposit_completed,
            COALESCE(welcome_tickets_granted, FALSE) AS welcome_tickets_granted
     FROM users ${where}
     ORDER BY ${order}
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, f.limit, offset(f)]
  ).catch(() => ({ rows: [] }));

  return (
    <AdminShell title="Users">
      <Suspense fallback={<div className="card">Loading filters…</div>}>
        <FilterBar
          resultCount={total}
          fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'ID, username, name…' },
            {
              name: 'banned',
              label: 'Ban status',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'no', label: 'Active' },
                { value: 'yes', label: 'Banned' },
              ],
            },
            {
              name: 'status',
              label: 'Tickets / deposit',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'first_dep', label: 'First deposit done' },
                { value: 'no_dep', label: 'No first deposit' },
                { value: 'has_locked', label: 'Has locked tickets' },
                { value: 'has_free', label: 'Has unlocked free tickets' },
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
                { value: 'tickets', label: 'Free tickets' },
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
              <th>Cash</th>
              <th>Free ✓</th>
              <th>Locked</th>
              <th>1st dep</th>
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
                <td colSpan={11} style={{ color: 'var(--muted)' }}>
                  No users match
                </td>
              </tr>
            )}
            {rows.map((u) => (
              <tr key={u.telegram_id}>
                <td><a href={`/users/${u.telegram_id}`}>{u.telegram_id}</a></td>
                <td>
                  {u.first_name || '—'} {u.username ? `(@${u.username})` : ''}
                </td>
                <td>{usd(u.balance_usd)}</td>
                <td>{u.unlocked_tickets}</td>
                <td>{u.locked_tickets}</td>
                <td>
                  {u.is_first_deposit_completed ? (
                    <span className="badge green">Yes</span>
                  ) : (
                    <span className="badge yellow">No</span>
                  )}
                </td>
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
