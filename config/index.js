require('dotenv').config();

const parseIds = (str) =>
  (str || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);

/** Daily Jackpot Lotto — sales-funded, no seed required */
module.exports = {
  botToken: process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
  adminIds: parseIds(process.env.ADMIN_IDS), // CMS auth only; no admin Telegram panel
  databaseUrl: process.env.DATABASE_URL,

  treasury: {
    trx: process.env.TRX_MASTER_ADDRESS || process.env.TRC20_MASTER_ADDRESS || '',
    eth: process.env.ETH_MASTER_ADDRESS || process.env.ERC20_MASTER_ADDRESS || '',
  },
  trxUsdRate: parseFloat(process.env.TRX_USD_RATE || '0.12'),
  ethUsdRate: parseFloat(process.env.ETH_USD_RATE || '3000'),

  trongridKey: process.env.TRONGRID_API_KEY || process.env.TRONSCAN_API_KEY || '',
  etherscanKey: process.env.ETHERSCAN_API_KEY || '',

  minDepositUsd: parseFloat(process.env.MIN_DEPOSIT_USD || '1'),
  minWithdrawUsd: parseFloat(process.env.MIN_WITHDRAW_USD || '1'),
  withdrawalFeePercent: parseFloat(process.env.WITHDRAWAL_FEE_PERCENT || '2'),
  playthroughPercent: parseFloat(process.env.PLAYTHROUGH_PERCENT || '100'),

  // Daily jackpot economics (no seed — pot from sales)
  ticketPriceUsd: parseFloat(process.env.TICKET_PRICE_USD || '1'),
  maxLinesPerUserPerDraw: parseInt(process.env.MAX_LINES_PER_DRAW || '10', 10),
  jackpotSharePercent: parseFloat(process.env.JACKPOT_SHARE_PERCENT || '50'), // of ticket → pot
  houseSharePercent: parseFloat(process.env.HOUSE_SHARE_PERCENT || '40'),
  // remainder can fund free-ticket tier accounting
  freeTicketMatch: parseInt(process.env.FREE_TICKET_MATCH || '3', 10), // match N → 1 free line next draw

  game: {
    id: 'daily_4_40',
    name: 'Daily Jackpot 4/40',
    pick: 4,
    from: 1,
    to: 40,
  },

  // Draw schedule (WAT = UTC+1)
  drawHourUtc: parseInt(process.env.DRAW_HOUR_UTC || '19', 10), // 20:00 WAT
  salesCloseMinutesBefore: parseInt(process.env.SALES_CLOSE_MINUTES || '60', 10),

  minAge: parseInt(process.env.MIN_AGE || '18', 10),
  termsVersion: process.env.TERMS_VERSION || '2.0',
  termsRequired: process.env.TERMS_REQUIRED !== 'false',

  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID || '',
  channelLink: process.env.CHANNEL_LINK || '',
  supportUsername: process.env.SUPPORT_USERNAME || 'LottoWinSupport',
  botUsername: process.env.BOT_USERNAME || '',

  nodeEnv: process.env.NODE_ENV || 'development',
  webhookUrl: process.env.WEBHOOK_URL || '',
  port: parseInt(process.env.PORT || '3000', 10),
  cmsSecret: process.env.CMS_SECRET || 'change_me',

  maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
};
