const userService = require('../../services/userService');
const config = require('../../config');
const { formatUsd } = require('../../utils/helpers');
const { query } = require('../../database');
const { Markup } = require('telegraf');

module.exports = async function referral(ctx) {
  const user = await userService.getUser(ctx.from.id);
  if (!user) return ctx.reply('Please /start first');

  const botUser = config.botUsername || process.env.NEXT_PUBLIC_BOT_USERNAME || 'LottoWinBot';
  const link = `https://t.me/${botUser}?start=${user.referral_code}`;

  const stats = await query(
    `SELECT COUNT(*)::int AS c FROM users WHERE referred_by = $1`,
    [ctx.from.id]
  );
  const rewards = await query(
    `SELECT COALESCE(SUM(amount_usd),0) AS s FROM referral_rewards WHERE referrer_id = $1`,
    [ctx.from.id]
  );

  const text =
    `👥 *Refer & Earn*\n\n` +
    `Share the spark. When friends play for real, you climb the battle board *and* earn.\n\n` +
    `Your link:\n\`${link}\`\n\n` +
    `🎁 *${config.referralFreeTickets}* free tickets when they deposit ≥ *${formatUsd(config.minDepositUsd)}* and place their *first cash bet*\n` +
    `💸 *${config.referralPercent}%* of their ongoing *cash* ticket spend\n` +
    `⚔️ Weekly *Referral battle* — top referrers share a prize pool\n\n` +
    `Friends joined: *${stats.rows[0].c}*\n` +
    `Commission earned: *${formatUsd(rewards.rows[0].s)}*\n\n` +
    `_Free tickets don't count as their cash volume — real play does._`;

  await ctx.replyWithMarkdown(
    text,
    Markup.inlineKeyboard([[Markup.button.callback('⚔️ Referral battle', 'ux:battle')]])
  );
};
