/**
 * Free ticket credits — anti bonus-farming.
 * Welcome tickets start LOCKED; unlock only after first real deposit >= MIN_DEPOSIT.
 * Referral tickets unlock for referrer after referred user's first real-money bet.
 */
const { query, getClient } = require('../database');
const config = require('../config');
const logger = require('../utils/logger');

function progressBar(done, total, width = 10) {
  const t = Math.max(1, total);
  const filled = Math.min(width, Math.round((done / t) * width));
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}]`;
}

/**
 * Grant locked welcome tickets after age+captcha (no cash).
 */
async function grantWelcomeLocked(telegramId) {
  const user = (await query(`SELECT * FROM users WHERE telegram_id = $1`, [telegramId])).rows[0];
  if (!user) return null;
  if (user.welcome_tickets_granted) return user;
  if (!user.age_verified_at || !user.captcha_passed_at) return user;

  const n = Number(config.welcomeFreeTickets) || 0;
  if (n <= 0) {
    await query(`UPDATE users SET welcome_tickets_granted = TRUE WHERE telegram_id = $1`, [telegramId]);
    return (await query(`SELECT * FROM users WHERE telegram_id = $1`, [telegramId])).rows[0];
  }

  await query(
    `UPDATE users SET
       locked_tickets = locked_tickets + $2,
       welcome_tickets_granted = TRUE,
       welcome_bonus_claimed = TRUE,
       updated_at = NOW()
     WHERE telegram_id = $1 AND welcome_tickets_granted = FALSE`,
    [telegramId, n]
  );
  await query(
    `INSERT INTO ticket_credits (user_id, delta_locked, reason, meta)
     VALUES ($1, $2, 'welcome_locked', $3)`,
    [telegramId, n, { tickets: n }]
  );
  return (await query(`SELECT * FROM users WHERE telegram_id = $1`, [telegramId])).rows[0];
}

/**
 * On successful deposit >= min: unlock welcome tickets (once).
 */
async function onSuccessfulDeposit(telegramId, amountUsd) {
  const amt = Number(amountUsd) || 0;
  if (amt < Number(config.minDepositUsd)) return { unlocked: 0 };

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const u = await client.query(
      `SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE`,
      [telegramId]
    );
    const user = u.rows[0];
    if (!user) {
      await client.query('ROLLBACK');
      return { unlocked: 0 };
    }

    let unlocked = 0;
    const first = !user.is_first_deposit_completed;

    if (first) {
      unlocked = Number(user.locked_tickets) || 0;
      await client.query(
        `UPDATE users SET
           is_first_deposit_completed = TRUE,
           unlocked_tickets = unlocked_tickets + locked_tickets,
           locked_tickets = 0,
           updated_at = NOW()
         WHERE telegram_id = $1`,
        [telegramId]
      );
      if (unlocked > 0) {
        await client.query(
          `INSERT INTO ticket_credits (user_id, delta_locked, delta_unlocked, reason, meta)
           VALUES ($1, $2, $3, 'welcome_unlock', $4)`,
          [telegramId, -unlocked, unlocked, { deposit: amt }]
        );
      } else {
        // still mark first deposit even if no locked tickets
        await client.query(
          `UPDATE users SET is_first_deposit_completed = TRUE, updated_at = NOW()
           WHERE telegram_id = $1`,
          [telegramId]
        );
      }
    }

    await client.query('COMMIT');
    return { unlocked, firstDeposit: first };
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('onSuccessfulDeposit', e.message);
    throw e;
  } finally {
    client.release();
  }
}

/**
 * After referred user places first cash bet: give referrer free tickets.
 */
async function tryUnlockReferralTickets(referrerId, referredId) {
  if (!referrerId || !referredId) return 0;
  const n = Number(config.referralFreeTickets) || 0;
  if (n <= 0) return 0;

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const ref = await client.query(
      `SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE`,
      [referredId]
    );
    const referred = ref.rows[0];
    if (!referred || referred.referral_tickets_claimed) {
      await client.query('ROLLBACK');
      return 0;
    }

    await client.query(
      `UPDATE users SET referral_tickets_claimed = TRUE, updated_at = NOW()
       WHERE telegram_id = $1`,
      [referredId]
    );
    await client.query(
      `UPDATE users SET unlocked_tickets = unlocked_tickets + $2, updated_at = NOW()
       WHERE telegram_id = $1`,
      [referrerId, n]
    );
    await client.query(
      `INSERT INTO ticket_credits (user_id, delta_unlocked, reason, meta)
       VALUES ($1, $2, 'referral_unlock', $3)`,
      [referrerId, n, { referred: referredId }]
    );
    await client.query(
      `INSERT INTO referral_rewards (referrer_id, referred_id, amount_usd, reason)
       VALUES ($1, $2, 0, 'free_tickets')`,
      [referrerId, referredId]
    );
    await client.query('COMMIT');
    return n;
  } catch (e) {
    await client.query('ROLLBACK');
    logger.error('tryUnlockReferralTickets', e.message);
    return 0;
  } finally {
    client.release();
  }
}

async function getTodayCashSpend(telegramId) {
  const d = new Date().toISOString().slice(0, 10);
  const res = await query(
    `SELECT spent_usd FROM daily_spend WHERE user_id = $1 AND period_date = $2::date`,
    [telegramId, d]
  );
  return res.rows[0] ? Number(res.rows[0].spent_usd) : 0;
}

async function addTodayCashSpend(client, telegramId, amount) {
  const d = new Date().toISOString().slice(0, 10);
  await client.query(
    `INSERT INTO daily_spend (user_id, period_date, spent_usd)
     VALUES ($1, $2::date, $3::numeric)
     ON CONFLICT (user_id, period_date) DO UPDATE SET
       spent_usd = daily_spend.spent_usd + EXCLUDED.spent_usd`,
    [telegramId, d, amount]
  );
}

module.exports = {
  progressBar,
  grantWelcomeLocked,
  onSuccessfulDeposit,
  tryUnlockReferralTickets,
  getTodayCashSpend,
  addTodayCashSpend,
};
