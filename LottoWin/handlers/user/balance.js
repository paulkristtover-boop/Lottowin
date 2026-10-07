const userService = require('../../services/userService');
const config = require('../../config');
const { mainMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');

module.exports = async (ctx) => {
  const user = await userService.getUser(ctx.from.id);
  if (!user) return ctx.reply('Please /start first');
  const locked = Number(user.locked_tickets) || 0;
  const unlocked = Number(user.unlocked_tickets) || 0;
  const text =
    `💰 *Your balance*\n\n` +
    `Cash: *${formatUsd(user.balance_usd)}*\n` +
    `🎫 Free tickets: *${unlocked}* unlocked` +
    (locked > 0 ? ` · *${locked}* locked` : '') +
    `\n\n` +
    `Play from *${formatUsd(config.playCostUsd)}*/line · min deposit *${formatUsd(config.minDepositUsd)}*\n` +
    `Open *Wallet* to top up and unlock free tickets.`;
  await ctx.replyWithMarkdown(text, mainMenu());
};
