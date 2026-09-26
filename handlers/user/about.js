const config = require('../../config');
const { mainMenu } = require('../../utils/ui');

module.exports = async (ctx) => {
  const text = `${config.aboutText}

📢 Channel: ${config.channelLink}
🆘 Support: @${config.supportUsername}

*Play Responsibly*
• Set deposit & loss limits
• Take regular breaks
• Never chase losses
• Only play with money you can afford to lose
• 18+ only

If you need help: https://www.begambleaware.org`;

  await ctx.replyWithMarkdown(text, mainMenu());
};
