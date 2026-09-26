import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { dt } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function FraudPage() {
  const { rows } = await query(
    `SELECT * FROM fraud_flags ORDER BY created_at DESC LIMIT 50`
  );

  return (
    <AdminShell title="Fraud Flags">
      <div className="card">
        {rows.length === 0 ? (
          <p style={{ color: 'var(--muted)' }}>No fraud flags recorded yet.</p>
        ) : (
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
              {rows.map((f) => (
                <tr key={f.id}>
                  <td>{f.user_id}</td>
                  <td>{f.reason}</td>
                  <td>{f.severity}</td>
                  <td>{f.resolved ? 'Yes' : 'No'}</td>
                  <td>{dt(f.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
