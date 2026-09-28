'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import { ThemeProvider } from './ThemeProvider';

export default function AdminShell({ children, title }) {
  const [open, setOpen] = useState(false);

  return (
    <ThemeProvider>
      <div className="shell">
        <Sidebar open={open} onClose={() => setOpen(false)} />
        <main className="main">
          <div className="topbar">
            <button
              type="button"
              className="btn ghost sm menu-toggle"
              onClick={() => setOpen((v) => !v)}
              aria-label="Toggle sidebar"
            >
              ☰ Menu
            </button>
            {title && <h2 className="page-title">{title}</h2>}
          </div>
          {children}
        </main>
      </div>
    </ThemeProvider>
  );
}
