require('dotenv').config();

const parseIds = (str) =>
  (str || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);

/** Stake from env — prizes scale from this via fixed multiples. */
const PLAY_COST_USD = parseFloat(process.env.PLAY_COST_USD || '0.0001');
const PLAY_COST_3_30 = parseFloat(
  process.env.PLAY_COST_3_30_USD || process.env.PLAY_COST_USD || '0.0001'
);

/** Fixed payout multiples (prize = multiple × line stake). */
const MULTIPLES_4_40 = { 4: 10000, 3: 50, 2: 5, 1: 1.5, 0: 0 };
const MULTIPLES_3_30 = { 3: 1000, 2: 15, 1: 1, 0: 0 };

function prizesFromCost(cost, multiples) {
  const out = {};
  for (const [k, m] of Object.entries(multiples)) {
    const n = Number(k);
    out[n] = Math.round(Number(cost) * Number(m) * 1e8) / 1e8;
  }
  return out;
}

const PRIZES_4_40 = prizesFromCost(PLAY_COST_USD, MULTIPLES_4_40);
const PRIZES_3_30 = prizesFromCost(PLAY_COST_3_30, MULTIPLES_3_30);

module.exports = {
  botToken: process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN,
  adminIds: parseIds(process.env.ADMIN_IDS),
  databaseUrl: process.env.DATABASE_URL,

  treasury: {
    usdtTrc20: process.env.TRC20_MASTER_ADDRESS || process.env.USDT_TRC20_ADDRESS || '',
    usdtErc20: process.env.ERC20_MASTER_ADDRESS || process.env.USDT_ERC20_ADDRESS || '',
    btc: process.env.BTC_ADDRESS || '',
    eth: process.env.ETH_ADDRESS || '',
    trx: process.env.TRX_ADDRESS || '',
  },

  trongridKey: process.env.TRONGRID_API_KEY || process.env.TRONSCAN_API_KEY || '',
  tronscanKey: process.env.TRONSCAN_API_KEY || '',
  etherscanKey: process.env.ETHERSCAN_API_KEY || '',
  blockcypherToken: process.env.BLOCKCYPHER_TOKEN || '',

  // Economy (USD)
  minDepositUsd: parseFloat(process.env.MIN_DEPOSIT_USD || '1'),
  minWithdrawUsd: parseFloat(process.env.MIN_WITHDRAW_USD || '1'),
  playCostUsd: PLAY_COST_USD,
  maxLines: parseInt(process.env.MAX_LINES_PER_TICKET || '10', 10),
  // Free tickets (cash bonuses disabled)
  welcomeBonusUsd: 0,
  referralBonusUsd: 0,
  welcomeFreeTickets: parseInt(process.env.WELCOME_FREE_TICKETS || '5', 10),
  referralFreeTickets: parseInt(process.env.REFERRAL_FREE_TICKETS || '3', 10),
  referralPercent: parseFloat(process.env.REFERRAL_COMMISSION_PERCENT || process.env.REFERRAL_PERCENT || '5'),

  // Liability & risk — defaults track top prize (override with env if needed)
  maxPrizePerLineUsd: parseFloat(process.env.MAX_PRIZE_PER_LINE_USD || String(PRIZES_4_40[4])),
  maxPrizePerTicketUsd: parseFloat(
    process.env.MAX_PRIZE_PER_TICKET_USD || String(Math.max(PRIZES_4_40[4] * 10, PRIZES_4_40[4]))
  ),
  dailyLiabilityCapUsd: parseFloat(process.env.DAILY_LIABILITY_CAP_USD || '50'),
  maxBalanceUsd: parseFloat(process.env.MAX_BALANCE_USD || '500'),

  // Gaming tax (e.g. 11% of GGR)
  gamingTaxRate: parseFloat(process.env.GAMING_TAX_RATE || '0.11'),

  // Age gate
  minAge: parseInt(process.env.MIN_AGE || '18', 10),

  // Responsible gaming defaults
  defaultDailyLimitUsd: parseFloat(process.env.DEFAULT_DAILY_LIMIT_USD || '1'),
  defaultSessionLimitUsd: parseFloat(process.env.DEFAULT_SESSION_LIMIT_USD || '0.5'),
  defaultSessionLimitMins: parseInt(process.env.DEFAULT_SESSION_LIMIT_MINS || '20', 10),
  cooldownMinutes: parseInt(process.env.COOLDOWN_MINUTES || '1', 10),
  playthroughPercent: parseFloat(process.env.PLAYTHROUGH_PERCENT || '100'),
  withdrawalFeePercent: parseFloat(process.env.WITHDRAWAL_FEE_PERCENT || '2'),
  dailyWagerPoolUsd: parseFloat(process.env.DAILY_WAGER_POOL_USD || '5'),
  weeklyReferralPoolUsd: parseFloat(process.env.WEEKLY_REFERRAL_POOL_USD || '2'),
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID || '',
  contestChannelHourly: (process.env.CONTEST_CHANNEL_HOURLY || 'true') === 'true',

  nodeEnv: process.env.NODE_ENV || 'development',
  webhookUrl: process.env.WEBHOOK_URL || '',
  port: parseInt(process.env.PORT || '3000', 10),
  cmsSecret: process.env.CMS_SECRET || 'change_me_long_random_string',
  botUsername: process.env.BOT_USERNAME || process.env.NEXT_PUBLIC_BOT_USERNAME || '',

  /**
   * Prize multiples (fixed). Dollar prizes = multiple × playCostUsd.
   * 4/40: 10000× / 50× / 5× / 1.5×
   * 3/30: 1000× / 15× / 1×
   */
  prizeMultiples: {
    '4_40': { ...MULTIPLES_4_40 },
    '3_30': { ...MULTIPLES_3_30 },
  },

  games: {
    '4_40': {
      id: '4_40',
      name: 'Insta Win 4/40',
      pick: 4,
      from: 1,
      to: 40,
      playCostUsd: PLAY_COST_USD,
      maxLines: parseInt(process.env.MAX_LINES_PER_TICKET || '10', 10),
      prizeMultiples: { ...MULTIPLES_4_40 },
      prizesUsd: { ...PRIZES_4_40 },
      maxPrizePerLineUsd: parseFloat(process.env.MAX_PRIZE_PER_LINE_USD || String(PRIZES_4_40[4])),
    },
    '3_30': {
      id: '3_30',
      name: 'Insta Win 3/30',
      pick: 3,
      from: 1,
      to: 30,
      playCostUsd: PLAY_COST_3_30,
      maxLines: parseInt(process.env.MAX_LINES_3_30 || process.env.MAX_LINES_PER_TICKET || '10', 10),
      prizeMultiples: { ...MULTIPLES_3_30 },
      prizesUsd: { ...PRIZES_3_30 },
      maxPrizePerLineUsd: parseFloat(process.env.MAX_PRIZE_3_30_LINE_USD || String(PRIZES_3_30[3])),
    },
  },

  // Legacy alias (4/40 scaled prizes)
  prizesUsd: { ...PRIZES_4_40 },

  // Channels / support
  supportUsername: process.env.SUPPORT_USERNAME || 'LottoWinSupport',
  channelLink: process.env.CHANNEL_LINK || 'https://t.me/LottoWinOfficial',

  howToPlayText: 'Choose a game under Play for game-specific instructions (4/40 or 3/30).',

  maintenanceMode: process.env.MAINTENANCE_MODE === 'true',
  maintenanceMessage: process.env.MAINTENANCE_MESSAGE || '',
  termsVersion: process.env.TERMS_VERSION || '1.0',
  termsRequired: process.env.TERMS_REQUIRED !== 'false',
  termsSummary: process.env.TERMS_SUMMARY || '',
};
