import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import { query } from '@/lib/db';
import { usd, dt } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function UserDetailPage({ params }) {
  const { telegramId } = await params;
  const id = telegramId;

  const userRes = await query(`SELECT * FROM users WHERE telegram_id = $1`, [id]).catch(() => ({
    rows: [],
  }));
  const user = userRes.rows[0];

  if (!user) {
    return (
      <AdminShell title="User">
        <div className="card">
          <p>User not found.</p>
          <Link href="/users">← Back to users</Link>
        </div>
      </AdminShell>
    );
  }

  const [tickets, deps, wds, txs, credits] = await Promise.all([
    query(
      `SELECT id, game, cost_usd, total_prize_usd, liability_capped, winning_numbers, created_at
       FROM tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30`,
      [id]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT * FROM deposits WHERE user_id = $1 ORDER BY detected_at DESC LIMIT 20`,
      [id]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT * FROM withdrawals WHERE user_id = $1 ORDER BY requested_at DESC LIMIT 20`,
      [id]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 40`,
      [id]
    ).catch(() => ({ rows: [] })),
    query(
      `SELECT * FROM ticket_credits WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [id]
    ).catch(() => ({ rows: [] })),
  ]);

  return (
    <AdminShell title={`User ${id}`}>
      <p>
        <Link href="/users">← Users</Link>
      </p>

      <div className="grid">
        <div className="stat">
          <div className="label">Cash</div>
          <div className="value">{usd(user.balance_usd)}</div>
        </div>
        <div className="stat">
          <div className="label">Free unlocked</div>
          <div className="value">{user.unlocked_tickets ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">Locked</div>
          <div className="value">{user.locked_tickets ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">Deposited</div>
          <div className="value">{usd(user.total_deposited)}</div>
        </div>
        <div className="stat">
          <div className="label">Wagered</div>
          <div className="value">{usd(user.total_wagered)}</div>
        </div>
        <div className="stat">
          <div className="label">Won</div>
          <div className="value">{usd(user.total_won)}</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Profile</h3>
        <table>
          <tbody>
            <tr>
              <td>Username</td>
              <td>
                {user.first_name || '—'} {user.username ? `@${user.username}` : ''}
              </td>
            </tr>
            <tr>
              <td>Banned</td>
              <td>{user.is_banned ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
              <td>First deposit</td>
              <td>{user.is_first_deposit_completed ? 'Yes' : 'No'}</td>
            </tr>
            <tr>
              <td>Referral code</td>
              <td>
                <code>{user.referral_code}</code>
              </td>
            </tr>
            <tr>
              <td>Referred by</td>
              <td>{user.referred_by || '—'}</td>
            </tr>
            <tr>
              <td>Joined</td>
              <td>{dt(user.created_at)}</td>
            </tr>
            <tr>
              <td>Risk score</td>
              <td>{user.risk_score ?? 0}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Recent plays</h3>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Game</th>
              <th>Cost</th>
              <th>Prize</th>
              <th>Win #</th>
            </tr>
          </thead>
          <tbody>
            {tickets.rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--muted)' }}>
                  No plays
                </td>
              </tr>
            )}
            {tickets.rows.map((t) => (
              <tr key={t.id}>
                <td>{dt(t.created_at)}</td>
                <td>{t.game || '4_40'}</td>
                <td>{usd(t.cost_usd)}</td>
                <td>{usd(t.total_prize_usd)}</td>
                <td style={{ fontSize: '0.8rem' }}>
                  {Array.isArray(t.winning_numbers) ? t.winning_numbers.join(', ') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Deposits</h3>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Chain</th>
              <th>USD</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {deps.rows.map((d) => (
              <tr key={d.id}>
                <td>{dt(d.detected_at)}</td>
                <td>{d.chain}</td>
                <td>{usd(d.amount_usd)}</td>
                <td>{d.status}</td>
              </tr>
            ))}
            {deps.rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--muted)' }}>
                  None
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Withdrawals</h3>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Send exactly</th>
              <th>Fee</th>
              <th>Held</th>
              <th>Chain</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {wds.rows.map((w) => {
              const payout = Number(w.amount_usd) || 0;
              const fee = Number(w.fee_usd) || 0;
              return (
                <tr key={w.id}>
                  <td>{dt(w.requested_at)}</td>
                  <td>
                    <code>{Number(payout).toFixed(6)}</code>
                  </td>
                  <td>{usd(fee)}</td>
                  <td>{usd(payout + fee)}</td>
                  <td>{w.chain}</td>
                  <td>{w.status}</td>
                </tr>
              );
            })}
            {wds.rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ color: 'var(--muted)' }}>
                  None
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Ticket credits</h3>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Δ Locked</th>
              <th>Δ Unlocked</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {credits.rows.map((c) => (
              <tr key={c.id}>
                <td>{dt(c.created_at)}</td>
                <td>{c.delta_locked}</td>
                <td>{c.delta_unlocked}</td>
                <td>{c.reason}</td>
              </tr>
            ))}
            {credits.rows.length === 0 && (
              <tr>
                <td colSpan={4} style={{ color: 'var(--muted)' }}>
                  None
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Ledger (latest)</h3>
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Balance after</th>
            </tr>
          </thead>
          <tbody>
            {txs.rows.map((x) => (
              <tr key={x.id}>
                <td>{dt(x.created_at)}</td>
                <td>{x.type}</td>
                <td>{usd(x.amount_usd)}</td>
                <td>{usd(x.balance_after)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
