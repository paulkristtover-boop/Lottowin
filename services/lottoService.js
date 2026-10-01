const { query, getClient } = require('../database');
const config = require('../config');
const userService = require('./userService');
const rngService = require('./rngService');
const liabilityService = require('./liabilityService');
const taxService = require('./taxService');
const fraudService = require('./fraudService');
const ticketCreditService = require('./ticketCreditService');
const { v4: uuidv4 } = require('uuid');

function countMatches(userNums, winning) {
  const set = new Set(winning);
  return userNums.filter((n) => set.has(n)).length;
}

function validateLine(numbers) {
  if (!Array.isArray(numbers) || numbers.length !== 4) return false;
  const set = new Set(numbers);
  if (set.size !== 4) return false;
  return numbers.every((n) => Number.isInteger(n) && n >= 1 && n <= 40);
}

function quickPick() {
  return rngService.drawAuto().numbers;
}

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
  if (config.adminIds.includes(Number(telegramId))) {
    throw new Error('Admin accounts cannot play');
  }
  if (await userService.isSelfExcluded(user)) {
    throw new Error('You are currently self-excluded. Take a break.');
  }
  if (!user.age_verified_at) {
    throw new Error('Please verify your year of birth first (/start)');
  }
  if (!user.captcha_passed_at) {
    throw new Error('Please complete verification first (/start)');
  }

  const lineCount = lines.length;
  const cost = lineCount * config.playCostUsd;
  const freeAvail = Number(user.unlocked_tickets) || 0;
  const freeUsed = Math.min(freeAvail, lineCount);
  const cashLines = lineCount - freeUsed;
  const cashCost = cashLines * config.playCostUsd;

  if (Number(user.balance_usd) < cashCost) {
    throw new Error(
      `Insufficient balance. Need $${cashCost.toFixed(2)} cash for ${cashLines} line(s) ` +
        `(${freeUsed} free ticket(s) available). Have $${Number(user.balance_usd).toFixed(2)}. Deposit to play.`
    );
  }

  // Daily spend limit applies to CASH only
  if (cashCost > 0) {
    const todaySpent = await ticketCreditService.getTodayCashSpend(telegramId);
    const dailyCap = Number(user.daily_limit_usd || config.defaultDailyLimitUsd);
    if (todaySpent + cashCost > dailyCap) {
      throw new Error(`Daily spend limit reached ($${dailyCap}). Adjust in Responsible Gaming.`);
    }
  }

  // Hard reject if theoretical max payout (all Match 4) would exceed remaining daily liability
  const maxLinePrize = Number(config.prizesUsd[4] || config.maxPrizePerLineUsd);
  const theoreticalMax = Math.min(
    lineCount * maxLinePrize,
    Number(config.maxPrizePerTicketUsd)
  );
  const paidToday = await liabilityService.getTodayPrizesPaid();
  const remainingLiab = Math.max(0, Number(config.dailyLiabilityCapUsd) - paidToday);
  if (theoreticalMax > remainingLiab) {
    throw new Error(
      'Daily prize pool is near capacity. Please try again later (liability protection).'
    );
  }

  await fraudService.runPrePlayChecks(telegramId);

  const draw = await rngService.getNextDraw();
  const winningNumbers = draw.numbers;

  const rawResults = lines.map((nums) => {
    const sorted = [...nums].sort((a, b) => a - b);
    const matches = countMatches(sorted, winningNumbers);
    return { numbers: sorted, matches, prize: 0 };
  });

  const graded = await liabilityService.applyTicketLiability(rawResults);
  const totalPrize = graded.totalPrize;
  const results = graded.lines;

  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock user row
    const locked = await client.query(
      `SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE`,
      [telegramId]
    );
    const urow = locked.rows[0];
    if (!urow) throw new Error('User not found');

    let freeNow = Number(urow.unlocked_tickets) || 0;
    const freeUse = Math.min(freeNow, lineCount);
    const cashUse = lineCount - freeUse;
    const cashPay = cashUse * config.playCostUsd;

    if (Number(urow.balance_usd) < cashPay) throw new Error('Insufficient balance');

    if (freeUse > 0) {
      await client.query(
        `UPDATE users SET unlocked_tickets = unlocked_tickets - $1, updated_at = NOW()
         WHERE telegram_id = $2 AND unlocked_tickets >= $1`,
        [freeUse, telegramId]
      );
      await client.query(
        `INSERT INTO ticket_credits (user_id, delta_unlocked, reason, meta)
         VALUES ($1, $2, 'play_consume', $3)`,
        [telegramId, -freeUse, { lines: freeUse }]
      );
    }

    let balanceAfter = Number(urow.balance_usd);
    if (cashPay > 0) {
      const debit = await client.query(
        `UPDATE users SET balance_usd = balance_usd - $1, total_wagered = total_wagered + $1, updated_at = NOW()
         WHERE telegram_id = $2 AND balance_usd >= $1 RETURNING balance_usd`,
        [cashPay, telegramId]
      );
      if (!debit.rows[0]) throw new Error('Insufficient balance');
      balanceAfter = Number(debit.rows[0].balance_usd);
      await ticketCreditService.addTodayCashSpend(client, telegramId, cashPay);
    }

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
      `INSERT INTO tickets (id, user_id, lines, cost_usd, total_prize_usd, prize_before_cap, liability_capped, winning_numbers, rng_seed, rng_source, status)
       VALUES (
         $1::uuid, $2::bigint, $3::jsonb, $4::numeric, $5::numeric, $6::numeric, $7::boolean,
         $8::int[], $9::text, $10::text, 'completed'
       )`,
      [
        ticketId,
        telegramId,
        JSON.stringify(results),
        cashPay,
        totalPrize,
        graded.prizeBeforeCap,
        graded.liabilityCapped,
        winningNumbers,
        draw.seed,
        draw.source,
      ]
    );

    await client.query(
      `INSERT INTO transactions (user_id, type, amount_usd, balance_after, reference_id, meta)
       VALUES ($1, 'play', $2, $3, $4, $5)`,
      [telegramId, -cashPay, balanceAfter - totalPrize, ticketId, { lines: lineCount, free: freeUse, cash: cashUse }]
    );

    if (totalPrize > 0) {
      await client.query(
        `INSERT INTO transactions (user_id, type, amount_usd, balance_after, reference_id, meta)
         VALUES ($1, 'win', $2, $3, $4, $5)`,
        [
          telegramId,
          totalPrize,
          balanceAfter,
          ticketId,
          { matches: results.map((r) => r.matches), capped: graded.liabilityCapped },
        ]
      );
    }

    if (user.referred_by && config.referralPercent > 0) {
      const refAmount = (cashPay * config.referralPercent) / 100;
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

    // First real-money bet → unlock referral free tickets for referrer
    if (cashPay > 0 && user.referred_by) {
      try {
        if (!user.first_real_bet_at) {
          await query(
            `UPDATE users SET first_real_bet_at = NOW() WHERE telegram_id = $1 AND first_real_bet_at IS NULL`,
            [telegramId]
          );
          const given = await ticketCreditService.tryUnlockReferralTickets(user.referred_by, telegramId);
          if (given > 0 && typeof global.notifyReferralTickets === 'function') {
            /* optional hook */
          }
        }
      } catch (e) {
        console.error('[play] referral ticket unlock', e.message);
      }
    }

    // Bookkeeping after commit — must NOT fail the user-facing play result
    try {
      await rngService.logRngForTicket(ticketId, draw);
    } catch (e) {
      console.error('[play] rng log failed', e.message);
    }
    try {
      await liabilityService.recordPrizesPaid(totalPrize, 1, graded.liabilityCapped);
    } catch (e) {
      console.error('[play] liability log failed', e.message);
    }
    try {
      await taxService.recordPlay(cashPay, totalPrize);
    } catch (e) {
      console.error('[play] tax ledger failed', e.message);
    }
    try {
      await fraudService.runPostPlayChecks(telegramId);
    } catch (e) {
      console.error('[play] fraud check failed', e.message);
    }

    return {
      ticketId,
      winningNumbers,
      results,
      cost: cashPay,
      faceCost: lineCount * config.playCostUsd,
      freeTicketsUsed: freeUse,
      cashLines: cashUse,
      totalPrize,
      prizeBeforeCap: graded.prizeBeforeCap,
      liabilityCapped: graded.liabilityCapped,
      balanceAfter,
      rngSource: draw.source,
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
  countMatches,
  validateLine,
  quickPick,
  play,
  getRecentTickets,
  getStatement,
  getTodayWagered,
};
