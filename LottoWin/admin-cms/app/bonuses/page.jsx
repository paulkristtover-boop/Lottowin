import { Suspense } from 'react';
import AdminShell from '@/components/AdminShell';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { query } from '@/lib/db';
import { dt } from '@/lib/format';
import { sp, offset } from '@/lib/filters';

export const dynamic = 'force-dynamic';

export default async function FreeTicketsPage({ searchParams }) {
  const params = await searchParams;
  const f = sp(params);
  const conditions = [];
  const values = [];
  let i = 1;

  if (f.q) {
    conditions.push(`CAST(user_id AS TEXT) ILIKE $${i}`);
    values.push(`%${f.q}%`);
    i++;
  }
  if (f.type) {
    conditions.push(`reason = $${i}`);
    values.push(f.type);
    i++;
  }
  if (f.from) {
    conditions.push(`created_at >= $${i}::date`);
    values.push(f.from);
    i++;
  }
  if (f.to) {
    conditions.push(`created_at < ($${i}::date + INTERVAL '1 day')`);
    values.push(f.to);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  let total = 0;
  let rows = [];
  try {
    const countRes = await query(`SELECT COUNT(*)::int AS c FROM ticket_credits ${where}`, values);
    total = countRes.rows[0]?.c || 0;
    const res = await query(
      `SELECT * FROM ticket_credits ${where}
       ORDER BY created_at DESC
       LIMIT $${i} OFFSET $${i + 1}`,
      [...values, f.limit, offset(f)]
    );
    rows = res.rows;
  } catch {
    total = 0;
    rows = [];
  }

  const summary = await query(
    `SELECT
       COALESCE(SUM(CASE WHEN reason = 'welcome_locked' THEN delta_locked ELSE 0 END),0) AS welcome_locked,
       COALESCE(SUM(CASE WHEN reason = 'welcome_unlock' THEN delta_unlocked ELSE 0 END),0) AS welcome_unlocked,
       COALESCE(SUM(CASE WHEN reason = 'referral_unlock' THEN delta_unlocked ELSE 0 END),0) AS referral_given,
       COALESCE(SUM(CASE WHEN reason = 'play_consume' THEN ABS(delta_unlocked) ELSE 0 END),0) AS consumed
     FROM ticket_credits`
  ).catch(() => ({ rows: [{}] }));

  const s = summary.rows[0] || {};

  return (
    <AdminShell title="Free Tickets Ledger">
      <div className="grid">
        <div className="stat">
          <div className="label">Welcome locked issued</div>
          <div className="value">{s.welcome_locked ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">Welcome unlocked</div>
          <div className="value">{s.welcome_unlocked ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">Referral tickets given</div>
          <div className="value">{s.referral_given ?? 0}</div>
        </div>
        <div className="stat">
          <div className="label">Consumed on play</div>
          <div className="value">{s.consumed ?? 0}</div>
        </div>
      </div>

      <Suspense fallback={<div className="card">Loading…</div>}>
        <FilterBar
          resultCount={total}
          fields={[
            { name: 'q', label: 'User ID', type: 'text', placeholder: 'Telegram ID…' },
            {
              name: 'type',
              label: 'Reason',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'welcome_locked', label: 'Welcome locked' },
                { value: 'welcome_unlock', label: 'Welcome unlock' },
                { value: 'referral_unlock', label: 'Referral unlock' },
                { value: 'play_consume', label: 'Play consume' },
              ],
            },
            { name: 'from', label: 'From', type: 'date' },
            { name: 'to', label: 'To', type: 'date' },
          ]}
        />
      </Suspense>

      <div className="card table-responsive">
        <table>
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Δ Locked</th>
              <th>Δ Unlocked</th>
              <th>Reason</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} style={{ color: 'var(--muted)' }}>
                  No ticket credit events (run migrate-free-tickets.sql if empty forever)
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{dt(r.created_at)}</td>
                <td>{r.user_id}</td>
                <td>{r.delta_locked}</td>
                <td>{r.delta_unlocked}</td>
                <td>{r.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination base="/bonuses" filters={f} total={total} />
      </div>
    </AdminShell>
  );
}
