const userService = require('../../services/userService');
const { formatUsd } = require('../../utils/helpers');
const { mainMenu } = require('../../utils/ui');

module.exports = async function balance(ctx) {
  const user = await userService.getUser(ctx.from.id);
  if (!user) return ctx.reply('Please /start first');
  const text =
    `💰 *Balance*\n\n` +
    `Cash: *${formatUsd(user.balance_usd)}*\n` +
    `Free tickets: *${Number(user.unlocked_tickets) || 0}* unlocked · ` +
    `*${Number(user.locked_tickets) || 0}* locked\n\n` +
    `Deposited: ${formatUsd(user.total_deposited)}\n` +
    `Wagered: ${formatUsd(user.total_wagered)}\n` +
    `Won: ${formatUsd(user.total_won)}\n\n` +
    `Use /wallet to deposit and unlock free tickets.`;
  await ctx.replyWithMarkdown(text, mainMenu());
};
