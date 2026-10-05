const socialService = require('../../services/socialService');
const { mainMenu } = require('../../utils/ui');
const { Markup } = require('telegraf');

module.exports = async function showLive(ctx) {
  try {
    const rows = await socialService.getLiveBets(15);
    const text = socialService.formatLiveBets(rows);
    await ctx.replyWithMarkdown(
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback('🔄 Refresh', 'ux:live')],
        [Markup.button.callback('📊 My activity', 'ux:activity')],
        [Markup.button.callback('« Main', 'menu:main')],
      ])
    );
  } catch (e) {
    await ctx.reply('Live feed unavailable: ' + e.message, mainMenu());
  }
};
