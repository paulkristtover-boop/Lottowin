import AdminShell from '@/components/AdminShell';

export default function SettingsPage() {
  return (
    <AdminShell title="Settings">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Economics (micro USDT)</h3>
        <table>
          <tbody>
            <tr>
              <td>PLAY_COST_USD</td>
              <td>$0.0001 / line (both games)</td>
            </tr>
            <tr>
              <td>MIN_DEPOSIT_USD</td>
              <td>$1.00</td>
            </tr>
            <tr>
              <td>MIN_WITHDRAW_USD</td>
              <td>$1.00</td>
            </tr>
            <tr>
              <td>WELCOME_FREE_TICKETS</td>
              <td>5 locked → unlock after first $1 deposit</td>
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
              <td>$50 (micro tops)</td>
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
        <h3 style={{ marginTop: 0 }}>Games — prizes auto-scale with PLAY_COST_USD</h3>
        <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
          Scaled from ₦100 line ratios (10,000× / 50× / 5× / 1.5× for 4/40; 1,000× / 15× / 1× for 3/30).
        </p>
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
              <td>Match 4 $1.00 · 3 $0.005 · 2 $0.0005 · 1 $0.00015</td>
            </tr>
            <tr>
              <td>Insta Win 3/30</td>
              <td>3 from 1–30</td>
              <td>Match 3 $0.10 · 2 $0.0015 · 1 $0.0001</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="card">
        <p style={{ margin: 0, color: 'var(--muted)' }}>
          Runtime values come from bot environment variables. Redeploy bot after changing .env.
        </p>
      </div>
    </AdminShell>
  );
}
