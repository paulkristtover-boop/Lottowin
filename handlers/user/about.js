const config = require('../../config');
const { mainMenu, gamePicker } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');
const copy = require('../../utils/copy');
const { Markup } = require('telegraf');

function howtoKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📖 How to play 4/40', 'howto:4_40')],
    [Markup.button.callback('📖 How to play 3/30', 'howto:3_30')],
    [Markup.button.callback('🎰 Play now', 'menu:play')],
    [Markup.button.callback('« Main menu', 'menu:main')],
  ]);
}

module.exports = async function about(ctx) {
  const g440 = config.games['4_40'];
  const g330 = config.games['3_30'];
  const text =
    `ℹ️ *Insta Win — instant. sharp. fair.*\n\n` +
    `Two games. One bot. Prizes paid to balance in USDT.\n\n` +
    `🎯 *${g440.name}* — ${g440.pick} from ${g440.from}–${g440.to} · *${formatUsd(g440.playCostUsd)}*/line\n` +
    `🎲 *${g330.name}* — ${g330.pick} from ${g330.from}–${g330.to} · *${formatUsd(g330.playCostUsd)}*/line\n\n` +
    `Deposit *${formatUsd(config.minDepositUsd)}+* → unlock *${config.welcomeFreeTickets}* free tickets.\n` +
    `Tap a guide below, then hit Play.\n\n` +
    `⚠️ *18+* · Play responsibly`;

  await ctx.replyWithMarkdown(text, howtoKeyboard());
};

module.exports.showHowTo = async function showHowTo(ctx, gameId) {
  const game = config.games[gameId];
  if (!game) {
    try { await ctx.answerCbQuery('Unknown game'); } catch (_) {}
    return;
  }
  try { await ctx.answerCbQuery(); } catch (_) {}
  const kb = Markup.inlineKeyboard([
    [Markup.button.callback(`▶️ Play ${game.name}`, `game:${gameId}`)],
    [Markup.button.callback('📖 Other game', 'howto:menu')],
    [Markup.button.callback('« Main menu', 'menu:main')],
  ]);
  await ctx.replyWithMarkdown(copy.howToPlay(gameId), kb);
};

module.exports.howtoKeyboard = howtoKeyboard;
