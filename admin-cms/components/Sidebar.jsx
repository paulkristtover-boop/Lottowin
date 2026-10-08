'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ThemeToggle from './ThemeToggle';

const sections = [
  {
    title: 'Overview',
    links: [
      { href: '/', label: 'Dashboard' },
      { href: '/ops', label: 'Ops & Maintenance' },
      { href: '/treasury', label: 'Treasury' },
      { href: '/settings', label: 'Settings' },
    ],
  },
  {
    title: 'Players',
    links: [
      { href: '/users', label: 'Users' },
      { href: '/tickets', label: 'Tickets / Plays' },
      { href: '/bonuses', label: 'Free Tickets' },
      { href: '/transactions', label: 'Transactions' },
    ],
  },
  {
    title: 'Money',
    links: [
      { href: '/deposits', label: 'Deposits' },
      { href: '/withdrawals', label: 'Withdrawals' },
      { href: '/tax', label: 'Tax Ledger' },
    ],
  },
  {
    title: 'Growth',
    links: [
      { href: '/contests', label: 'Contests' },
      { href: '/broadcast', label: 'Broadcast' },
      { href: '/message', label: 'Message User' },
    ],
  },
  {
    title: 'Risk',
    links: [
      { href: '/fraud', label: 'Fraud' },
      { href: '/support', label: 'Support' },
      { href: '/audit', label: 'Audit' },
    ],
  },
];

function isActive(path, href) {
  if (href === '/') return path === '/';
  return path === href || path.startsWith(`${href}/`);
}

export default function Sidebar({ open, onClose }) {
  const path = usePathname();
  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={onClose} aria-hidden={!open} />
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Admin navigation">
        <div className="sidebar-head">
          <div>
            <h1>LottoWin</h1>
            <p className="sidebar-tag">Admin CMS</p>
          </div>
          <button type="button" className="btn ghost sm sidebar-close" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </div>
        <nav>
          {sections.map((sec) => (
            <div key={sec.title} className="nav-section">
              <div className="nav-section-title">{sec.title}</div>
              {sec.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className={isActive(path, l.href) ? 'active' : ''}
                  onClick={onClose}
                >
                  {l.label}
                </Link>
              ))}
            </div>
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
