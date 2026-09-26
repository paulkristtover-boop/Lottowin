const cron = require('node-cron');
const blockchainChecker = require('../services/blockchainChecker');
const logger = require('../utils/logger');

function startJobs() {
  // Check deposits every 3 minutes
  cron.schedule('*/3 * * * *', async () => {
    try {
      await blockchainChecker.runDepositChecker();
    } catch (e) {
      logger.error('Deposit checker failed', e.message);
    }
  });

  logger.info('Background jobs started');
}

module.exports = { startJobs };
