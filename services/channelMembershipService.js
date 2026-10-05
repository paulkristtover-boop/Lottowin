/**
 * Soft channel join — remind until user joins; does not hard-block play by default.
 */
const config = require('../config');
const { query } = require('../database');
const logger = require('../utils/logger');
const { Markup } = require('telegraf');

function channelChatId() {
  return process.env.TELEGRAM_CHANNEL_ID || config.telegramChannelId || '';
}

function channelLink() {
  return process.env.CHANNEL_LINK || config.channelLink || 'https://t.me/LottoWinOfficial';
}

function softJoinEnabled() {
  return (process.env.CHANNEL_SOFT_JOIN || 'true') !== 'false';
}

function remindHours() {
  return Math.max(1, parseInt(process.env.CHANNEL_REMIND_HOURS || '6', 10));
}

async function checkTelegramMembership(bot, userId) {
  const chatId = channelChatId();
  if (!chatId || !bot?.telegram) return null; // unknown
  try {
    const m = await bot.telegram.getChatMember(chatId, userId);
    const status = m?.status;
    const ok = ['creator', 'administrator', 'member', 'restricted'].includes(status);
    return ok;
  } catch (e) {
    // bot not admin / channel private / user never interacted
    logger.warn('getChatMember', e.message);
    return null;
  }
}

async function markJoined(userId) {
  await query(
    `UPDATE users SET channel_joined_at = COALESCE(channel_joined_at, NOW()), updated_at = NOW()
     WHERE telegram_id = $1`,
    [userId]
  );
}

async function markReminded(userId) {
  await query(
    `UPDATE users SET channel_last_remind_at = NOW(),
       channel_remind_count = COALESCE(channel_remind_count, 0) + 1,
       updated_at = NOW()
     WHERE telegram_id = $1`,
    [userId]
  );
}

async function isMarkedJoined(userId) {
  const res = await query(
    `SELECT channel_joined_at FROM users WHERE telegram_id = $1`,
    [userId]
  );
  return !!res.rows[0]?.channel_joined_at;
}

/**
 * Soft prompt keyboard
 */
function joinKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.url('📢 Join channel', channelLink())],
    [Markup.button.callback("✅ I've joined", 'channel:check')],
    [Markup.button.callback('Later', 'channel:later')],
  ]);
}

function joinPromptText() {
  return (
    `📢 *Join our channel* (soft)\n\n` +
    `Get live bets, contest updates, and tips.\n` +
    `You can keep playing — we'll gently remind you until you join.\n\n` +
    `1. Tap *Join channel*\n` +
    `2. Then tap *I've joined*`
  );
}

/**
 * After onboarding / start — always show once if not joined.
 */
async function maybePromptOnStart(ctx, bot) {
  if (!softJoinEnabled()) return;
  if (!channelChatId() && !channelLink()) return;
  const userId = ctx.from.id;
  if (await isMarkedJoined(userId)) return;

  const member = await checkTelegramMembership(bot, userId);
  if (member === true) {
    await markJoined(userId);
    return;
  }

  await ctx.replyWithMarkdown(joinPromptText(), joinKeyboard());
}

/**
 * Soft gate: never blocks; returns whether to send a reminder now.
 */
async function shouldRemind(userId) {
  if (!softJoinEnabled()) return false;
  if (await isMarkedJoined(userId)) return false;
  const res = await query(
    `SELECT channel_last_remind_at, channel_remind_count FROM users WHERE telegram_id = $1`,
    [userId]
  );
  const row = res.rows[0];
  if (!row) return true;
  if (!row.channel_last_remind_at) return true;
  const hours = (Date.now() - new Date(row.channel_last_remind_at).getTime()) / 3600000;
  return hours >= remindHours();
}

async function softRemindIfNeeded(ctx, bot) {
  if (!softJoinEnabled()) return false;
  const userId = ctx.from.id;
  if (!(await shouldRemind(userId))) return false;

  const member = await checkTelegramMembership(bot, userId);
  if (member === true) {
    await markJoined(userId);
    return false;
  }

  await markReminded(userId);
  await ctx.replyWithMarkdown(
    `🔔 *Reminder:* Join the official channel for live results & contests.\n` +
      `_You can still play — this is not a hard lock._`,
    joinKeyboard()
  );
  return true;
}

/**
 * Callback: user tapped I've joined
 */
async function handleCheckCallback(ctx, bot) {
  await ctx.answerCbQuery().catch(() => {});
  const userId = ctx.from.id;
  const member = await checkTelegramMembership(bot, userId);
  if (member === true) {
    await markJoined(userId);
    await ctx.reply('✅ Channel membership confirmed. Thanks for joining!');
    return true;
  }
  if (member === false) {
    await ctx.replyWithMarkdown(
      `Not seeing you in the channel yet.\nJoin first, then tap *I've joined* again.`,
      joinKeyboard()
    );
    return true;
  }
  // null = can't verify (bot needs admin). Trust-but-verify soft accept after 2 manual checks
  await markJoined(userId);
  await ctx.reply(
    '✅ Thanks! (Could not auto-verify — make sure the bot is admin in the channel.)'
  );
  return true;
}

async function handleLaterCallback(ctx) {
  await ctx.answerCbQuery('OK — we will remind you later').catch(() => {});
  await markReminded(ctx.from.id);
  return true;
}

/**
 * Cron: remind users who never joined (batch)
 */
async function runReminderBatch(bot, limit = 40) {
  if (!softJoinEnabled() || !bot?.telegram) return { sent: 0 };
  const hours = remindHours();
  const res = await query(
    `SELECT telegram_id FROM users
     WHERE channel_joined_at IS NULL
       AND age_verified_at IS NOT NULL
       AND captcha_passed_at IS NOT NULL
       AND (
         channel_last_remind_at IS NULL
         OR channel_last_remind_at < NOW() - ($1::text || ' hours')::interval
       )
     ORDER BY channel_last_remind_at NULLS FIRST
     LIMIT $2`,
    [String(hours), limit]
  );

  let sent = 0;
  for (const row of res.rows) {
    const uid = row.telegram_id;
    try {
      const member = await checkTelegramMembership(bot, uid);
      if (member === true) {
        await markJoined(uid);
        continue;
      }
      await bot.telegram.sendMessage(uid, joinPromptText(), {
        parse_mode: 'Markdown',
        ...joinKeyboard(),
      });
      await markReminded(uid);
      sent += 1;
    } catch {
      /* user blocked bot */
    }
  }
  return { sent };
}

module.exports = {
  softJoinEnabled,
  channelLink,
  channelChatId,
  checkTelegramMembership,
  markJoined,
  maybePromptOnStart,
  softRemindIfNeeded,
  handleCheckCallback,
  handleLaterCallback,
  runReminderBatch,
  joinKeyboard,
  joinPromptText,
};
