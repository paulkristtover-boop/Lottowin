const cryptoPayment = require('../services/cryptoPaymentService');
const channelService = require('../services/channelService');
const dailyJackpot = require('../services/dailyJackpotService');
const config = require('../config');
const logger = require('../utils/logger');

let botRef = null;

function setBot(bot) {
  botRef = bot;
}

function startJobs() {
  setInterval(async () => {
    try {
      await cryptoPayment.scanAndCredit(botRef);
    } catch (e) {
      logger.error('Deposit scan', e.message);
    }
  }, 30_000);

  setTimeout(() => cryptoPayment.scanAndCredit(botRef).catch(() => {}), 5000);

  // Every 15 min: close sales / run draw / pot posts
  setInterval(async () => {
    try {
      const now = new Date();
      const draw = await dailyJackpot.getOpenDraw();

      // pot update a few times while open (hour marks)
      if (draw.status === 'open' && now.getUTCMinutes() < 15 && now.getUTCHours() % 4 === 0) {
        await channelService.postPotUpdate(botRef);
      }

      // At draw hour UTC: run draw once
      if (
        now.getUTCHours() === config.drawHourUtc &&
        now.getUTCMinutes() < 15 &&
        draw.status !== 'drawn'
      ) {
        const result = await dailyJackpot.runDraw(draw.draw_date);
        await channelService.postDrawResult(botRef, result);
        // ensure next day open exists
        await dailyJackpot.getOrCreateOpenDraw();
      }
    } catch (e) {
      logger.error('Draw/pot job', e.message);
    }
  }, 15 * 60 * 1000);

  logger.info('Jobs: deposit 30s, draw/pot 15m');
}

module.exports = { startJobs, setBot };
