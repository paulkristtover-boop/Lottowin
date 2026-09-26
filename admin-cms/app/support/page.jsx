import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { dt } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SupportPage() {
  const { rows } = await query(
    `SELECT s.*, u.username FROM support_tickets s
     LEFT JOIN users u ON u.telegram_id = s.user_id
     ORDER BY s.created_at DESC LIMIT 50`
  );

  return (
    <AdminShell title="Support Tickets">
      <div className="card">
        {rows.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No tickets yet.</p>
        ) : (
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
              {rows.map((t) => (
                <tr key={t.id}>
                  <td>
                    {t.user_id} {t.username ? `(@${t.username})` : ''}
                  </td>
                  <td style={{ maxWidth: 320 }}>{t.message}</td>
                  <td>
                    <span className={`badge ${t.status === 'open' ? 'yellow' : 'green'}`}>
                      {t.status}
                    </span>
                  </td>
                  <td>{dt(t.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
