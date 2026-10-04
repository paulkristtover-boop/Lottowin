export function usd(n) {
  const x = Number(n || 0);
  if (!Number.isFinite(x)) return '$0';
  const abs = Math.abs(x);
  if (abs === 0) return '$0';
  if (abs >= 1) return `$${x.toFixed(2)}`;
  if (abs >= 0.01) return `$${x.toFixed(4)}`;
  let s = x.toFixed(8).replace(/\.?0+$/, '');
  if (!s.includes('.')) s += '.0';
  return `$${s}`;
}

export function dt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}
