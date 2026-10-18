import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function ChannelPage() {
  let rows = [];
  try {
    rows = (await query(`SELECT * FROM channel_posts ORDER BY created_at DESC LIMIT 50`)).rows;
  } catch {
    rows = [];
  }
  return (
    <AdminShell title="Channel activity">
      <div className="card">
        <p style={{ color: 'var(--muted)' }}>
          Bot posts pot updates and draw results to <code>TELEGRAM_CHANNEL_ID</code>. Log below.
        </p>
      </div>
      <div className="card table-responsive">
        <table>
          <thead>
            <tr><th>When</th><th>Kind</th><th>Body</th></tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={3} style={{ color: 'var(--muted)' }}>No posts logged yet</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>{r.kind}</td>
                <td style={{ maxWidth: 420, whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>{r.body}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
