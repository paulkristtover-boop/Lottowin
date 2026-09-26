require('dotenv').config();

const parseIds = (str) =>
  (str || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);

module.exports = {
  botToken: process.env.BOT_TOKEN,
  adminIds: parseIds(process.env.ADMIN_IDS),
  databaseUrl: process.env.DATABASE_URL,

  // Treasury addresses
  treasury: {
    usdtTrc20: process.env.USDT_TRC20_ADDRESS || '',
    usdtErc20: process.env.USDT_ERC20_ADDRESS || '',
    btc: process.env.BTC_ADDRESS || '',
    eth: process.env.ETH_ADDRESS || '',
    trx: process.env.TRX_ADDRESS || '',
  },

  // API keys
  trongridKey: process.env.TRONGRID_API_KEY || '',
  etherscanKey: process.env.ETHERSCAN_API_KEY || '',
  blockcypherToken: process.env.BLOCKCYPHER_TOKEN || '',

  // Economy
  minDepositUsd: parseFloat(process.env.MIN_DEPOSIT_USD || '1'),
  minWithdrawUsd: parseFloat(process.env.MIN_WITHDRAW_USD || '5'),
  playCostUsd: parseFloat(process.env.PLAY_COST_USD || '0.10'),
  maxLines: parseInt(process.env.MAX_LINES_PER_TICKET || '10', 10),
  welcomeBonusUsd: parseFloat(process.env.WELCOME_BONUS_USD || '0.50'),
  referralBonusUsd: parseFloat(process.env.REFERRAL_BONUS_USD || '0.25'),
  referralPercent: parseFloat(process.env.REFERRAL_PERCENT || '5'),

  // Responsible gaming defaults
  defaultDailyLimitUsd: parseFloat(process.env.DEFAULT_DAILY_LIMIT_USD || '50'),
  defaultSessionLimitUsd: parseFloat(process.env.DEFAULT_SESSION_LIMIT_USD || '20'),
  cooldownMinutes: parseInt(process.env.COOLDOWN_MINUTES || '5', 10),

  // App
  nodeEnv: process.env.NODE_ENV || 'development',
  webhookUrl: process.env.WEBHOOK_URL || '',
  port: parseInt(process.env.PORT || '3000', 10),
  cmsSecret: process.env.CMS_SECRET || 'change-me',
  botUsername: process.env.NEXT_PUBLIC_BOT_USERNAME || 'LottoWinBot',

  // Prize table (multipliers of stake per line)
  // Matches → multiplier
  prizes: {
    4: 5000,   // 4 correct → 5000x ($500 on $0.10)
    3: 50,     // 3 correct → 50x
    2: 5,      // 2 correct → 5x
    1: 0,      // 1 correct → nothing
    0: 0,
  },

  // Channels / support
  supportUsername: process.env.SUPPORT_USERNAME || 'LottoWinSupport',
  channelLink: process.env.CHANNEL_LINK || 'https://t.me/LottoWinOfficial',
  aboutText: `🎰 *Instant 4/40 Lottery*

Pick 4 numbers from 1–40.
Instant draw. Instant results.

*How to play*
1. Deposit crypto
2. Choose up to 10 lines
3. Pick 4 numbers or Quick Pick
4. Win instantly based on matches

*Prizes* (per $0.10 line)
• 4 matches → $500
• 3 matches → $5
• 2 matches → $0.50

18+ only. Play responsibly.`,
};
