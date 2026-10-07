import AdminShell from '@/components/AdminShell';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <AdminShell title="Settings">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>How config works</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Bot economics are controlled by <strong>environment variables</strong> on the bot host
          (e.g. Railway). Change values → <strong>restart the bot</strong>. This CMS reads the same
          Postgres database; it does not hot-reload bot env.
        </p>
      </div>

      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Economics</h3>
        <table>
          <thead>
            <tr>
              <th>Key</th>
              <th>Role</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>PLAY_COST_USD</code>
              </td>
              <td>
                Line stake. Prizes <strong>auto-scale</strong> via multiples (4/40: 10000× / 50× / 5× /
                1.5× · 3/30: 1000× / 15× / 1×).
              </td>
            </tr>
            <tr>
              <td>
                <code>PLAY_COST_3_30_USD</code>
              </td>
              <td>Optional separate stake for 3/30 only.</td>
            </tr>
            <tr>
              <td>
                <code>MIN_DEPOSIT_USD</code> / <code>MIN_WITHDRAW_USD</code>
              </td>
              <td>Default $1 each.</td>
            </tr>
            <tr>
              <td>
                <code>PLAYTHROUGH_PERCENT</code>
              </td>
              <td>Cash play required vs deposits before withdraw (default 100%).</td>
            </tr>
            <tr>
              <td>
                <code>WITHDRAWAL_FEE_PERCENT</code>
              </td>
              <td>Fee on withdraw amount (default 2%).</td>
            </tr>
            <tr>
              <td>
                <code>MAX_PRIZE_PER_LINE_USD</code>
              </td>
              <td>Optional cap; defaults to top scaled prize.</td>
            </tr>
            <tr>
              <td>
                <code>DAILY_LIABILITY_CAP_USD</code>
              </td>
              <td>Max prizes paid per UTC day.</td>
            </tr>
            <tr>
              <td>
                <code>DAILY_WAGER_POOL_USD</code> / <code>WEEKLY_REFERRAL_POOL_USD</code>
              </td>
              <td>Contest prize pools (rank ratios fixed, dollars scale with pool).</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Maintenance &amp; Terms</h3>
        <table>
          <thead>
            <tr>
              <th>Control</th>
              <th>How</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Maintenance mode</td>
              <td>
                Bot admin: <code>/maintenance on|off|status</code> (DB setting) or env{' '}
                <code>MAINTENANCE_MODE=true</code>
              </td>
            </tr>
            <tr>
              <td>Terms version</td>
              <td>
                <code>TERMS_VERSION</code> — bump to force re-accept. <code>TERMS_REQUIRED=false</code>{' '}
                disables gate.
              </td>
            </tr>
            <tr>
              <td>After maintenance</td>
              <td>
                <code>/maintenance off</code> then broadcast: users send <code>/start</code> to refresh
                menu.
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card table-responsive">
        <h3 style={{ marginTop: 0 }}>Crypto</h3>
        <table>
          <tbody>
            <tr>
              <td>
                <code>TRC20_MASTER_ADDRESS</code> / <code>ERC20_MASTER_ADDRESS</code>
              </td>
              <td>Treasury deposit addresses</td>
            </tr>
            <tr>
              <td>
                <code>ETHERSCAN_API_KEY</code> / <code>TRONGRID_API_KEY</code>
              </td>
              <td>Explorer polling for unique-amount deposits</td>
            </tr>
            <tr>
              <td>
                <code>TELEGRAM_CHANNEL_ID</code>
              </td>
              <td>Hourly live bets + contest posts</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>CMS auth</h3>
        <p style={{ color: 'var(--muted)', marginBottom: 0 }}>
          Login uses <code>CMS_ADMIN_USER</code> / <code>CMS_ADMIN_PASS</code> (or project auth). Keep
          secrets out of git; rotate if shared.
        </p>
      </div>
    </AdminShell>
  );
}
