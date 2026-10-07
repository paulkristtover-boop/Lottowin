const { query } = require('../database');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

async function createBroadcast({ title, message, audience = 'all', createdBy }) {
  const id = uuidv4();
  await query(
    `INSERT INTO broadcasts (id, title, message, audience, status, created_by)
     VALUES ($1, $2, $3, $4, 'pending', $5)`,
    [id, title || null, message, audience, createdBy || null]
  );
  return id;
}

/**
 * Player audience only — never include admin IDs.
 */
async function getAudienceIds(audience) {
  const adminIds = config.adminIds.length ? config.adminIds : [0];
  let sql = `
    SELECT telegram_id FROM users
    WHERE is_banned = FALSE
      AND telegram_id != ALL($1::bigint[])
  `;
  const params = [adminIds];

  if (audience === 'active') {
    sql += ` AND last_active_at > NOW() - INTERVAL '7 days'`;
  } else if (audience === 'depositors') {
    sql += ` AND total_deposited > 0`;
  }

  const res = await query(sql, params);
  return res.rows.map((r) => Number(r.telegram_id));
}

async function sendBroadcast(bot, broadcastId) {
  const b = await query(`SELECT * FROM broadcasts WHERE id = $1`, [broadcastId]);
  if (!b.rows[0]) return { sent: 0, fail: 0, total: 0, error: 'not_found' };
  if (b.rows[0].status === 'done') return { sent: b.rows[0].sent_count, fail: b.rows[0].fail_count, total: 0 };

  const row = b.rows[0];
  await query(`UPDATE broadcasts SET status = 'sending' WHERE id = $1`, [broadcastId]);

  const ids = await getAudienceIds(row.audience);
  let sent = 0;
  let fail = 0;

  for (const tid of ids) {
    try {
      // Prefer Markdown; fall back to plain text if parse fails
      try {
        await bot.telegram.sendMessage(tid, row.message, { parse_mode: 'Markdown' });
      } catch (e) {
        if (String(e.message || '').includes("can't parse") || e.response?.error_code === 400) {
          await bot.telegram.sendMessage(tid, row.message);
        } else {
          throw e;
        }
      }
      sent += 1;
    } catch {
      fail += 1;
    }
    await new Promise((r) => setTimeout(r, 45));
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
    try {
      await bot.telegram.sendMessage(telegramId, message, { parse_mode: 'Markdown' });
    } catch (e) {
      if (String(e.message || '').includes("can't parse") || e.response?.error_code === 400) {
        await bot.telegram.sendMessage(telegramId, message);
      } else {
        throw e;
      }
    }
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
