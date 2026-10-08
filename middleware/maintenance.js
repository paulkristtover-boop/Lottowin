/**
 * Maintenance mode — blocks non-admin users from bot actions.
 * Sources (either true → on):
 *   env MAINTENANCE_MODE=true
 *   settings key maintenance_mode = "true"  (toggle without full redeploy)
 */
const config = require('../config');
const settingsService = require('../services/settingsService');
const logger = require('../utils/logger');

let cache = { on: false, msg: '', at: 0 };
const CACHE_MS = 5000;

function isAdmin(ctx) {
  const id = ctx.from?.id;
  return id && (config.adminIds || []).includes(Number(id));
}

async function isMaintenanceOn() {
  if (process.env.MAINTENANCE_MODE === 'true' || config.maintenanceMode === true) {
    return true;
  }
  if (Date.now() - cache.at < CACHE_MS) return cache.on;
  try {
    const v = await settingsService.get('maintenance_mode', 'false');
    cache = {
      on: String(v).toLowerCase() === 'true',
      msg: '',
      at: Date.now(),
    };
  } catch (e) {
    logger.warn('maintenance settings read', e.message);
    cache = { on: false, msg: '', at: Date.now() };
  }
  return cache.on;
}

async function maintenanceMessage() {
  try {
    const custom = await settingsService.get('maintenance_message', null);
    if (custom && String(custom).trim()) return String(custom);
  } catch {
    /* ignore */
  }
  return (
    process.env.MAINTENANCE_MESSAGE ||
    config.maintenanceMessage ||
    '🛠️ *Maintenance in progress*\n\n' +
      'LottoWin is temporarily unavailable while we update the system.\n' +
      'Please try again shortly.\n\n' +
      '_Admins can still access the bot._'
  );
}

/** Clear cache after admin toggle */
function bustCache() {
  cache.at = 0;
}

module.exports = async function maintenance(ctx, next) {
  if (!ctx.from) return next();
  if (isAdmin(ctx)) return next();

  const on = await isMaintenanceOn();
  if (!on) return next();

  const text = (ctx.message && ctx.message.text) || '';
  // Allow /start so users see the maintenance notice cleanly
  if (ctx.updateType === 'callback_query') {
    try {
      await ctx.answerCbQuery('Maintenance — try later');
    } catch {
      /* ignore */
    }
  }

  const msg = await maintenanceMessage();
  try {
    if (ctx.replyWithMarkdown) {
      await ctx.replyWithMarkdown(msg);
    } else {
      await ctx.reply(msg.replace(/\*/g, ''));
    }
  } catch {
    /* ignore */
  }
  // Stop pipeline — do not process play/deposit/etc.
  return;
};

module.exports.isMaintenanceOn = isMaintenanceOn;
module.exports.bustCache = bustCache;
module.exports.maintenanceMessage = maintenanceMessage;
