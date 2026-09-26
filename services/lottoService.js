const { query, getClient } = require('../database');
const config = require('../config');
const userService = require('./userService');
const { v4: uuidv4 } = require('uuid');

/**
 * Draw 4 unique random numbers from 1-40
 */
function drawWinningNumbers() {
  const pool = Array.from({ length: 40 }, (_, i) => i + 1);
  const result = [];
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    result.push(pool.splice(idx, 1)[0]);
  }
  return result.sort((a, b) => a - b);
}

/**
 * Count matches between user numbers and winning numbers
 */
function countMatches(userNums, winning) {
  const set = new Set(winning);
  return userNums.filter((n) => set.has(n)).length;
}

/**
 * Validate a single line: exactly 4 unique numbers 1-40
 */
function validateLine(numbers) {
  if (!Array.isArray(numbers) || numbers.length !== 4) return false;
  const set = new Set(numbers);
  if (set.size !== 4) return false;
  return numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 40);
}

/**
 * Quick pick one line
 */
function quickPick() {
  return drawWinningNumbers();
}

/**
 * Play multiple lines
 * @param {number} telegramId
 * @param {number[][]} lines - array of [n1,n2,n3,n4]
 */
async function play(telegramId, lines) {
  if (!lines || lines.length === 0 || lines.length > config.maxLines) {
    throw new Error(`Choose between 1 and ${config.maxLines} lines`);
  }

  for (const line of lines) {
    if (!validateLine(line)) {
      throw new Error('Each line must contain exactly 4 unique numbers from 1 to 40');
    }
  }

  const user = await userService.getUser(telegramId);
  if (!user) throw new Error('User not found');
  if (user.is_banned) throw new Error('Account banned');
  if (await userService.isSelfExcluded(user)) {
    throw new Error('You are currently self-excluded. Take a break.');
  }

  const cost = lines.length * config.playCostUsd;
  if (Number(user.balance_usd) < cost) {
    throw new Error(`Insufficient balance. Need $${cost.toFixed(2)}, have $${Number(user.balance_usd).toFixed(2)}`);
  }

  // Daily / session limits (simple check)
  const todaySpent = await getTodayWagered(telegramId);
  if (todaySpent + cost > Number(user.daily_limit_usd || config.defaultDailyLimitUsd)) {
    throw new Error(`Daily limit reached ($${user.daily_limit_usd}). Adjust limits in Responsible Gaming.`);
  }

  const winningNumbers = drawWinningNumbers();
  const results = [];
  let totalPrize = 0;

  for (const nums of lines) {
    const sorted = [...nums].sort((a, b) => a - b);
    const matches = countMatches(sorted, winningNumbers);
    const multiplier = config.prizes[matches] || 0;
    const prize = multiplier * config.playCostUsd;
    totalPrize += prize;
    results.push({
      numbers: sorted,
      matches,
      prize,
      multiplier,
    });
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Debit cost
    const debit = await client.query(
      `UPDATE users SET balance_usd = balance_usd - $1, total_wagered = total_wagered + $1, updated_at = NOW()
       WHERE telegram_id = $2 AND balance_usd >= $1 RETURNING balance_usd`,
      [cost, telegramId]
    );
    if (!debit.rows[0]) throw new Error('Insufficient balance');

    let balanceAfter = Number(debit.rows[0].balance_usd);

    // Credit winnings if any
    if (totalPrize > 0) {
      const credit = await client.query(
        `UPDATE users SET balance_usd = balance_usd + $1, total_won = total_won + $1, updated_at = NOW()
         WHERE telegram_id = $2 RETURNING balance_usd`,
        [totalPrize, telegramId]
      );
      balanceAfter = Number(credit.rows[0].balance_usd);
    }

    const ticketId = uuidv4();
    await client.query(
      `INSERT INTO tickets (id, user_id, lines, cost_usd, total_prize_usd, winning_numbers, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed')`,
      [ticketId, telegramId, JSON.stringify(results), cost, totalPrize, winningNumbers]
    );

    await client.query(
      `INSERT INTO transactions (user_id, type, amount_usd, balance_after, reference_id, meta)
       VALUES ($1, 'play', $2, $3, $4, $5)`,
      [telegramId, -cost, balanceAfter - totalPrize, ticketId, { lines: lines.length }]
    );

    if (totalPrize > 0) {
      await client.query(
        `INSERT INTO transactions (user_id, type, amount_usd, balance_after, reference_id, meta)
         VALUES ($1, 'win', $2, $3, $4, $5)`,
        [telegramId, totalPrize, balanceAfter, ticketId, { matches: results.map((r) => r.matches) }]
      );
    }

    // Referral play percent (optional)
    if (user.referred_by && config.referralPercent > 0) {
      const refAmount = (cost * config.referralPercent) / 100;
      if (refAmount > 0) {
        await client.query(
          `UPDATE users SET balance_usd = balance_usd + $1 WHERE telegram_id = $2`,
          [refAmount, user.referred_by]
        );
        await client.query(
          `INSERT INTO referral_rewards (referrer_id, referred_id, amount_usd, reason)
           VALUES ($1, $2, $3, 'play_percent')`,
          [user.referred_by, telegramId, refAmount]
        );
      }
    }

    await client.query('COMMIT');

    return {
      ticketId,
      winningNumbers,
      results,
      cost,
      totalPrize,
      balanceAfter,
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getTodayWagered(telegramId) {
  const res = await query(
    `SELECT COALESCE(SUM(ABS(amount_usd)), 0) AS total
     FROM transactions
     WHERE user_id = $1 AND type = 'play' AND created_at >= CURRENT_DATE`,
    [telegramId]
  );
  return Number(res.rows[0].total);
}

async function getRecentTickets(telegramId, limit = 10) {
  const res = await query(
    `SELECT * FROM tickets WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [telegramId, limit]
  );
  return res.rows;
}

async function getStatement(telegramId, limit = 30) {
  const res = await query(
    `SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [telegramId, limit]
  );
  return res.rows;
}

module.exports = {
  drawWinningNumbers,
  countMatches,
  validateLine,
  quickPick,
  play,
  getRecentTickets,
  getStatement,
  getTodayWagered,
};
