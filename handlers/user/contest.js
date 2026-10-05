const contestService = require('../../services/contestService');
const config = require('../../config');
const { scalePrizes, DAILY_WAGER_WEIGHTS, WEEKLY_REFERRAL_WEIGHTS } = require('../../services/contestPrizeTables');
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
    `UTC day *${key}*\nPool *${formatUsd(config.dailyWagerPoolUsd)}* (top 100 share, ranked by cash ticket volume)\n` +
      `Resets 00:00 UTC. Prizes auto-credited after settle.\n\n`
  );
  if (mine) text += `\nYou: *#${mine.rank}* · ${formatUsd(mine.volume)}`;
  else text += `\nYou are not on the board yet — play *cash* tickets.`;
  text += `\n\nDeposit ≥ $1 unlocks *5 free tickets* (separate from contest volume).`;
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
