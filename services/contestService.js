const { query } = require('../database');
const config = require('../config');
const userService = require('./userService');
const { scalePrizes, DAILY_WAGER_WEIGHTS, WEEKLY_REFERRAL_WEIGHTS } = require('./contestPrizeTables');
const { formatUsd } = require('../utils/helpers');
const logger = require('../utils/logger');

function utcDateKey(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function utcWeekKey(d = new Date()) {
  // ISO week YYYY-Www
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function dayBounds(dateKey) {
  const starts = new Date(`${dateKey}T00:00:00.000Z`);
  const ends = new Date(starts.getTime() + 86400000);
  return { starts, ends };
}

function weekBounds(fromDate = new Date()) {
  const d = new Date(Date.UTC(fromDate.getUTCFullYear(), fromDate.getUTCMonth(), fromDate.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() - day + 1); // Monday
  const starts = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const ends = new Date(starts.getTime() + 7 * 86400000);
  return { starts, ends, key: utcWeekKey(starts) };
}

async function ensurePeriod(kind, periodKey, starts, ends, poolUsd) {
  const existing = await query(
    `SELECT * FROM contest_periods WHERE kind = $1 AND period_key = $2`,
    [kind, periodKey]
  );
  if (existing.rows[0]) return existing.rows[0];
  const ins = await query(
    `INSERT INTO contest_periods (kind, period_key, starts_at, ends_at, pool_usd, status)
     VALUES ($1, $2, $3, $4, $5, 'open')
     ON CONFLICT (kind, period_key) DO UPDATE SET pool_usd = EXCLUDED.pool_usd
     RETURNING *`,
    [kind, periodKey, starts, ends, poolUsd]
  );
  return ins.rows[0];
}

async function getDailyWagerLeaderboard(dateKey = utcDateKey(), limit = 100) {
  const { starts, ends } = dayBounds(dateKey);
  const res = await query(
    `SELECT t.user_id, u.username,
            COALESCE(SUM(t.cost_usd), 0) AS volume
     FROM tickets t
     LEFT JOIN users u ON u.telegram_id = t.user_id
     WHERE t.created_at >= $1 AND t.created_at < $2
       AND t.cost_usd > 0
     GROUP BY t.user_id, u.username
     ORDER BY volume DESC
     LIMIT $3`,
    [starts, ends, limit]
  );
  return res.rows.map((r, i) => ({
    rank: i + 1,
    userId: Number(r.user_id),
    username: r.username,
    volume: Number(r.volume),
  }));
}

async function getWeeklyReferralLeaderboard(limit = 20) {
  const { starts, ends, key } = weekBounds();
  const res = await query(
    `SELECT ref.telegram_id AS user_id, ref.username,
            COUNT(DISTINCT u.telegram_id)::int AS recruits,
            COALESCE(SUM(t.cost_usd), 0) AS volume
     FROM users ref
     INNER JOIN users u ON u.referred_by = ref.telegram_id
     LEFT JOIN tickets t ON t.user_id = u.telegram_id
       AND t.created_at >= $1 AND t.created_at < $2
       AND t.cost_usd > 0
     GROUP BY ref.telegram_id, ref.username
     HAVING COUNT(DISTINCT u.telegram_id) > 0
     ORDER BY volume DESC, recruits DESC
     LIMIT $3`,
    [starts, ends, limit]
  );
  return {
    key,
    starts,
    ends,
    rows: res.rows.map((r, i) => ({
      rank: i + 1,
      userId: Number(r.user_id),
      username: r.username,
      recruits: r.recruits,
      volume: Number(r.volume),
    })),
  };
}

function formatLeaderboard(title, rows, prizes, extra = '') {
  let text = `${title}\n${extra}`;
  if (!rows.length) {
    text += `\n_No volume yet — play cash tickets to climb._\n`;
    return text;
  }
  const max = Math.min(rows.length, prizes.length, 15);
  for (let i = 0; i < max; i++) {
    const r = rows[i];
    const p = prizes[i];
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${r.rank}`;
    const name = r.username ? `@${r.username}` : `…${String(r.userId).slice(-4)}`;
    text += `${medal} ${name} · vol ${formatUsd(r.volume)} · prize ${formatUsd(p.prizeUsd)}\n`;
  }
  if (rows.length > max) text += `_…and ${rows.length - max} more ranks_\n`;
  return text;
}

async function settleDailyWager(bot, dateKey) {
  // Settle *previous* day typically
  const key = dateKey || utcDateKey(new Date(Date.now() - 86400000));
  const pool = Number(config.dailyWagerPoolUsd);
  const { starts, ends } = dayBounds(key);
  const period = await ensurePeriod('daily_wager', key, starts, ends, pool);
  if (period.status === 'settled') return { ok: true, already: true };

  const board = await getDailyWagerLeaderboard(key, 100);
  const prizes = scalePrizes(DAILY_WAGER_WEIGHTS, pool);
  let paid = 0;

  for (const row of board) {
    const prize = prizes[row.rank - 1];
    if (!prize || prize.prizeUsd <= 0) continue;
    await query(
      `INSERT INTO contest_payouts (period_id, user_id, rank, volume_usd, prize_usd, credited)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [period.id, row.userId, row.rank, row.volume, prize.prizeUsd]
    );
    await userService.creditBalance(row.userId, prize.prizeUsd, 'contest_daily', period.id, {
      rank: row.rank,
      period: key,
    });
    paid += prize.prizeUsd;
    if (bot?.telegram) {
      await bot.telegram
        .sendMessage(
          row.userId,
          `🏆 *Daily wager contest*\nRank *#${row.rank}* · Prize *${formatUsd(prize.prizeUsd)}* credited.\nPeriod: ${key}`,
          { parse_mode: 'Markdown' }
        )
        .catch(() => {});
    }
  }

  await query(
    `UPDATE contest_periods SET status = 'settled', settled_at = NOW() WHERE id = $1`,
    [period.id]
  );
  logger.info('Daily wager settled', { key, paid, winners: board.length });
  return { ok: true, key, paid, winners: board.length };
}

async function settleWeeklyReferral(bot) {
  const { starts, ends, key } = weekBounds(new Date(Date.now() - 7 * 86400000)); // previous week
  const pool = Number(config.weeklyReferralPoolUsd);
  const period = await ensurePeriod('weekly_referral', key, starts, ends, pool);
  if (period.status === 'settled') return { ok: true, already: true };

  const { rows } = await getWeeklyReferralLeaderboard(20);
  // Re-query for that specific week bounds
  const res = await query(
    `SELECT ref.telegram_id AS user_id, ref.username,
            COUNT(DISTINCT u.telegram_id)::int AS recruits,
            COALESCE(SUM(t.cost_usd), 0) AS volume
     FROM users ref
     INNER JOIN users u ON u.referred_by = ref.telegram_id
     LEFT JOIN tickets t ON t.user_id = u.telegram_id
       AND t.created_at >= $1 AND t.created_at < $2 AND t.cost_usd > 0
     GROUP BY ref.telegram_id, ref.username
     HAVING COUNT(DISTINCT u.telegram_id) > 0
     ORDER BY volume DESC, recruits DESC
     LIMIT 20`,
    [starts, ends]
  );
  const board = res.rows.map((r, i) => ({
    rank: i + 1,
    userId: Number(r.user_id),
    username: r.username,
    volume: Number(r.volume),
  }));
  const prizes = scalePrizes(WEEKLY_REFERRAL_WEIGHTS, pool);
  let paid = 0;
  for (const row of board) {
    const prize = prizes[row.rank - 1];
    if (!prize || prize.prizeUsd <= 0) continue;
    await query(
      `INSERT INTO contest_payouts (period_id, user_id, rank, volume_usd, prize_usd, credited)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [period.id, row.userId, row.rank, row.volume, prize.prizeUsd]
    );
    await userService.creditBalance(row.userId, prize.prizeUsd, 'contest_referral', period.id, {
      rank: row.rank,
      period: key,
    });
    paid += prize.prizeUsd;
    if (bot?.telegram) {
      await bot.telegram
        .sendMessage(
          row.userId,
          `⚔️ *Weekly referral battle*\nRank *#${row.rank}* · Prize *${formatUsd(prize.prizeUsd)}* credited.\nWeek: ${key}`,
          { parse_mode: 'Markdown' }
        )
        .catch(() => {});
    }
  }
  await query(
    `UPDATE contest_periods SET status = 'settled', settled_at = NOW() WHERE id = $1`,
    [period.id]
  );
  logger.info('Weekly referral settled', { key, paid });
  return { ok: true, key, paid, winners: board.length };
}

module.exports = {
  utcDateKey,
  utcWeekKey,
  getDailyWagerLeaderboard,
  getWeeklyReferralLeaderboard,
  formatLeaderboard,
  settleDailyWager,
  settleWeeklyReferral,
  ensurePeriod,
  dayBounds,
  scalePrizes,
  DAILY_WAGER_WEIGHTS,
  WEEKLY_REFERRAL_WEIGHTS,
};
