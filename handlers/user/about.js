const config = require('../../config');
const { mainMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');

module.exports = async function about(ctx) {
  const g440 = config.games['4_40'];
  const g330 = config.games['3_30'];
  const text =
    `ℹ️ *How to play*\n\n` +
    `*Insta Win 4/40*\n` +
    `Pick 4 from 1–40. Instant result.\n` +
    `| Match | Prize |\n| 4 | ${formatUsd(g440.prizesUsd[4])} |\n| 3 | ${formatUsd(g440.prizesUsd[3])} |\n| 2 | ${formatUsd(g440.prizesUsd[2])} |\n| 1 | ${formatUsd(g440.prizesUsd[1])} |\n` +
    `Cost: ${formatUsd(g440.playCostUsd)} / line\n\n` +
    `*Insta Win 3/30*\n` +
    `Pick 3 from 1–30. Instant result.\n` +
    `| Match | Prize |\n| 3 | ${formatUsd(g330.prizesUsd[3])} |\n| 2 | ${formatUsd(g330.prizesUsd[2])} |\n| 1 | ${formatUsd(g330.prizesUsd[1])} |\n` +
    `Cost: ${formatUsd(g330.playCostUsd)} / line\n\n` +
    `Free tickets unlock after first $${config.minDepositUsd}+ deposit.\n` +
    `⚠️ 18+. Play responsibly.`;

  await ctx.replyWithMarkdown(text, mainMenu());
};
