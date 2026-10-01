import { Suspense } from 'react';
import AdminShell from '@/components/AdminShell';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { query } from '@/lib/db';
import { usd, dt } from '@/lib/format';
import { sp, offset } from '@/lib/filters';

export const dynamic = 'force-dynamic';

function extractGame(lines) {
  if (!lines) return '4_40';
  if (typeof lines === 'object' && lines.game) return lines.game;
  return '4_40';
}

function extractResults(lines) {
  if (!lines) return [];
  if (Array.isArray(lines)) return lines;
  if (lines.results && Array.isArray(lines.results)) return lines.results;
  return [];
}

export default async function TicketsPage({ searchParams }) {
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
  if (f.type === '4_40') {
    conditions.push(`(lines->>'game' = '4_40' OR lines->>'game' IS NULL)`);
  } else if (f.type === '3_30') {
    conditions.push(`lines->>'game' = '3_30'`);
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
  const countRes = await query(`SELECT COUNT(*)::int AS c FROM tickets ${where}`, values).catch(
    () => ({ rows: [{ c: 0 }] })
  );
  const total = countRes.rows[0]?.c || 0;

  const { rows } = await query(
    `SELECT id, user_id, lines, cost_usd, total_prize_usd, prize_before_cap, liability_capped,
            winning_numbers, rng_source, created_at
     FROM tickets ${where}
     ORDER BY created_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, f.limit, offset(f)]
  ).catch(() => ({ rows: [] }));

  return (
    <AdminShell title="Tickets / Plays">
      <Suspense fallback={<div className="card">Loading…</div>}>
        <FilterBar
          resultCount={total}
          fields={[
            { name: 'q', label: 'User ID', type: 'text', placeholder: 'Telegram ID…' },
            {
              name: 'type',
              label: 'Game',
              type: 'select',
              options: [
                { value: '', label: 'All games' },
                { value: '4_40', label: 'Insta Win 4/40' },
                { value: '3_30', label: 'Insta Win 3/30' },
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
              <th>Game</th>
              <th>Lines</th>
              <th>Winning</th>
              <th>Cash cost</th>
              <th>Prize</th>
              <th>Capped</th>
              <th>RNG</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ color: 'var(--muted)' }}>
                  No tickets match
                </td>
              </tr>
            )}
            {rows.map((t) => {
              const game = extractGame(t.lines);
              const results = extractResults(t.lines);
              return (
                <tr key={t.id}>
                  <td>{dt(t.created_at)}</td>
                  <td>{t.user_id}</td>
                  <td>{game === '3_30' ? '3/30' : '4/40'}</td>
                  <td>{results.length || '—'}</td>
                  <td style={{ fontSize: '0.8rem' }}>
                    {Array.isArray(t.winning_numbers) ? t.winning_numbers.join(', ') : '—'}
                  </td>
                  <td>{usd(t.cost_usd)}</td>
                  <td>{usd(t.total_prize_usd)}</td>
                  <td>{t.liability_capped ? <span className="badge yellow">Yes</span> : '—'}</td>
                  <td>{t.rng_source || 'auto'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination base="/tickets" filters={f} total={total} />
      </div>
    </AdminShell>
  );
}
