const hits = new Map();

module.exports = (limit = 20, windowMs = 60000) => {
  return async (ctx, next) => {
    const id = ctx.from?.id;
    if (!id) return next();
    const now = Date.now();
    let entry = hits.get(id) || { count: 0, reset: now + windowMs };
    if (now > entry.reset) {
      entry = { count: 0, reset: now + windowMs };
    }
    entry.count += 1;
    hits.set(id, entry);
    if (entry.count > limit) {
      return ctx.reply('⏳ Slow down a bit. Try again in a minute.');
    }
    return next();
  };
};
