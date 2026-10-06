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
      `Week *${key}*\nPool *${formatUsd(config.weeklyReferralPoolUsd)}* · ranked by *friends' cash volume*\n` +
        `Top 20 share the pool · settles weekly (UTC)\n\n`
    );
    if (mine) text += `\n🔥 You: *#${mine.rank}* · vol ${formatUsd(mine.volume)}`;
    else text += `\n📣 Share your link — friends who *deposit & play cash* power your rank.`;
    text +=
      `\n\n🎁 Also earn *${config.referralFreeTickets}* free tickets + *${config.referralPercent}%* commission the usual way.`;
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
