require('dotenv').config();

const parseIds = (str) =>
  (str || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);

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
  playCostUsd: parseFloat(process.env.PLAY_COST_USD || '0.00001'),
  maxLines: parseInt(process.env.MAX_LINES_PER_TICKET || '10', 10),
  // Free tickets (cash bonuses disabled)
  welcomeBonusUsd: 0,
  referralBonusUsd: 0,
  welcomeFreeTickets: parseInt(process.env.WELCOME_FREE_TICKETS || '5', 10),
  referralFreeTickets: parseInt(process.env.REFERRAL_FREE_TICKETS || '3', 10),
  referralPercent: parseFloat(process.env.REFERRAL_COMMISSION_PERCENT || process.env.REFERRAL_PERCENT || '5'),

  // Liability & risk (startup-safe)
  maxPrizePerLineUsd: parseFloat(process.env.MAX_PRIZE_PER_LINE_USD || '0.10'),     // hard cap per line (micro)
  maxPrizePerTicketUsd: parseFloat(process.env.MAX_PRIZE_PER_TICKET_USD || '1'),    // hard cap per ticket (micro)
  dailyLiabilityCapUsd: parseFloat(process.env.DAILY_LIABILITY_CAP_USD || '50'),    // max prizes paid per UTC day (micro)
  maxBalanceUsd: parseFloat(process.env.MAX_BALANCE_USD || '500'),                  // soft wallet cap

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
  // Contest pools (micro-scaled; rank *ratios* match operator table $2630 / $1100)
  dailyWagerPoolUsd: parseFloat(process.env.DAILY_WAGER_POOL_USD || '5'),
  weeklyReferralPoolUsd: parseFloat(process.env.WEEKLY_REFERRAL_POOL_USD || '2'),
  telegramChannelId: process.env.TELEGRAM_CHANNEL_ID || '',
  contestChannelHourly: (process.env.CONTEST_CHANNEL_HOURLY || 'true') === 'true',

  nodeEnv: process.env.NODE_ENV || 'development',
  webhookUrl: process.env.WEBHOOK_URL || '',
  port: parseInt(process.env.PORT || '3000', 10),
  cmsSecret: process.env.CMS_SECRET || 'change-me',
  botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME || 'LottoWinBot',

  /**
   * Prize table — micro USDT (stake $0.00001).
   * Converted from original Naira structure; Match 1 now pays.
   * Tiered grader may reduce large wins if liability caps are hit.
   */
  /**
   * Micro USDT: $0.00001 / line.
   * AfriMillions-style instant ratio (₦100 → ₦1M top = 10,000×) applied to micro stake.
   * 4/40: 10000× / 50× / 5× / 1.5× → $0.10 / $0.0005 / $0.00005 / $0.000015
   * 3/30: 1000× / 15× / 1× → $0.01 / $0.00015 / $0.00001
   */
  games: {
    '4_40': {
      id: '4_40',
      name: 'Insta Win 4/40',
      pick: 4,
      from: 1,
      to: 40,
      playCostUsd: parseFloat(process.env.PLAY_COST_USD || '0.00001'),
      maxLines: parseInt(process.env.MAX_LINES_PER_TICKET || '10', 10),
      prizesUsd: { 4: 0.1, 3: 0.0005, 2: 0.00005, 1: 0.000015, 0: 0 },
      maxPrizePerLineUsd: parseFloat(process.env.MAX_PRIZE_PER_LINE_USD || '0.10'),
      howToPlay:
        '🎯 *How to play Insta Win 4/40*\n\n' +
        'Instant micro lottery — results in seconds.\n\n' +
        '*Goal:* Match your 4 numbers to the 4 winning numbers. Even *1 match* wins!\n\n' +
        '*1. Choose numbers*\n' +
        'Pick *exactly 4* from *1–40* (or Quick Pick).\n\n' +
        '*2. Place your bet*\n' +
        'Confirm to play. Stake is *$0.00001 per line* (free tickets used first).\n\n' +
        '*3. Instant result*\n' +
        'Winning numbers are revealed immediately.\n\n' +
        '*Prizes (per line)* — 10,000× top (AfriMillions-style)\n' +
        '• Match 4 → *$0.10*\n' +
        '• Match 3 → *$0.0005*\n' +
        '• Match 2 → *$0.00005*\n' +
        '• Match 1 → *$0.000015*\n\n' +
        'Up to 10 lines. 18+ · Play responsibly.',
    },
    '3_30': {
      id: '3_30',
      name: 'Insta Win 3/30',
      pick: 3,
      from: 1,
      to: 30,
      playCostUsd: parseFloat(process.env.PLAY_COST_3_30_USD || process.env.PLAY_COST_USD || '0.00001'),
      maxLines: parseInt(process.env.MAX_LINES_3_30 || '10', 10),
      prizesUsd: { 3: 0.01, 2: 0.00015, 1: 0.00001, 0: 0 },
      maxPrizePerLineUsd: parseFloat(process.env.MAX_PRIZE_3_30_LINE_USD || '0.01'),
      howToPlay:
        '🎲 *How to play Insta Win 3/30*\n\n' +
        'Pick *3* from *1–30*. Instant micro result.\n\n' +
        '*Goal:* Match the winning numbers. Even *1 match* pays!\n\n' +
        '*1. Choose numbers*\n' +
        'Select *exactly 3* from *1–30* (or Quick Pick).\n\n' +
        '*2. Place your bet*\n' +
        'Confirm to play. Stake is *$0.00001 per line* (free tickets used first).\n\n' +
        '*3. Instant result*\n' +
        'Three winning numbers shown right away.\n\n' +
        '*Prizes (per line)*\n' +
        '• Match 3 → *$0.01*\n' +
        '• Match 2 → *$0.00015*\n' +
        '• Match 1 → *$0.00001*\n\n' +
        'Up to 10 lines. 18+ · Play responsibly.',
    },
  },
  // Legacy alias (4/40)
  prizesUsd: {
    4: 0.1,
    3: 0.0005,
    2: 0.00005,
    1: 0.000015,
    0: 0,
  },

  // Channels / support
  supportUsername: process.env.SUPPORT_USERNAME || 'LottoWinSupport',
  channelLink: process.env.CHANNEL_LINK || 'https://t.me/LottoWinOfficial',

  howToPlayText: 'Choose a game under Play for game-specific instructions (4/40 or 3/30).',
};
