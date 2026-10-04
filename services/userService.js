const { query } = require('../database');
const config = require('../config');

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function findOrCreateUser(telegramUser, referredBy = null) {
  const { id, username, first_name, last_name, language_code } = telegramUser;

  let res = await query(`SELECT * FROM users WHERE telegram_id = $1`, [id]);

  if (res.rows[0]) {
    await query(
      `UPDATE users SET username = $2, first_name = $3, last_name = $4,
       language_code = $5, last_active_at = NOW(), updated_at = NOW()
       WHERE telegram_id = $1`,
      [id, username || null, first_name || null, last_name || null, language_code || 'en']
    );
    return (await query(`SELECT * FROM users WHERE telegram_id = $1`, [id])).rows[0];
  }

  const referralCode = generateReferralCode();
  let referrerId = null;

  if (referredBy) {
    const asNum = Number(referredBy);
    const ref = await query(
      `SELECT telegram_id FROM users
       WHERE referral_code = $1
          OR telegram_id = $2::bigint`,
      [String(referredBy), Number.isFinite(asNum) ? asNum : 0]
    );
    if (ref.rows[0]) referrerId = ref.rows[0].telegram_id;
  }

  res = await query(
    `INSERT INTO users (
       telegram_id, username, first_name, last_name, language_code, referral_code, referred_by,
       daily_limit_usd, session_limit_usd
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [
      id,
      username || null,
      first_name || null,
      last_name || null,
      language_code || 'en',
      referralCode,
      referrerId,
      config.defaultDailyLimitUsd,
      config.defaultSessionLimitUsd,
    ]
  );

  // Welcome + referral bonuses applied after age+captcha verification
  return res.rows[0];
}

async function applyWelcomeIfEligible(telegramId) {
  // Cash welcome/referral bonuses removed — grant LOCKED free tickets only
  const ticketCreditService = require('./ticketCreditService');
  return ticketCreditService.grantWelcomeLocked(telegramId);
}

async function getUser(telegramId) {
  const res = await query(`SELECT * FROM users WHERE telegram_id = $1`, [telegramId]);
  return res.rows[0] || null;
}

async function setYearOfBirth(telegramId, year) {
  const currentYear = new Date().getFullYear();
  const age = currentYear - year;
  if (year < 1920 || year > currentYear - config.minAge) {
    throw new Error(`You must be ${config.minAge}+ to play. Enter a valid year of birth.`);
  }
  await query(
    `UPDATE users SET year_of_birth = $2, age_verified_at = NOW(), updated_at = NOW()
     WHERE telegram_id = $1`,
    [telegramId, year]
  );
  return age;
}

async function setCaptchaPassed(telegramId) {
  await query(
    `UPDATE users SET captcha_passed_at = NOW(), updated_at = NOW() WHERE telegram_id = $1`,
    [telegramId]
  );
}

async function needsOnboarding(user) {
  if (!user) return true;
  if (!user.age_verified_at) return true;
  if (!user.captcha_passed_at) return true;
  return false;
}

async function creditBalance(telegramId, amountUsd, type, referenceId = null, meta = {}) {
  const client = await require('../database').getClient();
  try {
    await client.query('BEGIN');
    const u = await client.query(
      `UPDATE users SET balance_usd = balance_usd + $1, updated_at = NOW()
       WHERE telegram_id = $2 RETURNING balance_usd`,
      [amountUsd, telegramId]
    );
    if (!u.rows[0]) throw new Error('User not found');
    const balanceAfter = u.rows[0].balance_usd;
    await client.query(
      `INSERT INTO transactions (user_id, type, amount_usd, balance_after, reference_id, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [telegramId, type, amountUsd, balanceAfter, referenceId, meta]
    );
    await client.query('COMMIT');
    return balanceAfter;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function debitBalance(telegramId, amountUsd, type, referenceId = null, meta = {}) {
  const client = await require('../database').getClient();
  try {
    await client.query('BEGIN');
    const u = await client.query(
      `UPDATE users SET balance_usd = balance_usd - $1, total_wagered = total_wagered + $1, updated_at = NOW()
       WHERE telegram_id = $2 AND balance_usd >= $1 RETURNING balance_usd`,
      [amountUsd, telegramId]
    );
    if (!u.rows[0]) throw new Error('Insufficient balance');
    const balanceAfter = u.rows[0].balance_usd;
    await client.query(
      `INSERT INTO transactions (user_id, type, amount_usd, balance_after, reference_id, meta)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [telegramId, type, -amountUsd, balanceAfter, referenceId, meta]
    );
    await client.query('COMMIT');
    return balanceAfter;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function setLimits(telegramId, dailyLimit, sessionLimit) {
  await query(
    `UPDATE users SET daily_limit_usd = $2, session_limit_usd = $3, updated_at = NOW()
     WHERE telegram_id = $1`,
    [telegramId, dailyLimit, sessionLimit]
  );
}

async function selfExclude(telegramId, until) {
  await query(
    `UPDATE users SET self_excluded_until = $2, updated_at = NOW() WHERE telegram_id = $1`,
    [telegramId, until]
  );
}

async function isSelfExcluded(user) {
  if (!user.self_excluded_until) return false;
  return new Date(user.self_excluded_until) > new Date();
}

module.exports = {
  findOrCreateUser,
  getUser,
  creditBalance,
  debitBalance,
  setLimits,
  selfExclude,
  isSelfExcluded,
  generateReferralCode,
  setYearOfBirth,
  setCaptchaPassed,
  needsOnboarding,
  applyWelcomeIfEligible,
};
