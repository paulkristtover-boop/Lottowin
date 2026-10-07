const userService = require('../services/userService');

module.exports = async (ctx, next) => {
  if (!ctx.from) return next();
  const user = await userService.getUser(ctx.from.id);
  if (user?.is_banned) {
    return ctx.reply('🚫 Your account has been suspended. Contact support if you believe this is an error.');
  }
  return next();
};
