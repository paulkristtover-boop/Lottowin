import AdminShell from '@/components/AdminShell';

export default function SettingsPage() {
  return (
    <AdminShell title="Settings">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Economics (bot env)</h3>
        <table>
          <tbody>
            <tr>
              <td>MIN_DEPOSIT_USD</td>
              <td>$1.00</td>
            </tr>
            <tr>
              <td>MIN_WITHDRAW_USD</td>
              <td>$2.00</td>
            </tr>
            <tr>
              <td>PLAY_COST_USD</td>
              <td>$0.10 / line (both games)</td>
            </tr>
            <tr>
              <td>WELCOME_FREE_TICKETS</td>
              <td>5 locked → unlock after first deposit</td>
            </tr>
            <tr>
              <td>REFERRAL_FREE_TICKETS</td>
              <td>3 after referred user’s first cash bet</td>
            </tr>
            <tr>
              <td>REFERRAL_COMMISSION_PERCENT</td>
              <td>5% of cash ticket spend</td>
            </tr>
            <tr>
              <td>DAILY_LIABILITY_CAP_USD</td>
              <td>$2,000 rolling</td>
            </tr>
            <tr>
              <td>GAMING_TAX_RATE</td>
              <td>11% GGR</td>
            </tr>
            <tr>
              <td>DEFAULT_DAILY_LIMIT_USD</td>
              <td>$50 cash spend / player / day</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Games</h3>
        <table>
          <thead>
            <tr>
              <th>Game</th>
              <th>Pick</th>
              <th>Prizes (USD)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Insta Win 4/40</td>
              <td>4 from 1–40</td>
              <td>Match 4 $100 · 3 $5 · 2 $0.50 · 1 $0.15</td>
            </tr>
            <tr>
              <td>Insta Win 3/30</td>
              <td>3 from 1–30</td>
              <td>Match 3 $10 · 2 $0.15 · 1 $0.05</td>
            </tr>
          </tbody>
        </table>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          3/30 prizes converted from ₦100k / ₦1.5k / ₦100 using platform scale (~₦10k ≈ $1).
        </p>
      </div>
      <div className="card">
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Runtime values are controlled by bot environment variables and Postgres — not editable
          from this CMS for safety. Treasury addresses stay in bot <code>.env</code> only.
        </p>
      </div>
    </AdminShell>
  );
}
