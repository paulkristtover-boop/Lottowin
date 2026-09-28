import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { usd, dt } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function TaxPage() {
  const { rows } = await query(
    `SELECT * FROM tax_ledger ORDER BY period_date DESC LIMIT 60`
  );
  const sum = await query(
    `SELECT COALESCE(SUM(gross_wagered),0) AS w, COALESCE(SUM(gross_prizes),0) AS p,
            COALESCE(SUM(ggr),0) AS g, COALESCE(SUM(tax_amount),0) AS t
     FROM tax_ledger`
  );
  const s = sum.rows[0];

  return (
    <AdminShell title="Tax Ledger (11% GGR)">
      <div className="grid">
        <div className="stat"><div className="label">Gross Wagered</div><div className="value">{usd(s.w)}</div></div>
        <div className="stat"><div className="label">Prizes Paid</div><div className="value">{usd(s.p)}</div></div>
        <div className="stat"><div className="label">GGR</div><div className="value">{usd(s.g)}</div></div>
        <div className="stat"><div className="label">Tax Accrued</div><div className="value">{usd(s.t)}</div></div>
      </div>
      <div className="card table-responsive">
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          Export CSV via Telegram admin: <code>/taxexport</code>
        </p>
        <table>
          <thead>
            <tr>
              <th>Date</th><th>Wagered</th><th>Prizes</th><th>GGR</th><th>Rate</th><th>Tax</th><th>Tickets</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.period_date)}>
                <td>{String(r.period_date).slice(0, 10)}</td>
                <td>{usd(r.gross_wagered)}</td>
                <td>{usd(r.gross_prizes)}</td>
                <td>{usd(r.ggr)}</td>
                <td>{(Number(r.tax_rate) * 100).toFixed(1)}%</td>
                <td>{usd(r.tax_amount)}</td>
                <td>{r.ticket_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
