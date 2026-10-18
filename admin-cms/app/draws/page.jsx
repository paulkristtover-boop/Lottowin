import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function usd(n) {
  return `$${(Number(n) || 0).toFixed(2)}`;
}

export default async function DrawsPage() {
  const rows = (await query(`SELECT * FROM draws ORDER BY draw_date DESC LIMIT 60`)).rows;
  return (
    <AdminShell title="Draws">
      <div className="card table-responsive">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Status</th>
              <th>Pot</th>
              <th>Sold</th>
              <th>Numbers</th>
              <th>Winners</th>
              <th>Paid</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.draw_date?.toISOString?.().slice(0, 10) || d.draw_date}</td>
                <td>{d.status}</td>
                <td>{usd(d.pot_usd)}</td>
                <td>{d.tickets_sold}</td>
                <td>{(d.winning_numbers || []).join(', ') || '—'}</td>
                <td>{d.winners_count}</td>
                <td>{usd(d.jackpot_paid_usd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
