const config = require('../../config');
const { mainMenu } = require('../../utils/ui');

module.exports = async (ctx) => {
  await ctx.replyWithMarkdown(config.howToPlayText, mainMenu());
};
