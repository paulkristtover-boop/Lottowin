module.exports = async (ctx, next) => {
  if (ctx.chat && ctx.chat.type !== 'private') {
    return ctx.reply('Please use this bot in a private chat.');
  }
  return next();
};
