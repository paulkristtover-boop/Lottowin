import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { dt } from '@/lib/format';
import BroadcastForm from './BroadcastForm';

export const dynamic = 'force-dynamic';

export default async function BroadcastPage() {
  const { rows } = await query(
    `SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 30`
  ).catch(() => ({ rows: [] }));

  return (
    <AdminShell title="Broadcast / Alerts">
      <BroadcastForm />
      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Recent broadcasts</h3>
        <table>
          <thead>
            <tr>
              <th>Message</th>
              <th>Audience</th>
              <th>Status</th>
              <th>Sent</th>
              <th>Failed</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--muted)' }}>
                  No broadcasts yet
                </td>
              </tr>
            )}
            {rows.map((b) => (
              <tr key={b.id}>
                <td style={{ maxWidth: 280 }}>{b.message?.slice(0, 80)}</td>
                <td>{b.audience}</td>
                <td>
                  <span className={`badge ${b.status === 'done' ? 'green' : 'yellow'}`}>
                    {b.status}
                  </span>
                </td>
                <td>{b.sent_count}</td>
                <td>{b.fail_count}</td>
                <td>{dt(b.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
