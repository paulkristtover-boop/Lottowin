const cryptoPayment = require('../services/cryptoPaymentService');
const channelService = require('../services/channelService');
const contestService = require('../services/contestService');
const logger = require('../utils/logger');

let botRef = null;
let depositTimer = null;
let hourlyTimer = null;
let dailyTimer = null;

function setBot(bot) {
  botRef = bot;
}

function startJobs() {
  if (depositTimer) clearInterval(depositTimer);
  if (hourlyTimer) clearInterval(hourlyTimer);
  if (dailyTimer) clearInterval(dailyTimer);

  depositTimer = setInterval(async () => {
    try {
      const result = await cryptoPayment.scanAndCredit(botRef);
      if (result?.matched > 0) logger.info('Deposit scanner matched', result);
    } catch (e) {
      logger.error('Deposit scanner failed', e.message);
    }
  }, 30_000);

  setTimeout(() => {
    cryptoPayment.scanAndCredit(botRef).catch((e) => logger.error('Initial scan', e.message));
  }, 5_000);

  // Hourly channel: live bets + contest snapshot
  const hourMs = 60 * 60 * 1000;
  hourlyTimer = setInterval(async () => {
    try {
      await channelService.postHourlyLiveBets(botRef);
      await channelService.postDailyContestSnapshot(botRef);
    } catch (e) {
      logger.error('Hourly channel job', e.message);
    }
  }, hourMs);

  setTimeout(() => {
    channelService.postHourlyLiveBets(botRef).catch(() => {});
  }, 20_000);

  // Check every 15 min for UTC midnight settle + Monday weekly
  dailyTimer = setInterval(async () => {
    try {
      const now = new Date();
      if (now.getUTCHours() === 0 && now.getUTCMinutes() < 16) {
        await contestService.settleDailyWager(botRef);
        if (now.getUTCDay() === 1) {
          await contestService.settleWeeklyReferral(botRef);
          await channelService.postWeeklyBattleSnapshot(botRef);
        }
      }
    } catch (e) {
      logger.error('Settle job', e.message);
    }
  }, 15 * 60 * 1000);

  logger.info('Background jobs: deposit 30s, channel hourly, contest settle');
}

module.exports = { startJobs, setBot };
