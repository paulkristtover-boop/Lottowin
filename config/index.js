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
  minWithdrawUsd: parseFloat(process.env.MIN_WITHDRAW_USD || '2'),
  playCostUsd: parseFloat(process.env.PLAY_COST_USD || '0.10'),
  maxLines: parseInt(process.env.MAX_LINES_PER_TICKET || '10', 10),
  // Free tickets (cash bonuses disabled)
  welcomeBonusUsd: 0,
  referralBonusUsd: 0,
  welcomeFreeTickets: parseInt(process.env.WELCOME_FREE_TICKETS || '5', 10),
  referralFreeTickets: parseInt(process.env.REFERRAL_FREE_TICKETS || '3', 10),
  referralPercent: parseFloat(process.env.REFERRAL_COMMISSION_PERCENT || process.env.REFERRAL_PERCENT || '5'),

  // Liability & risk (startup-safe)
  maxPrizePerLineUsd: parseFloat(process.env.MAX_PRIZE_PER_LINE_USD || '100'),      // hard cap per line
  maxPrizePerTicketUsd: parseFloat(process.env.MAX_PRIZE_PER_TICKET_USD || '250'),  // hard cap per ticket
  dailyLiabilityCapUsd: parseFloat(process.env.DAILY_LIABILITY_CAP_USD || '2000'),  // max prizes paid per UTC day
  maxBalanceUsd: parseFloat(process.env.MAX_BALANCE_USD || '500'),                  // soft wallet cap

  // Gaming tax (e.g. 11% of GGR)
  gamingTaxRate: parseFloat(process.env.GAMING_TAX_RATE || '0.11'),

  // Age gate
  minAge: parseInt(process.env.MIN_AGE || '18', 10),

  // Responsible gaming defaults
  defaultDailyLimitUsd: parseFloat(process.env.DEFAULT_DAILY_LIMIT_USD || '50'),
  defaultSessionLimitUsd: parseFloat(process.env.DEFAULT_SESSION_LIMIT_USD || '20'),
  defaultSessionLimitMins: parseInt(process.env.DEFAULT_SESSION_LIMIT_MINS || '20', 10),
  cooldownMinutes: parseInt(process.env.COOLDOWN_MINUTES || '5', 10),

  nodeEnv: process.env.NODE_ENV || 'development',
  webhookUrl: process.env.WEBHOOK_URL || '',
  port: parseInt(process.env.PORT || '3000', 10),
  cmsSecret: process.env.CMS_SECRET || 'change-me',
  botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME || 'LottoWinBot',

  /**
   * Prize table — fixed USD amounts per line (stake $0.10).
   * Converted from original Naira structure; Match 1 now pays.
   * Tiered grader may reduce large wins if liability caps are hit.
   */
  /**
   * Multi-game catalogue. Naira→USD using platform scale (~₦10,000 ≈ $1),
   * consistent with 4/40 Match-4 ₦1M → $100.
   * 3/30: Match3 ₦100k→$10, Match2 ₦1.5k→$0.15, Match1 ₦100→$0.05 (floor for UX).
   */
  games: {
    '4_40': {
      id: '4_40',
      name: 'Insta Win 4/40',
      pick: 4,
      from: 1,
      to: 40,
      playCostUsd: parseFloat(process.env.PLAY_COST_USD || '0.10'),
      maxLines: parseInt(process.env.MAX_LINES_PER_TICKET || '10', 10),
      prizesUsd: { 4: 100.0, 3: 5.0, 2: 0.5, 1: 0.15, 0: 0 },
      maxPrizePerLineUsd: parseFloat(process.env.MAX_PRIZE_PER_LINE_USD || '100'),
      howToPlay:
        '🎯 *How to play Insta Win 4/40*\n\n' +
        'Instant lottery — no waiting for a draw.\n\n' +
        '*Goal:* Match your 4 numbers to the 4 winning numbers. Even *1 match* wins!\n\n' +
        '*1. Choose numbers*\n' +
        'Pick *exactly 4* numbers from *1–40* (or use Quick Pick).\n\n' +
        '*2. Place your bet*\n' +
        'Confirm to play. Stake is *$0.10 per line* (free tickets used first).\n\n' +
        '*3. Instant result*\n' +
        'Winning numbers are revealed immediately.\n\n' +
        '*Prizes (per line)*\n' +
        '• Match 4 → *$100*\n' +
        '• Match 3 → *$5*\n' +
        '• Match 2 → *$0.50*\n' +
        '• Match 1 → *$0.15*\n\n' +
        'Up to 10 lines per ticket. 18+ · Play responsibly.',
    },
    '3_30': {
      id: '3_30',
      name: 'Insta Win 3/30',
      pick: 3,
      from: 1,
      to: 30,
      playCostUsd: parseFloat(process.env.PLAY_COST_3_30_USD || process.env.PLAY_COST_USD || '0.10'),
      maxLines: parseInt(process.env.MAX_LINES_3_30 || '10', 10),
      prizesUsd: { 3: 10.0, 2: 0.15, 1: 0.05, 0: 0 },
      maxPrizePerLineUsd: parseFloat(process.env.MAX_PRIZE_3_30_LINE_USD || '10'),
      howToPlay:
        '🎲 *How to play Insta Win 3/30*\n\n' +
        'Faster grid — pick *3* numbers from *1–30*. Instant result.\n\n' +
        '*Goal:* Match as many as you can to the 3 winning numbers. Even *1 match* pays!\n\n' +
        '*1. Choose numbers*\n' +
        'Select *exactly 3* numbers from *1–30* (or Quick Pick).\n\n' +
        '*2. Place your bet*\n' +
        'Confirm to play. Stake is *$0.10 per line* (free tickets used first).\n\n' +
        '*3. Instant result*\n' +
        'Three winning numbers are shown right away.\n\n' +
        '*Prizes (per line)*\n' +
        '• Match 3 → *$10*\n' +
        '• Match 2 → *$0.15*\n' +
        '• Match 1 → *$0.05*\n\n' +
        'Up to 10 lines per ticket. 18+ · Play responsibly.',
    },
  },
  // Legacy alias (4/40)
  prizesUsd: {
    4: 100.0,
    3: 5.0,
    2: 0.5,
    1: 0.15,
    0: 0,
  },

  // Channels / support
  supportUsername: process.env.SUPPORT_USERNAME || 'LottoWinSupport',
  channelLink: process.env.CHANNEL_LINK || 'https://t.me/LottoWinOfficial',

  howToPlayText: 'Choose a game under Play for game-specific instructions (4/40 or 3/30).',
};
