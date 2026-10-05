/**
 * Posts to public Telegram channel (TELEGRAM_CHANNEL_ID).
 * Bot must be admin in the channel with post rights.
 */
const config = require('../config');
const logger = require('../utils/logger');
const socialService = require('./socialService');
const contestService = require('./contestService');
const { scalePrizes, DAILY_WAGER_WEIGHTS, WEEKLY_REFERRAL_WEIGHTS } = require('./contestPrizeTables');
const { formatUsd } = require('../utils/helpers');

function channelId() {
  return process.env.TELEGRAM_CHANNEL_ID || config.telegramChannelId || '';
}

async function post(bot, text, extra = {}) {
  const id = channelId();
  if (!id || !bot?.telegram) {
    logger.warn('Channel post skipped — TELEGRAM_CHANNEL_ID not set');
    return false;
  }
  try {
    await bot.telegram.sendMessage(id, text, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      ...extra,
    });
    return true;
  } catch (e) {
    logger.error('Channel post failed', e.message);
    return false;
  }
}

/** Hourly: recent bets + micro promo */
async function postHourlyLiveBets(bot) {
  const rows = await socialService.getLiveBets(12);
  let body = socialService.formatLiveBets(rows);
  body += `\n\n🎰 Play in bot · Deposit $1 → 5 free tickets unlock\n18+ Play responsibly`;
  return post(bot, body);
}

/** Snapshot daily wager board */
async function postDailyContestSnapshot(bot) {
  const key = contestService.utcDateKey();
  const board = await contestService.getDailyWagerLeaderboard(key, 10);
  const prizes = scalePrizes(DAILY_WAGER_WEIGHTS, config.dailyWagerPoolUsd);
  const text =
    contestService.formatLeaderboard(
      `🏁 *Daily wager contest* (${key} UTC)`,
      board,
      prizes,
      `Pool *${formatUsd(config.dailyWagerPoolUsd)}* · ranked by *cash ticket volume*\n` +
        `Top 100 share the pool. Resets 00:00 UTC.\n\n`
    ) + `\nPlay in the bot to climb. 18+`;
  return post(bot, text);
}

async function postWeeklyBattleSnapshot(bot) {
  const { key, rows } = await contestService.getWeeklyReferralLeaderboard(10);
  const prizes = scalePrizes(WEEKLY_REFERRAL_WEIGHTS, config.weeklyReferralPoolUsd);
  const text =
    contestService.formatLeaderboard(
      `⚔️ *Weekly referral battle* (${key})`,
      rows,
      prizes,
      `Pool *${formatUsd(config.weeklyReferralPoolUsd)}* · ranked by *friends' cash volume*\n\n`
    ) + `\nShare your referral link in the bot. 18+`;
  return post(bot, text);
}

module.exports = {
  post,
  postHourlyLiveBets,
  postDailyContestSnapshot,
  postWeeklyBattleSnapshot,
  channelId,
};
