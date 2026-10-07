const { query } = require('../database');

/**
 * Lightweight fraud / anti-collusion filters.
 * Note: Telegram Bot API does not expose client IP addresses.
 * We use behavioural signals instead.
 */

async function flag(userId, reason, severity = 'medium', meta = {}) {
  const bump = severity === 'high' ? 25 : severity === 'medium' ? 10 : 5;
  await query(
    `INSERT INTO fraud_flags (user_id, reason, severity, meta)
     VALUES ($1::bigint, $2, $3, $4::jsonb)`,
    [userId, reason, severity, JSON.stringify(meta || {})]
  );
  await query(
    `UPDATE users
     SET risk_score = LEAST(100, COALESCE(risk_score, 0) + $2::int)
     WHERE telegram_id = $1::bigint`,
    [userId, bump]
  );
}

async function checkRapidPlay(userId) {
  const res = await query(
    `SELECT COUNT(*) AS c FROM tickets
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '2 minutes'`,
    [userId]
  );
  if (Number(res.rows[0].c) >= 8) {
    await flag(userId, 'rapid_play', 'medium', { window: '2m', count: res.rows[0].c });
    return true;
  }
  return false;
}

async function checkReferralRing(userId) {
  // Same referrer with many accounts that only play once and withdraw
  const user = await query(`SELECT referred_by FROM users WHERE telegram_id = $1`, [userId]);
  const ref = user.rows[0]?.referred_by;
  if (!ref) return false;

  const ring = await query(
    `SELECT COUNT(*) AS c FROM users WHERE referred_by = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
    [ref]
  );
  if (Number(ring.rows[0].c) >= 10) {
    await flag(userId, 'referral_ring_suspect', 'high', { referrer: ref, count_24h: ring.rows[0].c });
    await query(
      `INSERT INTO collusion_signals (user_ids, signal_type, score, details)
       VALUES (ARRAY[$1::bigint, $2::bigint], 'referral_ring', 70, $3::jsonb)`,
      [userId, ref, JSON.stringify({ count_24h: Number(ring.rows[0].c) })]
    );
    return true;
  }
  return false;
}

async function checkWinBurst(userId) {
  const res = await query(
    `SELECT COALESCE(SUM(total_prize_usd),0) AS won FROM tickets
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [userId]
  );
  if (Number(res.rows[0].won) >= 50) {
    await flag(userId, 'win_burst', 'medium', { won_1h: res.rows[0].won });
    return true;
  }
  return false;
}

async function runPrePlayChecks(userId) {
  const flags = [];
  if (await checkRapidPlay(userId)) flags.push('rapid_play');
  if (await checkReferralRing(userId)) flags.push('referral_ring');
  return flags;
}

async function runPostPlayChecks(userId) {
  await checkWinBurst(userId);
}

async function getOpenFlags(limit = 50) {
  const res = await query(
    `SELECT f.*, u.username FROM fraud_flags f
     LEFT JOIN users u ON u.telegram_id = f.user_id
     WHERE f.resolved = FALSE
     ORDER BY f.created_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

module.exports = {
  flag,
  checkRapidPlay,
  checkReferralRing,
  checkWinBurst,
  runPrePlayChecks,
  runPostPlayChecks,
  getOpenFlags,
};
