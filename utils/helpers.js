function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function formatUsd(amount) {
  return `$${Number(amount).toFixed(2)}`;
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
