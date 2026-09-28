const config = require('../config');

function isAdminId(id) {
  return config.adminIds.includes(Number(id));
}

/**
 * Block admin accounts from all player activities.
 * Admins operate only via admin panel / admin commands.
 */
module.exports = async (ctx, next) => {
  const id = ctx.from?.id;
  if (!id || !isAdminId(id)) return next();

  // Allow admin commands and admin UI always
  const text = ctx.message?.text || '';
  const data = ctx.callbackQuery?.data || '';

  if (text.startsWith('/')) {
    // Admin slash commands handled elsewhere; still pass through
    return next();
  }

  // Admin keyboard labels
  const adminLabels = [
    '📈 Stats',
    '💸 Pending WD',
    '📢 Broadcast',
    '💬 Message User',
    '🎫 Support Tickets',
    '🛡️ Liability',
    '🎲 Set Draw',
    '📊 Tax Export',
    '🔒 Admin Panel',
  ];
  if (adminLabels.includes(text)) return next();

  // Admin callback prefixes
  if (data.startsWith('adm:')) return next();

  // Session-driven admin flows (dm, broadcast body, support reply)
  if (ctx.session?.adminFlow) return next();

  // Everything else from an admin is blocked as "player activity"
  if (ctx.callbackQuery) {
    await ctx.answerCbQuery('Admins cannot use player features').catch(() => {});
    return;
  }
  if (ctx.message) {
    await ctx.reply(
      '🔒 *Admin accounts cannot play, deposit, or use player features.*\nUse the Admin Panel below.',
      { parse_mode: 'Markdown', ...require('../keyboards/admin').main() }
    );
    return;
  }
  return next();
};

module.exports.isAdminId = isAdminId;
