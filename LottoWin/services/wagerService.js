/**
 * Play-through / wager requirement tracking.
 * Withdrawable progress: cash ticket spend vs deposits since last completed withdraw.
 */
const { query } = require('../database');
const config = require('../config');
const { formatUsd } = require('../utils/helpers');

function playthroughPercent() {
  return Number(process.env.PLAYTHROUGH_PERCENT || config.playthroughPercent || 100);
}

/**
 * Net deposits and cash wagered since last completed withdrawal (or account start).
 */
async function getWagerSnapshot(telegramId) {
  const lastWd = await query(
    `SELECT processed_at FROM withdrawals
     WHERE user_id = $1 AND status = 'completed'
     ORDER BY processed_at DESC NULLS LAST LIMIT 1`,
    [telegramId]
  );
  const since = lastWd.rows[0]?.processed_at || new Date(0);

  const dep = await query(
    `SELECT COALESCE(SUM(amount_usd),0) AS s FROM deposits
     WHERE user_id = $1 AND status = 'confirmed'
       AND COALESCE(confirmed_at, detected_at) > $2`,
    [telegramId, since]
  );
  const wagered = await query(
    `SELECT COALESCE(SUM(cost_usd),0) AS s FROM tickets
     WHERE user_id = $1 AND created_at > $2
       AND cost_usd > 0`,
    [telegramId, since]
  );

  // Approximate cash-only: tickets with cost still count full cost;
  // free lines reduce cost_usd in lottoService — good enough for play-through.
  const deposited = Number(dep.rows[0].s);
  const played = Number(wagered.rows[0].s);
  const pct = playthroughPercent();
  const required = (deposited * pct) / 100;
  const remaining = Math.max(0, required - played);
  const done = required <= 0 ? true : played >= required;
  const progress = required <= 0 ? 1 : Math.min(1, played / required);

  return {
    deposited,
    played,
    required,
    remaining,
    done,
    progress,
    percent: pct,
    since,
  };
}

function progressBar(p, width = 10) {
  const filled = Math.round(Math.max(0, Math.min(1, p)) * width);
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`;
}

function formatWagerCard(snap) {
  if (snap.deposited <= 0) {
    return (
      `🎯 *Wager / play-through*\n\n` +
      `No deposits in this cycle yet.\n` +
      `After you deposit, you must play *${snap.percent}%* of that amount in *cash tickets* before withdraw unlocks (anti pass-through).\n\n` +
      `Cash played this cycle: *${formatUsd(snap.played)}*`
    );
  }
  return (
    `🎯 *Wager / play-through*\n\n` +
    `Requirement: *${snap.percent}%* of deposits this cycle\n` +
    `Deposited: *${formatUsd(snap.deposited)}*\n` +
    `Required play: *${formatUsd(snap.required)}*\n` +
    `Cash played: *${formatUsd(snap.played)}*\n` +
    `Left: *${formatUsd(snap.remaining)}*\n` +
    `${progressBar(snap.progress)} ${Math.round(snap.progress * 100)}%\n\n` +
    (snap.done
      ? `✅ Play-through met — withdraw allowed (fee + min still apply).`
      : `⏳ Keep playing cash tickets to unlock withdraw.`)
    + `\n\n🏁 Cash play also counts toward *Daily wager contest*.`
  );
}

async function assertCanWithdraw(telegramId) {
  const snap = await getWagerSnapshot(telegramId);
  if (!snap.done && snap.deposited > 0) {
    const err = new Error(
      `Play-through not met. Play ${formatUsd(snap.remaining)} more in cash tickets ` +
        `(${snap.percent}% of deposits this cycle).`
    );
    err.code = 'PLAYTHROUGH';
    err.snapshot = snap;
    throw err;
  }
  return snap;
}

module.exports = {
  getWagerSnapshot,
  formatWagerCard,
  progressBar,
  assertCanWithdraw,
  playthroughPercent,
};
