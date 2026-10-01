import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { usd } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function Dashboard() {
  const safe = async (sql, params = []) => {
    try {
      return await query(sql, params);
    } catch {
      return { rows: [{ c: 0, s: 0, wagered: 0, paid: 0, locked: 0, unlocked: 0 }] };
    }
  };

  const [
    users,
    bal,
    tickets,
    pendingWd,
    pendingDep,
    tax,
    liab,
    freeTickets,
    firstDep,
    byGame,
  ] = await Promise.all([
    safe(`SELECT COUNT(*) AS c FROM users`),
    safe(`SELECT COALESCE(SUM(balance_usd),0) AS s FROM users`),
    safe(
      `SELECT COUNT(*) AS c, COALESCE(SUM(cost_usd),0) AS wagered, COALESCE(SUM(total_prize_usd),0) AS paid FROM tickets`
    ),
    safe(`SELECT COUNT(*) AS c FROM withdrawals WHERE status = 'pending'`),
    safe(`SELECT COUNT(*) AS c FROM deposits WHERE status = 'confirmed'`),
    safe(`SELECT COALESCE(SUM(tax_amount),0) AS s, COALESCE(SUM(ggr),0) AS g FROM tax_ledger`),
    safe(
      `SELECT COALESCE(prizes_paid,0) AS s FROM daily_liability WHERE period_date = CURRENT_DATE`
    ),
    safe(
      `SELECT COALESCE(SUM(locked_tickets),0) AS locked, COALESCE(SUM(unlocked_tickets),0) AS unlocked FROM users`
    ),
    safe(`SELECT COUNT(*) AS c FROM users WHERE is_first_deposit_completed = TRUE`),
    safe(
      `SELECT
         COALESCE(lines->>'game', lines->'results'->0->>'game', '4_40') AS game,
         COUNT(*) AS c,
         COALESCE(SUM(cost_usd),0) AS wagered,
         COALESCE(SUM(total_prize_usd),0) AS paid
       FROM tickets
       GROUP BY 1
       ORDER BY c DESC`
    ),
  ]);

  // Fallback: parse game from JSONB structure { game, results }
  let gameRows = byGame.rows || [];
  if (!gameRows.length || (gameRows.length === 1 && !gameRows[0].game)) {
    const alt = await safe(
      `SELECT
         CASE
           WHEN lines ? 'game' THEN lines->>'game'
           WHEN jsonb_typeof(lines) = 'array' THEN '4_40'
           ELSE COALESCE(lines->>'game', '4_40')
         END AS game,
         COUNT(*) AS c,
         COALESCE(SUM(cost_usd),0) AS wagered,
         COALESCE(SUM(total_prize_usd),0) AS paid
       FROM tickets
       GROUP BY 1`
    );
    gameRows = alt.rows;
  }

  return (
    <AdminShell title="Dashboard">
      <div className="grid">
        <div className="stat">
          <div className="label">Users</div>
          <div className="value">{users.rows[0].c}</div>
        </div>
        <div className="stat">
          <div className="label">Cash balances</div>
          <div className="value">{usd(bal.rows[0].s)}</div>
        </div>
        <div className="stat">
          <div className="label">Tickets played</div>
          <div className="value">{tickets.rows[0].c}</div>
        </div>
        <div className="stat">
          <div className="label">Cash wagered</div>
          <div className="value">{usd(tickets.rows[0].wagered)}</div>
        </div>
        <div className="stat">
          <div className="label">Prizes paid</div>
          <div className="value">{usd(tickets.rows[0].paid)}</div>
        </div>
        <div className="stat">
          <div className="label">Pending WD</div>
          <div className="value">{pendingWd.rows[0].c}</div>
        </div>
        <div className="stat">
          <div className="label">Confirmed deposits</div>
          <div className="value">{pendingDep.rows[0].c}</div>
        </div>
        <div className="stat">
          <div className="label">First-time depositors</div>
          <div className="value">{firstDep.rows[0].c}</div>
        </div>
        <div className="stat">
          <div className="label">Free tickets locked</div>
          <div className="value">{freeTickets.rows[0].locked ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">Free tickets unlocked</div>
          <div className="value">{freeTickets.rows[0].unlocked ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">GGR tax accrued</div>
          <div className="value">{usd(tax.rows[0].s)}</div>
        </div>
        <div className="stat">
          <div className="label">Today liability used</div>
          <div className="value">{usd(liab.rows[0]?.s || 0)}</div>
        </div>
      </div>

      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>By game</h3>
        <table>
          <thead>
            <tr>
              <th>Game</th>
              <th>Tickets</th>
              <th>Cash wagered</th>
              <th>Prizes</th>
            </tr>
          </thead>
          <tbody>
            {(gameRows || []).length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--muted)' }}>
                  No tickets yet
                </td>
              </tr>
            )}
            {(gameRows || []).map((r) => (
              <tr key={String(r.game)}>
                <td>{r.game === '3_30' ? 'Insta Win 3/30' : r.game === '4_40' ? 'Insta Win 4/40' : r.game || '—'}</td>
                <td>{r.c}</td>
                <td>{usd(r.wagered)}</td>
                <td>{usd(r.paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <strong>Platform model</strong>
        <ul style={{ color: 'var(--muted)', marginBottom: 0 }}>
          <li>Cash welcome/referral bonuses disabled — free tickets only</li>
          <li>Welcome tickets locked until first deposit ≥ $1</li>
          <li>Referral free tickets after referred user’s first cash bet + 5% cash commission</li>
          <li>Games: Insta Win 4/40 &amp; 3/30 · liability / tax / spend limits enforced on bot</li>
        </ul>
      </div>
    </AdminShell>
  );
}
