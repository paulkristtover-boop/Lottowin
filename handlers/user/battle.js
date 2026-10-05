const contestService = require('../../services/contestService');
const config = require('../../config');
const { scalePrizes, WEEKLY_REFERRAL_WEIGHTS } = require('../../services/contestPrizeTables');
const { formatUsd } = require('../../utils/helpers');
const { Markup } = require('telegraf');

module.exports = async function showBattle(ctx) {
  try {
    const { key, rows } = await contestService.getWeeklyReferralLeaderboard(20);
    const prizes = scalePrizes(WEEKLY_REFERRAL_WEIGHTS, config.weeklyReferralPoolUsd);
    const mine = rows.find((r) => r.userId === ctx.from.id);
    let text = contestService.formatLeaderboard(
      `⚔️ *Weekly referral battle*`,
      rows,
      prizes,
      `Week *${key}*\nPool *${formatUsd(config.weeklyReferralPoolUsd)}* · ranked by *friends' cash ticket volume*\n` +
        `Top 20 share the pool. Settles weekly (UTC).\n\n`
    );
    if (mine) text += `\nYou: *#${mine.rank}* · vol ${formatUsd(mine.volume)}`;
    else text += `\nInvite friends who deposit & play cash tickets.`;
    text += `\n\nAlso: 5 free tickets after their path + 5% commission on their cash play.`;
    await ctx.replyWithMarkdown(
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback('👥 Referral link', 'ux:referral')],
        [Markup.button.callback('🏁 Daily contest', 'ux:contest')],
        [Markup.button.callback('🔄 Refresh', 'ux:battle')],
      ])
    );
  } catch (e) {
    await ctx.reply('Battle unavailable: ' + e.message);
  }
};
