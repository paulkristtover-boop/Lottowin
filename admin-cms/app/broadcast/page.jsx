import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { dt } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function BroadcastPage() {
  const { rows } = await query(
    `SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT 30`
  ).catch(() => ({ rows: [] }));

  return (
    <AdminShell title="Broadcast / Alerts">
      <div className="card">
        <p style={{ color: 'var(--muted)' }}>
          Create and send from Telegram admin: <code>/broadcast Your message</code>
        </p>
      </div>
      <div className="card table-responsive">
        <table>
          <thead>
            <tr>
              <th>Title / Message</th><th>Audience</th><th>Status</th><th>Sent</th><th>Failed</th><th>When</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={6} style={{ color: 'var(--muted)' }}>No broadcasts yet</td></tr>
            )}
            {rows.map((b) => (
              <tr key={b.id}>
                <td style={{ maxWidth: 280 }}>{b.message?.slice(0, 80)}</td>
                <td>{b.audience}</td>
                <td><span className={`badge ${b.status === 'done' ? 'green' : 'yellow'}`}>{b.status}</span></td>
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
