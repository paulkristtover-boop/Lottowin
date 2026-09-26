const userService = require('../../services/userService');
const config = require('../../config');
const { formatUsd } = require('../../utils/helpers');
const { mainMenu } = require('../../utils/ui');

module.exports = async (ctx) => {
  const user = await userService.getUser(ctx.from.id);
  if (!user) return ctx.reply('Please /start first');

  const link = `https://t.me/${config.botUsername}?start=${user.referral_code}`;

  const text = `👥 *Referral Program*

Your code: \`${user.referral_code}\`
Your link:
\`${link}\`

*Rewards*
• ${formatUsd(config.referralBonusUsd)} when a friend joins
• ${config.referralPercent}% of their play volume

Share the link and earn while they play!

⚠️ Friends must be 18+.`;

  await ctx.replyWithMarkdown(text, mainMenu());
};
