const cryptoPayment = require('../services/cryptoPaymentService');
const logger = require('../utils/logger');

let botRef = null;
let timer = null;

/**
 * Attach Telegraf instance so deposit credits can notify users.
 */
function setBot(bot) {
  botRef = bot;
}

function startJobs() {
  if (timer) clearInterval(timer);

  // Every 30 seconds — lightweight explorer polling
  timer = setInterval(async () => {
    try {
      const result = await cryptoPayment.scanAndCredit(botRef);
      if (result?.matched > 0) {
        logger.info('Deposit scanner matched', result);
      }
    } catch (e) {
      logger.error('Deposit scanner failed', e.message);
    }
  }, 30_000);

  // First run shortly after boot
  setTimeout(() => {
    cryptoPayment.scanAndCredit(botRef).catch((e) => logger.error('Initial scan', e.message));
  }, 5_000);

  logger.info('Background jobs started (deposit scan every 30s)');
}

module.exports = { startJobs, setBot };
