const userService = require('../../services/userService');
const config = require('../../config');
const { mainMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');
const dailyJackpot = require('../../services/dailyJackpotService');

module.exports = async function start(ctx) {
  const payload = ctx.startPayload || '';
  let ref = null;
  if (payload) ref = payload.replace(/^ref_?/, '');
  await userService.findOrCreateUser(ctx.from, ref);

  try {
    await dailyJackpot.getOrCreateOpenDraw();
  } catch (_) {}

  const text =
    `🎰 *Daily Jackpot 4/40*\n\n` +
    `One draw per day. Ticket *${formatUsd(config.ticketPriceUsd)}* / line.\n` +
    `Jackpot pot grows from *${config.jackpotSharePercent}%* of cash sales (no seed).\n` +
    `Match 4 → share the pot · Match 3+ → free line next draw.\n\n` +
    `Deposit TRX or ETH → Buy lines → Wait for draw.\n\n` +
    `18+ · Play responsibly`;
  await ctx.replyWithMarkdown(text, mainMenu());
};

module.exports.handleOnboardingText = async () => false;
