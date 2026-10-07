const userService = require('../../services/userService');
const { responsibleMenu, mainMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');
const config = require('../../config');

async function show(ctx) {
  const user = await userService.getUser(ctx.from.id);
  const text = `🛡️ *Play Responsibly*

Gambling should be fun, not a problem.

*Your current limits*
Daily: ${formatUsd(user.daily_limit_usd)}
Session: ${formatUsd(user.session_limit_usd)}
${user.self_excluded_until ? `\nSelf-excluded until: ${new Date(user.self_excluded_until).toLocaleString()}` : ''}

*Tools*
• Set daily / session limits
• Take a time-out
• Self-exclude

*Remember*
• 18+ only
• Never chase losses
• Take regular breaks
• Use only money you can afford to lose

Help: https://www.begambleaware.org
Or search "BeGambleAware"`;

  await ctx.replyWithMarkdown(text, responsibleMenu());
}

async function setTimeout(ctx, hours) {
  const until = new Date(Date.now() + hours * 60 * 60 * 1000);
  await userService.selfExclude(ctx.from.id, until);
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    `✅ You are now on a break until *${until.toLocaleString()}*.\nTake care of yourself.`,
    mainMenu()
  );
}

async function promptLimit(ctx, type) {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    `Send the new *${type} limit in USD* (e.g. 20).\nOr /cancel`
  );
  // Store in a simple map – production: session store
  ctx.session = ctx.session || {};
  ctx.session.pendingLimit = type;
}

module.exports = {
  show,
  setTimeout,
  promptLimit,
};
