/**
 * Weekly promo banners — handlers only DISPLAY; generation is automated (job / webhook).
 * Logo is always included: primary asset is assets/logo.png (sendPhoto), never AI-only without logo file.
 */
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const config = require('../config');
const settingsService = require('./settingsService');
const { query } = require('../database');
const logger = require('../utils/logger');
const { formatUsd } = require('../utils/helpers');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo.png');
const BANNER_DIR = path.join(__dirname, '..', 'assets', 'banners');

function isoWeekKey(d = new Date()) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function logoSource() {
  if (fs.existsSync(LOGO_PATH)) return { source: LOGO_PATH };
  return null;
}

/** Caption always from live economics — not baked into AI alone */
function buildCaption() {
  const tickets = config.welcomeFreeTickets || 5;
  const minDep = formatUsd(config.minDepositUsd || 1);
  const cost = formatUsd(config.playCostUsd || 0.0001);
  return (
    `🎁 *PROMO ACTIVE*\n\n` +
    `Deposit from *${minDep}* → unlock *${tickets} FREE tickets*\n` +
    `Instant *4/40* & *3/30* · from *${cost}* / line\n` +
    `USDT · TRC-20 / ERC-20\n\n` +
    `Wallet → Deposit · free tickets used first on play\n\n` +
    `(T&Cs apply) · 18+ · Play responsibly`
  );
}

function buildAiPrompt() {
  const tickets = config.welcomeFreeTickets || 5;
  const minDep = config.minDepositUsd || 1;
  return (
    `LottoWin instant lottery promo poster, dark navy background, teal and gold accents, ` +
    `bold text PROMO ACTIVE, ${tickets} FREE TICKETS, DEPOSIT $${minDep}+, ` +
    `Instant 4/40 and 3/30, leave clear top-right space for app logo, ` +
    `professional fintech style, 18+ footer space, no competitor brands`
  );
}

async function isEnabled() {
  if (process.env.WEEKLY_BANNER_ENABLED === 'false') return false;
  const v = await settingsService.get('weekly_banner_enabled', true);
  return settingsService.asBool ? settingsService.asBool(v) : v !== false && v !== 'false';
}

async function getStored() {
  const week = await settingsService.get('weekly_banner_week', null);
  const fileId = await settingsService.get('weekly_banner_file_id', null);
  const url = await settingsService.get('weekly_banner_url', null);
  const caption = await settingsService.get('weekly_banner_caption', null);
  return {
    week: week != null ? String(week) : null,
    fileId: fileId != null ? String(fileId) : null,
    url: url != null ? String(url) : null,
    caption: caption != null ? String(caption) : null,
  };
}

/**
 * Photo payload for Telegram: always prefer local logo so brand mark is guaranteed.
 * Optional AI/URL creative is only used if BANNER_PREFER_AI=true and url exists.
 */
function resolvePhoto(stored) {
  const preferAi = process.env.BANNER_PREFER_AI === 'true';
  if (preferAi && stored?.url) return stored.url;
  if (preferAi && stored?.fileId) return stored.fileId;
  const logo = logoSource();
  if (logo) return { source: logo.source };
  if (stored?.fileId) return stored.fileId;
  if (stored?.url) return stored.url;
  return null;
}

async function getBannerForSend() {
  const enabled = await isEnabled();
  if (!enabled) return null;
  const stored = await getStored();
  const photo = resolvePhoto(stored);
  if (!photo) return null;
  return {
    photo,
    caption: stored.caption || buildCaption(),
    week: stored.week || isoWeekKey(),
  };
}

/** Optional external AI webhook — operator does not upload; job calls this */
async function tryGenerateAiUrl() {
  const hook = process.env.BANNER_AI_WEBHOOK_URL || '';
  if (!hook) return null;
  try {
    const res = await axios.post(
      hook,
      { prompt: buildAiPrompt(), week: isoWeekKey() },
      { timeout: 120000 }
    );
    const url = res.data?.url || res.data?.image_url || null;
    return url || null;
  } catch (e) {
    logger.warn('banner AI webhook failed', e.message);
    return null;
  }
}

/**
 * Refresh weekly banner metadata. Logo file remains the guaranteed visual for handlers.
 * AI URL stored for optional channel creative when BANNER_PREFER_AI=true.
 */
async function refreshWeeklyBanner(bot) {
  const week = isoWeekKey();
  const caption = buildCaption();
  const aiUrl = await tryGenerateAiUrl();

  await settingsService.set('weekly_banner_week', week);
  await settingsService.set('weekly_banner_caption', caption);
  await settingsService.set('weekly_banner_enabled', true);
  if (aiUrl) {
    await settingsService.set('weekly_banner_url', aiUrl);
  }

  // Seed Telegram file_id by sending logo to channel or first admin (silent store)
  let fileId = null;
  const logo = logoSource();
  if (bot?.telegram && logo) {
    const channel = process.env.TELEGRAM_CHANNEL_ID || config.telegramChannelId || '';
    const adminId = (config.adminIds || [])[0];
    const chat = channel || adminId;
    if (chat) {
      try {
        const msg = await bot.telegram.sendPhoto(
          chat,
          { source: logo.source },
          { caption: caption.replace(/\*/g, ''), disable_notification: true }
        );
        fileId = msg?.photo?.slice(-1)[0]?.file_id || null;
        if (fileId) await settingsService.set('weekly_banner_file_id', fileId);
      } catch (e) {
        logger.warn('banner seed file_id', e.message);
      }
    }
  }

  logger.info('Weekly banner refreshed', { week, aiUrl: !!aiUrl, fileId: !!fileId });
  return { week, caption, aiUrl, fileId };
}

async function userSeenWeek(telegramId, week) {
  try {
    const res = await query(
      `SELECT last_banner_week FROM users WHERE telegram_id = $1`,
      [telegramId]
    );
    return res.rows[0]?.last_banner_week === week;
  } catch {
    return false;
  }
}

async function markUserSeen(telegramId, week) {
  try {
    await query(
      `UPDATE users SET last_banner_week = $2, updated_at = NOW() WHERE telegram_id = $1`,
      [telegramId, week]
    );
  } catch (e) {
    logger.warn('markUserSeen banner', e.message);
  }
}

/**
 * Send banner photo to a chat. Returns true if sent.
 * @param {'force'|'once_per_week'} mode
 */
async function sendBannerToChat(telegram, chatId, { mode = 'force', telegramId = null } = {}) {
  const banner = await getBannerForSend();
  if (!banner) return false;

  if (mode === 'once_per_week' && telegramId) {
    if (await userSeenWeek(telegramId, banner.week)) return false;
  }

  try {
    await telegram.sendPhoto(chatId, banner.photo, {
      caption: banner.caption,
      parse_mode: 'Markdown',
    });
  } catch (e) {
    try {
      await telegram.sendPhoto(chatId, banner.photo, {
        caption: banner.caption.replace(/\*/g, ''),
      });
    } catch (e2) {
      logger.warn('sendBannerToChat', e2.message);
      return false;
    }
  }

  if (telegramId) await markUserSeen(telegramId, banner.week);
  return true;
}

module.exports = {
  isoWeekKey,
  buildCaption,
  buildAiPrompt,
  getBannerForSend,
  refreshWeeklyBanner,
  sendBannerToChat,
  logoSource,
  LOGO_PATH,
  isEnabled,
};
