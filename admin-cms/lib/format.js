export function usd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs === 0) return '$0';
  if (abs >= 1) return `$${n.toFixed(2)}`;
  if (abs >= 0.01) return `$${n.toFixed(4)}`;
  let s = n.toFixed(8).replace(/\.?0+$/, '');
  if (!s.includes('.')) s += '.0';
  return `$${s}`;
}

export function dt(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('en-GB', {
      dateStyle: 'short',
      timeStyle: 'short',
    });
  } catch {
    return String(value);
  }
}
