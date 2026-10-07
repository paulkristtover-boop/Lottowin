'use client';

import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button type="button" className="btn ghost sm" onClick={toggle} title="Toggle theme">
      {theme === 'dark' ? '☀️ Light' : '🌙 Dark'}
    </button>
  );
}
