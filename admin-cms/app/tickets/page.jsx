import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function LinesPage() {
  let rows = [];
  try {
    rows = (
      await query(
        `SELECT j.*, d.draw_date FROM jackpot_lines j
         JOIN draws d ON d.id = j.draw_id
         ORDER BY j.created_at DESC LIMIT 100`
      )
    ).rows;
  } catch (e) {
    return <AdminShell title="Lines"><div className="card">{e.message}</div></AdminShell>;
  }
  return (
    <AdminShell title="Lines">
      <div className="card table-responsive">
        <table>
          <thead>
            <tr>
              <th>Draw</th>
              <th>User</th>
              <th>Numbers</th>
              <th>Cost</th>
              <th>Match</th>
              <th>Prize</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{String(r.draw_date).slice(0, 10)}</td>
                <td>{r.user_id}</td>
                <td>{(r.numbers || []).join(', ')}</td>
                <td>{r.used_free ? 'free' : r.cost_usd}</td>
                <td>{r.matches ?? '—'}</td>
                <td>{r.prize_usd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
