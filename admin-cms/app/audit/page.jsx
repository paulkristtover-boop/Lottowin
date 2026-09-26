import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { dt } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function AuditPage() {
  const { rows } = await query(
    `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100`
  );

  return (
    <AdminShell title="Audit Log">
      <div className="card">
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
      </div>
    </AdminShell>
  );
}
