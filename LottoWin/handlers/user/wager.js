const wagerService = require('../../services/wagerService');
const { mainMenu } = require('../../utils/ui');
const { Markup } = require('telegraf');

module.exports = async function showWager(ctx) {
  try {
    const snap = await wagerService.getWagerSnapshot(ctx.from.id);
    const text = wagerService.formatWagerCard(snap);
    await ctx.replyWithMarkdown(
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback('📡 Live bets', 'ux:live')],
        [Markup.button.callback('« Main', 'menu:main')],
      ])
    );
  } catch (e) {
    await ctx.reply('Could not load wager status: ' + e.message, mainMenu());
  }
};
