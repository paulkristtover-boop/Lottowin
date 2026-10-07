const contestService = require('../../services/contestService');
const config = require('../../config');
const { scalePrizes, DAILY_WAGER_WEIGHTS } = require('../../services/contestPrizeTables');
const { formatUsd } = require('../../utils/helpers');
const { Markup } = require('telegraf');

async function showDaily(ctx) {
  const key = contestService.utcDateKey();
  const board = await contestService.getDailyWagerLeaderboard(key, 20);
  const prizes = scalePrizes(DAILY_WAGER_WEIGHTS, config.dailyWagerPoolUsd);
  const mine = board.find((r) => r.userId === ctx.from.id);
  let text = contestService.formatLeaderboard(
    `🏁 *Daily wager contest*`,
    board,
    prizes,
    `UTC day *${key}*\nPrize pool *${formatUsd(config.dailyWagerPoolUsd)}* — top 100 share by *cash ticket volume*\n` +
      `Resets 00:00 UTC · winners auto-credited\n\n`
  );
  if (mine) text += `\n🔥 You: *#${mine.rank}* · ${formatUsd(mine.volume)}`;
  else text += `\n🚀 You're not on the board yet — every *cash* line counts.`;
  text +=
    `\n\n💎 Deposit ≥ *${formatUsd(config.minDepositUsd)}* unlocks *${config.welcomeFreeTickets}* free tickets ` +
    `(great for practice — contest ranks use *cash* play only).`;
  await ctx.replyWithMarkdown(
    text,
    Markup.inlineKeyboard([
      [Markup.button.callback('⚔️ Referral battle', 'ux:battle')],
      [Markup.button.callback('📡 Live bets', 'ux:live')],
      [Markup.button.callback('🔄 Refresh', 'ux:contest')],
    ])
  );
}

module.exports = { showDaily };
