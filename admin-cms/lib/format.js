export function usd(n) {
  return `$${Number(n || 0).toFixed(2)}`;
}

export function dt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString();
}
