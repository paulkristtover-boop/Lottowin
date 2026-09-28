'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

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
  { href: '/message', label: 'Message User' },
  { href: '/audit', label: 'Audit' },
  { href: '/support', label: 'Support' },
  { href: '/settings', label: 'Settings' },
];

export default function Sidebar({ open, onClose }) {
  const path = usePathname();
  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-head">
          <h1>🎰 LottoWin</h1>
          <button type="button" className="btn ghost sm sidebar-close" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </div>
        <nav>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={path === l.href ? 'active' : ''}
              onClick={onClose}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <ThemeToggle />
          <form action="/api/auth/logout" method="POST" style={{ marginTop: '0.75rem' }}>
            <button type="submit" className="btn ghost" style={{ width: '100%' }}>
              Logout
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
