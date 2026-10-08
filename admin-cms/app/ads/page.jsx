import AdminShell from '@/components/AdminShell';
import Link from 'next/link';

export default function Page() {
  return (
    <AdminShell title="Ads">
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Not in active nav</h3>
        <p style={{ color: 'var(--muted)' }}>
          This route is a legacy placeholder and is not linked in the sidebar. Use Dashboard,
          Users, Deposits, Withdrawals, and Settings for day-to-day ops.
        </p>
        <Link href="/" className="btn">
          Back to Dashboard
        </Link>
      </div>
    </AdminShell>
  );
}
