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
  prizesUsd: {
    4: 100.0,   // Match 4 — top prize (capped; was conceptually ₦1M scale)
    3: 5.0,     // Match 3
    2: 0.5,     // Match 2
    1: 0.15,    // Match 1 — consolation (as requested)
    0: 0,
  },

  // Channels / support
  supportUsername: process.env.SUPPORT_USERNAME || 'LottoWinSupport',
  channelLink: process.env.CHANNEL_LINK || 'https://t.me/LottoWinOfficial',

  howToPlayText: `🎰 *How to play Insta Win 4/40*

Insta Win 4/40 is an *instant* lottery — no waiting for a draw. Pick your 4 lucky numbers, place your bet, and find out if you've won immediately.

*The Goal:* Match as many of your 4 numbers to the 4 winning numbers as you can. Even matching just *1* wins a prize!

*1. Choose your numbers*
Pick 4 lucky numbers from the grid of 1 to 40. You must select exactly 4 numbers. You can also use *Quick Pick* to have numbers chosen randomly.

*2. Place your bet*
Tap play to confirm. Stake is deducted from your balance. If balance is too low you will be prompted to top up.

*3. See your result instantly*
The 4 winning numbers are revealed right away. The more you match, the bigger your prize!

*How much can I win?* (per $0.10 line)
\`\`\`
| Matched | Prize   |
| ------- | ------- |
| Match 4 | $100.00 |
| Match 3 | $5.00   |
| Match 2 | $0.50   |
| Match 1 | $0.15   |
\`\`\`

🎁 5 free tickets unlock after your first $1+ deposit.
👥 Refer friends — unlock free tickets + 5% commission.
⚠️ 18+ only. Play responsibly. Set limits. Take time-outs.

Good luck!`,
};
