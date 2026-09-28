'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/users', label: 'Users' },
  { href: '/deposits', label: 'Deposits' },
  { href: '/withdrawals', label: 'Withdrawals' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/treasury', label: 'Treasury' },
  { href: '/tax', label: 'Tax Ledger' },
  { href: '/fraud', label: 'Fraud' },
  { href: '/broadcast', label: 'Broadcast' },
  { href: '/audit', label: 'Audit' },
  { href: '/support', label: 'Support' },
  { href: '/settings', label: 'Settings' },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="sidebar">
      <h1>🎰 LottoWin CMS</h1>
      <nav>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? 'active' : ''}>
            {l.label}
          </Link>
        ))}
      </nav>
      <form action="/api/auth/logout" method="POST" style={{ marginTop: '1.5rem' }}>
        <button type="submit" className="btn ghost" style={{ width: '100%' }}>
          Logout
        </button>
      </form>
    </aside>
  );
}
