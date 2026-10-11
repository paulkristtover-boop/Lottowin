/**
 * Explicit promo banner handler — allowlisted surface for weekly banner + logo.
 */
const bannerService = require('../../services/bannerService');
const { mainMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');
const config = require('../../config');

async function show(ctx) {
  const sent = await bannerService.sendBannerToChat(ctx.telegram, ctx.chat.id, {
    mode: 'force',
    telegramId: ctx.from?.id,
  });

  if (!sent) {
    const tickets = config.welcomeFreeTickets || 5;
    await ctx.replyWithMarkdown(
      `🎁 *Promo*\n\n` +
        `Deposit from *${formatUsd(config.minDepositUsd)}* → *${tickets} free tickets* unlock.\n` +
        `Play *4/40* & *3/30* from *${formatUsd(config.playCostUsd)}* / line.\n\n` +
        `Open *Wallet* → *Deposit*. 18+`,
      mainMenu()
    );
    return;
  }

  await ctx.replyWithMarkdown(
    `_Tap Wallet → Deposit to unlock free tickets._`,
    mainMenu()
  );
}

module.exports = { show };
