import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { usd, dt } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const { rows } = await query(
    `SELECT telegram_id, username, first_name, balance_usd, total_wagered, total_won, is_banned, created_at
     FROM users ORDER BY created_at DESC LIMIT 100`
  );

  return (
    <AdminShell title="Users">
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Balance</th>
              <th>Wagered</th>
              <th>Won</th>
              <th>Status</th>
              <th>Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.telegram_id}>
                <td>{u.telegram_id}</td>
                <td>
                  {u.first_name || '—'} {u.username ? `(@${u.username})` : ''}
                </td>
                <td>{usd(u.balance_usd)}</td>
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
      </div>
    </AdminShell>
  );
}
