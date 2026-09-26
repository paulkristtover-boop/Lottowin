const userService = require('../../services/userService');
const { mainMenu } = require('../../utils/ui');
const config = require('../../config');
const { formatUsd } = require('../../utils/helpers');

module.exports = async (ctx) => {
  const payload = ctx.startPayload || '';
  const user = await userService.findOrCreateUser(ctx.from, payload || null);

  const welcome = `🎰 *Welcome to Instant 4/40 Lotto!*

Pick 4 numbers from 1–40 and win instantly.

💰 Balance: *${formatUsd(user.balance_usd)}*
${user.welcome_bonus_claimed ? '' : `\n🎁 Welcome bonus of ${formatUsd(config.welcomeBonusUsd)} applied!`}

*Play cost:* ${formatUsd(config.playCostUsd)} per line (up to ${config.maxLines} lines)

⚠️ *18+ only. Gamble responsibly.*
Set limits • Take timeouts • Stay in control.`;

  await ctx.replyWithMarkdown(welcome, mainMenu());
};
