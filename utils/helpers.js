function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

/**
 * Format USD for micro stakes (up to 6–8 dp when needed).
 */
function formatUsd(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n)) return '$0';
  const abs = Math.abs(n);
  if (abs === 0) return '$0';
  if (abs >= 1) return `$${n.toFixed(2)}`;
  if (abs >= 0.01) return `$${n.toFixed(4)}`;
  // micro: strip trailing zeros but keep enough precision
  let s = n.toFixed(8).replace(/\.?0+$/, '');
  if (!s.includes('.')) s += '.0';
  return `$${s}`;
}

function formatNumbers(nums) {
  return nums.map((n) => String(n).padStart(2, '0')).join(' • ');
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  escapeMarkdown,
  formatUsd,
  formatNumbers,
  sleep,
};
