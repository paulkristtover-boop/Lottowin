import { Suspense } from 'react';
import AdminShell from '@/components/AdminShell';
import FilterBar from '@/components/FilterBar';
import Pagination from '@/components/Pagination';
import { query } from '@/lib/db';
import { usd, usdtExact, dt } from '@/lib/format';
import { sp, offset } from '@/lib/filters';

export const dynamic = 'force-dynamic';

export default async function WithdrawalsPage({ searchParams }) {
  const params = await searchParams;
  const f = sp(params);
  const conditions = [];
  const values = [];
  let i = 1;

  if (f.q) {
    conditions.push(
      `(CAST(w.user_id AS TEXT) ILIKE $${i} OR COALESCE(u.username,'') ILIKE $${i} OR COALESCE(w.address,'') ILIKE $${i} OR CAST(w.id AS TEXT) ILIKE $${i})`
    );
    values.push(`%${f.q}%`);
    i++;
  }
  if (f.status) {
    conditions.push(`w.status = $${i}`);
    values.push(f.status);
    i++;
  }
  if (f.chain) {
    conditions.push(`w.chain ILIKE $${i}`);
    values.push(`%${f.chain}%`);
    i++;
  }
  if (f.from) {
    conditions.push(`w.requested_at >= $${i}::date`);
    values.push(f.from);
    i++;
  }
  if (f.to) {
    conditions.push(`w.requested_at < ($${i}::date + INTERVAL '1 day')`);
    values.push(f.to);
    i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const countRes = await query(
    `SELECT COUNT(*)::int AS c FROM withdrawals w
     LEFT JOIN users u ON u.telegram_id = w.user_id ${where}`,
    values
  );
  const total = countRes.rows[0]?.c || 0;

  const { rows } = await query(
    `SELECT w.*, u.username FROM withdrawals w
     LEFT JOIN users u ON u.telegram_id = w.user_id
     ${where}
     ORDER BY w.requested_at DESC
     LIMIT $${i} OFFSET $${i + 1}`,
    [...values, f.limit, offset(f)]
  );

  return (
    <AdminShell title="Withdrawals">
      <div className="card" style={{ marginBottom: 12 }}>
        <p style={{ color: 'var(--muted)', margin: 0, fontSize: '0.9rem' }}>
          <strong>SEND EXACTLY</strong> the amount shown (unique 6-dp USDT). Fee is fixed by network
          (TRC-20 / ERC-20), held from the user with the payout. After on-chain send use bot{' '}
          <code>/approve &lt;ref&gt; &lt;txhash&gt;</code> or reject to refund amount + fee.
        </p>
      </div>
      <Suspense fallback={<div className="card">Loading filters…</div>}>
        <FilterBar
          resultCount={total}
          fields={[
            { name: 'q', label: 'Search', type: 'text', placeholder: 'User, address, ref ID…' },
            {
              name: 'status',
              label: 'Status',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'completed', label: 'Completed' },
                { value: 'rejected', label: 'Rejected' },
              ],
            },
            {
              name: 'chain',
              label: 'Chain',
              type: 'select',
              options: [
                { value: '', label: 'All' },
                { value: 'trc20', label: 'TRC-20' },
                { value: 'erc20', label: 'ERC-20' },
                { value: 'usdt_trc20', label: 'usdt_trc20' },
                { value: 'usdt_erc20', label: 'usdt_erc20' },
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
              <th>Ref</th>
              <th>User</th>
              <th>Send exactly</th>
              <th>Fee</th>
              <th>Total held</th>
              <th>Chain</th>
              <th>Address</th>
              <th>Status</th>
              <th>TX</th>
              <th>Requested</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} style={{ color: 'var(--muted)' }}>
                  No withdrawals match
                </td>
              </tr>
            )}
            {rows.map((w) => {
              const payout = Number(w.amount_usd) || 0;
              const fee = Number(w.fee_usd) || 0;
              const held = payout + fee;
              return (
                <tr key={w.id}>
                  <td style={{ fontSize: '0.75rem' }} title={String(w.id)}>
                    <code>{String(w.id).slice(0, 8)}…</code>
                  </td>
                  <td>
                    <a href={`/users/${w.user_id}`}>{w.user_id}</a>
                    {w.username ? ` (@${w.username})` : ''}
                  </td>
                  <td>
                    <strong style={{ fontFamily: 'monospace' }}>{usdtExact(payout)}</strong>
                    <span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}> USDT</span>
                  </td>
                  <td>{usd(fee)}</td>
                  <td>{usd(held)}</td>
                  <td>{w.chain}</td>
                  <td
                    style={{
                      maxWidth: 160,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                    }}
                    title={w.address}
                  >
                    {w.address}
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        w.status === 'completed'
                          ? 'green'
                          : w.status === 'rejected'
                            ? 'red'
                            : 'yellow'
                      }`}
                    >
                      {w.status}
                    </span>
                  </td>
                  <td
                    style={{
                      maxWidth: 100,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontSize: '0.75rem',
                    }}
                    title={w.tx_hash || ''}
                  >
                    {w.tx_hash ? <code>{String(w.tx_hash).slice(0, 10)}…</code> : '—'}
                  </td>
                  <td>{dt(w.requested_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <Pagination base="/withdrawals" filters={f} total={total} />
      </div>
    </AdminShell>
  );
}
