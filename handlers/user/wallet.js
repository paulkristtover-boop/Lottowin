const userService = require('../../services/userService');
const { mainMenu, depositMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');
const config = require('../../config');
const dailyJackpot = require('../../services/dailyJackpotService');

async function showWallet(ctx) {
  const u = await userService.getUser(ctx.from.id);
  if (!u) return ctx.reply('Open /start first', mainMenu());
  let pot = '—';
  try {
    const d = await dailyJackpot.getOpenDraw();
    pot = formatUsd(d.pot_usd);
  } catch (_) {}
  await ctx.replyWithMarkdown(
    `👛 *Wallet*\n\n` +
      `Balance: *${formatUsd(u.balance_usd)}*\n` +
      `Free lines: *${u.free_lines || 0}*\n` +
      `Today's pot: *${pot}*\n\n` +
      `Min deposit *${formatUsd(config.minDepositUsd)}*`,
    depositMenu()
  );
}

module.exports = { showWallet };
