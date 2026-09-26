import AdminShell from '@/components/AdminShell';

export default function SettingsPage() {
  return (
    <AdminShell title="Settings">
      <div className="card">
        <p>
          Runtime settings (play cost, bonuses, limits) are controlled via environment
          variables on the bot and the <code>settings</code> table.
        </p>
        <ul style={{ color: 'var(--muted)' }}>
          <li>PLAY_COST_USD</li>
          <li>WELCOME_BONUS_USD</li>
          <li>REFERRAL_BONUS_USD / REFERRAL_PERCENT</li>
          <li>MIN_DEPOSIT_USD / MIN_WITHDRAW_USD</li>
          <li>DEFAULT_DAILY_LIMIT_USD / DEFAULT_SESSION_LIMIT_USD</li>
        </ul>
        <p>
          Treasury addresses are set in the bot <code>.env</code>. Never commit private keys.
        </p>
      </div>
    </AdminShell>
  );
}
