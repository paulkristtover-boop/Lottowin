const userService = require('../../services/userService');
const { formatUsd } = require('../../utils/helpers');
const { mainMenu } = require('../../utils/ui');

module.exports = async (ctx) => {
  const user = await userService.getUser(ctx.from.id);
  if (!user) return ctx.reply('Please /start first');

  const text = `💰 *Your Balance*

Available: *${formatUsd(user.balance_usd)}*

Total deposited: ${formatUsd(user.total_deposited)}
Total withdrawn: ${formatUsd(user.total_withdrawn)}
Total wagered: ${formatUsd(user.total_wagered)}
Total won: ${formatUsd(user.total_won)}

Daily limit: ${formatUsd(user.daily_limit_usd)}
Session limit: ${formatUsd(user.session_limit_usd)}`;

  await ctx.replyWithMarkdown(text, mainMenu());
};
