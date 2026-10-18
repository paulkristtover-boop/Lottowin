const userService = require('../../services/userService');
const { mainMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');

module.exports = async function balance(ctx) {
  const u = await userService.getUser(ctx.from.id);
  if (!u) return ctx.reply('Open /start first', mainMenu());
  await ctx.replyWithMarkdown(
    `💰 *Balance*\n\nCash: *${formatUsd(u.balance_usd)}*\nFree lines: *${u.free_lines || 0}*`,
    mainMenu()
  );
};
