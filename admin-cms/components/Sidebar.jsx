'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: 'Dashboard' },
  { href: '/draws', label: 'Draws' },
  { href: '/tickets', label: 'Lines' },
  { href: '/users', label: 'Users' },
  { href: '/deposits', label: 'Deposits' },
  { href: '/withdrawals', label: 'Withdrawals' },
  { href: '/channel', label: 'Channel log' },
  { href: '/settings', label: 'Settings' },
];

export default function Sidebar({ open, onClose }) {
  const path = usePathname();
  return (
    <>
      <div className={`sidebar-backdrop ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-head">
          <h1>Daily Jackpot</h1>
          <button type="button" className="btn ghost sm sidebar-close" onClick={onClose}>✕</button>
        </div>
        <nav>
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={path === l.href ? 'active' : ''} onClick={onClose}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="btn ghost" style={{ width: '100%' }}>Logout</button>
          </form>
        </div>
      </aside>
    </>
  );
}
