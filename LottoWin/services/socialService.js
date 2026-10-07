/**
 * Live / recent bets feed + referral battle leaderboard.
 */
const { query } = require('../database');
const { formatUsd, formatNumbers } = require('../utils/helpers');

const { displayLabel } = require('../utils/displayName');

function maskUser(row) {
  return displayLabel({
    public_id: row.public_id,
    username: row.username,
    user_id: row.user_id || row.telegram_id,
    referral_code: row.referral_code,
  });
}

/**
 * Recent completed tickets platform-wide (anonymized).
 */
async function getLiveBets(limit = 15) {
  const res = await query(
    `SELECT t.id, t.user_id, t.game, t.cost_usd, t.total_prize_usd, t.winning_numbers,
            t.created_at, u.username, u.public_id, u.referral_code
     FROM tickets t
     LEFT JOIN users u ON u.telegram_id = t.user_id
     ORDER BY t.created_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}

function formatLiveBets(rows) {
  if (!rows.length) return '📡 *Live bets*\n\n_No tickets yet — be the first._';
  let text = `📡 *Live / recent bets*\n_Latest plays on LottoWin_\n\n`;
  for (const t of rows) {
    const who = maskUser(t);
    const game = t.game === '3_30' ? '3/30' : '4/40';
    const won = Number(t.total_prize_usd) > 0;
    const icon = won ? '🏆' : '•';
    const when = new Date(t.created_at).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    text += `${icon} ${who} · ${game} · ${formatUsd(t.cost_usd)}`;
    if (won) text += ` → *${formatUsd(t.total_prize_usd)}*`;
    text += ` · ${when}\n`;
  }
  text += `\n_Names partially hidden. Play responsibly 18+._`;
  return text;
}

/**
 * Referral battle: rank by referred users' cash ticket spend (7d or all-time).
 */
async function getReferralBattle(days = 7, limit = 10) {
  const res = await query(
    `
    SELECT
      ref.telegram_id AS referrer_id,
      ref.username AS referrer_username,
      ref.public_id AS referrer_public_id,
      ref.referral_code AS referrer_referral_code,
      COUNT(DISTINCT u.telegram_id)::int AS recruits,
      COALESCE(SUM(t.cost_usd), 0) AS volume
    FROM users ref
    INNER JOIN users u ON u.referred_by = ref.telegram_id
    LEFT JOIN tickets t ON t.user_id = u.telegram_id
      AND t.created_at > NOW() - ($1::text || ' days')::interval
      AND t.cost_usd > 0
    GROUP BY ref.telegram_id, ref.username, ref.public_id, ref.referral_code
    HAVING COUNT(DISTINCT u.telegram_id) > 0
    ORDER BY volume DESC, recruits DESC
    LIMIT $2
    `,
    [String(days), limit]
  );
  return res.rows;
}

async function getMyReferralRank(telegramId, days = 7) {
  const board = await getReferralBattle(days, 100);
  const idx = board.findIndex((r) => Number(r.referrer_id) === Number(telegramId));
  if (idx < 0) {
    return { rank: null, row: null, boardSize: board.length };
  }
  return { rank: idx + 1, row: board[idx], boardSize: board.length };
}

function formatReferralBattle(rows, days, myRank = null) {
  let text =
    `⚔️ *Referral battle*\n` +
    `_Last ${days} days · ranked by friends' cash ticket volume_\n\n`;
  if (!rows.length) {
    text += `_No referral volume yet. Share your link!_\n`;
  } else {
    rows.forEach((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      const name = displayLabel({
        public_id: r.referrer_public_id,
        username: r.referrer_username,
        user_id: r.referrer_id,
        referral_code: r.referrer_referral_code,
      });
      text += `${medal} ${name} — ${r.recruits} recruits · vol ${formatUsd(r.volume)}\n`;
    });
  }
  if (myRank?.rank) {
    text += `\nYour rank: *#${myRank.rank}* · vol ${formatUsd(myRank.row.volume)}`;
  } else if (myRank) {
    text += `\nYou are not on the board yet — invite friends who *deposit & play*.`;
  }
  text += `\n\nRewards still follow normal referral rules (free tickets + % commission).`;
  return text;
}

module.exports = {
  getLiveBets,
  formatLiveBets,
  getReferralBattle,
  getMyReferralRank,
  formatReferralBattle,
  maskUser,
};
