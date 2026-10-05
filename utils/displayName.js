/**
 * Public display identity — never expose full Telegram username in social feeds.
 */

function generatePublicId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'LW';
  for (let i = 0; i < 6; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

/** Mask @username → @ab***xy (privacy) */
function maskUsername(username) {
  if (!username) return null;
  const u = String(username).replace(/^@/, '');
  if (u.length <= 3) return '@•••';
  if (u.length <= 5) return `@${u[0]}***${u[u.length - 1]}`;
  return `@${u.slice(0, 2)}***${u.slice(-2)}`;
}

/**
 * Preferred public label for leaderboards / live bets.
 * Uses public_id (LW-XXXXXX) when present.
 */
function displayLabel(row) {
  if (row?.public_id) return row.public_id;
  if (row?.referral_code) return `LW-${row.referral_code}`;
  const masked = maskUsername(row?.username || row?.referrer_username);
  if (masked) return masked;
  const id = String(row?.user_id || row?.userId || row?.telegram_id || row?.referrer_id || '');
  if (id.length >= 4) return `Player-${id.slice(-4)}`;
  return 'Player';
}

module.exports = {
  generatePublicId,
  maskUsername,
  displayLabel,
};
