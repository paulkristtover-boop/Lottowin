/**
 * Require Terms & Conditions acceptance (versioned).
 * Skips admins, /start, and terms callbacks.
 */
const config = require('../config');
const { query } = require('../database');
const { Markup } = require('telegraf');

function isAdmin(ctx) {
  const id = ctx.from?.id;
  return id && (config.adminIds || []).includes(Number(id));
}

function currentVersion() {
  return String(process.env.TERMS_VERSION || config.termsVersion || '1.0');
}

function termsText() {
  return (
    process.env.TERMS_SUMMARY ||
    config.termsSummary ||
    `📜 *Terms & Conditions (v${currentVersion()})*\n\n` +
      `By using LottoWin you confirm that:\n` +
      `• You are *18 years or older*\n` +
      `• Instant lottery is a *game of chance* — you can lose your stake\n` +
      `• Prizes are paid to your *in-app balance* (not stake returned on top)\n` +
      `• Deposits/withdrawals use *USDT* (TRC-20 / ERC-20) under our process\n` +
      `• Play-through and fees may apply before withdrawal\n` +
      `• We may suspend accounts for fraud, abuse, or legal reasons\n` +
      `• You will use responsible-gaming tools if needed\n\n` +
      `Full policy may be updated; continued use after a new version requires re-acceptance.\n\n` +
      `Do you accept these terms?`
  );
}

function termsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('✅ I accept', 'terms:accept')],
    [Markup.button.callback('📖 Read again', 'terms:show')],
  ]);
}

async function getTermsState(telegramId) {
  try {
    const res = await query(
      `SELECT terms_accepted_at, terms_version FROM users WHERE telegram_id = $1`,
      [telegramId]
    );
    return res.rows[0] || null;
  } catch {
    return null;
  }
}

async function hasAccepted(telegramId) {
  const row = await getTermsState(telegramId);
  if (!row || !row.terms_accepted_at) return false;
  return String(row.terms_version || '') === currentVersion();
}

async function acceptTerms(telegramId) {
  await query(
    `UPDATE users SET terms_accepted_at = NOW(), terms_version = $2, updated_at = NOW()
     WHERE telegram_id = $1`,
    [telegramId, currentVersion()]
  );
}

module.exports = async function termsGate(ctx, next) {
  if (!ctx.from) return next();
  if (isAdmin(ctx)) return next();
  if (config.termsRequired === false || process.env.TERMS_REQUIRED === 'false') {
    return next();
  }

  const data = ctx.callbackQuery?.data || '';
  if (data.startsWith('terms:')) return next();

  const text = ctx.message?.text || '';
  if (text.startsWith('/start')) return next();

  // Onboarding (age/captcha) may still be in progress — start handler owns that
  if (ctx.state?.onboarding) return next();

  const ok = await hasAccepted(ctx.from.id);
  if (ok) return next();

  // Soft: only gate money/play actions by command/hears keywords when possible
  // Hard gate everything except start/support for safety
  if (data === 'channel:later' || data === 'channel:check') return next();

  try {
    if (ctx.callbackQuery) {
      await ctx.answerCbQuery('Please accept the Terms first').catch(() => {});
    }
    await ctx.replyWithMarkdown(termsText(), termsKeyboard());
  } catch {
    /* ignore */
  }
  return;
};

module.exports.hasAccepted = hasAccepted;
module.exports.acceptTerms = acceptTerms;
module.exports.termsText = termsText;
module.exports.termsKeyboard = termsKeyboard;
module.exports.currentVersion = currentVersion;
