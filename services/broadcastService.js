const { query } = require('../database');
const { v4: uuidv4 } = require('uuid');

/**
 * Push / broadcast engine.
 * Requires a Telegraf bot instance to actually send.
 */

async function createBroadcast({ title, message, audience = 'all', createdBy }) {
  const id = uuidv4();
  await query(
    `INSERT INTO broadcasts (id, title, message, audience, status, created_by)
     VALUES ($1, $2, $3, $4, 'pending', $5)`,
    [id, title || null, message, audience, createdBy || null]
  );
  return id;
}

async function getAudienceIds(audience) {
  let sql = `SELECT telegram_id FROM users WHERE is_banned = FALSE`;
  if (audience === 'active') {
    sql += ` AND last_active_at > NOW() - INTERVAL '7 days'`;
  } else if (audience === 'depositors') {
    sql += ` AND total_deposited > 0`;
  }
  const res = await query(sql);
  return res.rows.map((r) => r.telegram_id);
}

/**
 * Send broadcast. bot = Telegraf instance.
 * Runs sequentially with small delay to respect Telegram limits.
 */
async function sendBroadcast(bot, broadcastId) {
  const b = await query(`SELECT * FROM broadcasts WHERE id = $1`, [broadcastId]);
  if (!b.rows[0] || b.rows[0].status === 'done') return null;
  const row = b.rows[0];

  await query(`UPDATE broadcasts SET status = 'sending' WHERE id = $1`, [broadcastId]);

  const ids = await getAudienceIds(row.audience);
  let sent = 0;
  let fail = 0;

  for (const tid of ids) {
    try {
      await bot.telegram.sendMessage(tid, row.message, { parse_mode: 'Markdown' });
      sent += 1;
    } catch {
      fail += 1;
    }
    // ~25 msg/sec safe-ish
    await new Promise((r) => setTimeout(r, 40));
  }

  await query(
    `UPDATE broadcasts SET status = 'done', sent_count = $2, fail_count = $3, completed_at = NOW()
     WHERE id = $1`,
    [broadcastId, sent, fail]
  );

  return { sent, fail, total: ids.length };
}

async function notifyUser(bot, telegramId, message) {
  try {
    await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    return true;
  } catch {
    return false;
  }
}

async function listRecent(limit = 20) {
  const res = await query(
    `SELECT * FROM broadcasts ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return res.rows;
}

module.exports = {
  createBroadcast,
  sendBroadcast,
  notifyUser,
  listRecent,
  getAudienceIds,
};
