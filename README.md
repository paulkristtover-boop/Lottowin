# LottoWin — Instant Win Telegram Lottery

Telegram bot + Postgres + Next.js admin CMS. Instant draws for **4/40** and **3/30**, micro USDT stakes, **USDT TRC-20 (Tron)** and **USDT ERC-20 (Ethereum)** deposits via explorer polling.

## Stack

| Piece | Role |
|--------|------|
| **Bot** (`bot.js`) | Telegraf · Railway (polling or webhook) |
| **Postgres** | Users, tickets, deposits, withdrawals, tax, audit |
| **Jobs** | Deposit scanner every **30s** (Etherscan + Tronscan/TronGrid) |
| **Admin CMS** | Next.js App Router · Vercel |

## Economy (defaults)

| Setting | Default |
|---------|---------|
| Line stake | **$0.00001** |
| Min deposit / withdraw | **$1** |
| Daily player spend limit | **$1** |
| Session spend limit | **$0.50** / 20 min |
| Cooldown | **1 min** between tickets |
| Daily liability cap | **$50** |

### Prizes (per line)

**4/40** — Match 4 **$0.10** · 3 **$0.0005** · 2 **$0.00005** · 1 **$0.000015**  
**3/30** — Match 3 **$0.01** · 2 **$0.00015** · 1 **$0.00001**

Free tickets: 5 welcome (unlock after first ≥ $1 deposit), 3 referral after first cash bet; 5% referral commission on cash play.

## Crypto payments (TRC-20 & ERC-20)

### Flow — deposits
1. User picks network (TRC-20 or ERC-20) and base USD amount (≥ min deposit).
2. Bot assigns a **unique 6-decimal amount** (base + dust) valid **15 minutes**.
3. User sends **exact USDT** to the master address.
4. Background job scans explorers; on match, credits **base** amount, stores TX hash (no double credit), notifies user (+ admins), unlocks welcome tickets if first deposit.

### Flow — withdrawals
1. User chooses network, address (validated `T…` / `0x…`), amount.
2. Balance debited; row queued as `pending`.
3. All admins get a Telegram alert with ref + address.
4. Admin sends USDT manually → `/approve <ref> <txhash>` or reject.

### Env (bot)

```bash
TELEGRAM_BOT_TOKEN=
ADMIN_IDS=111,222
DATABASE_URL=postgres://...

# Master USDT wallets (hot treasury — never commit private keys)
TRC20_MASTER_ADDRESS=T...
ERC20_MASTER_ADDRESS=0x...

ETHERSCAN_API_KEY=
TRONSCAN_API_KEY=
# optional alias
TRONGRID_API_KEY=

MIN_DEPOSIT_USD=1
MIN_WITHDRAW_USD=1
PLAY_COST_USD=0.00001
DEFAULT_DAILY_LIMIT_USD=1
DEFAULT_SESSION_LIMIT_USD=0.5
DEFAULT_SESSION_LIMIT_MINS=20
COOLDOWN_MINUTES=1
DAILY_LIABILITY_CAP_USD=50
```

Contracts used:
- USDT ERC-20: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
- USDT TRC-20: `TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t`

## User bot

- Slim menu: **Play · Wallet · Support** (+ **More**)
- Play → 4/40 or 3/30 (howto per game)
- Wallet / Deposit / Withdraw for USDT both networks
- Responsible gaming, referral, activity

## Admin bot

Keyboard: Stats, Pending WD, **Pending Dep**, Broadcast, Message User, Support, Liability, Set Draw, Tax Export.

Useful commands: `/stats` `/pending` `/pendingdep` `/approve` `/reject` `/broadcast` `/dm`

## Admin CMS (Vercel)

Dashboard, users (detail), tickets, free-ticket ledger, deposits, withdrawals, treasury (addresses + by chain), tax, fraud, broadcast, message, settings.

Set the **same** `DATABASE_URL` and treasury address env vars on Vercel for treasury page display. Auth via `CMS_ADMIN_USER` / `CMS_ADMIN_PASS` (or project auth).

## Deploy

```bash
# DB
psql $DATABASE_URL -f postgres/schema.sql
psql $DATABASE_URL -f scripts/migrate-free-tickets.sql
psql $DATABASE_URL -f scripts/migrate-micro-limits.sql

# Bot
npm install
npm start

# CMS
cd admin-cms && npm install && npm run build
```

See `docs/DEPLOY_RAILWAY.md` and `docs/DEPLOY_VERCEL.md` if present.

## Responsible gaming

18+ · age + CAPTCHA onboarding · daily/session limits · cooldown · time-out / self-exclude · BeGambleAware-style messaging.

## License

MIT

## Play-through, fees & contests

| Rule | Default |
|------|---------|
| Play-through | **100%** of deposits (cash ticket spend) before withdraw |
| Withdrawal fee | **2%** of requested amount (debited with the hold) |
| Daily wager contest pool | **$5** shared by top **100** (your rank *ratios*, scaled from $2630 table) |
| Weekly referral pool | **$2** shared by top **20** (ratios from $1100 table) |

Raise `DAILY_WAGER_POOL_USD` / `WEEKLY_REFERRAL_POOL_USD` when treasury can fund full tables.

### Telegram channel (`TELEGRAM_CHANNEL_ID`)

Add the bot as **admin** with post permission. The bot will:

1. **Hourly** — live/recent bets (anonymized) + reminder: deposit $1 → 5 free tickets  
2. **Hourly** — daily wager contest top snapshot  
3. **Weekly (Mon UTC)** — referral battle snapshot after settle  
4. **Settle jobs** — credit contest prizes to balances (not on-chain auto-pay)

Users still play only in the **bot**; the channel is broadcast/social proof.
