const userService = require('../../services/userService');
const config = require('../../config');
const { mainMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');
const { query } = require('../../database');

module.exports = async function referral(ctx) {
  const user = await userService.getUser(ctx.from.id);
  if (!user) return ctx.reply('Please /start first');

  const botUser = config.botUsername || 'LottoWinBot';
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
    `Your link:\n\`${link}\`\n\n` +
    `• When a friend deposits ≥ ${formatUsd(config.minDepositUsd)} and places their *first real bet*, you get *${config.referralFreeTickets} free tickets*.\n` +
    `• Ongoing: *${config.referralPercent}%* of their cash ticket spend (not free tickets).\n\n` +
    `Friends referred: *${stats.rows[0].c}*\n` +
    `Commission earned: *${formatUsd(rewards.rows[0].s)}*`;

  await ctx.replyWithMarkdown(text, mainMenu());
};
