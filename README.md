# LottoWin — Daily Jackpot 4/40

Sales-funded daily jackpot (no seed). Instant 4/40 & 3/30 removed.

## Product
- Ticket: `$TICKET_PRICE_USD` (default $1)
- Pick 4 from 1–40
- **50%** of cash sales → jackpot pot (+ rollover)
- **40%** house
- Match 4 → share pot · Match 3+ → free line next draw
- Draw daily at `DRAW_HOUR_UTC` (default 19 = 20:00 WAT)

## Stack
- **Bot** (Railway): players only — no Telegram admin panel
- **CMS** (Vercel): draws, lines, users, deposits, withdrawals, channel log
- **Postgres**: `scripts/migrate-daily-jackpot.sql`

## Channel
- Pot updates + draw results → `TELEGRAM_CHANNEL_ID`
- Logged in `channel_posts` (CMS → Channel log)

## Env (core)
```
BOT_TOKEN=
DATABASE_URL=
TICKET_PRICE_USD=1
JACKPOT_SHARE_PERCENT=50
HOUSE_SHARE_PERCENT=40
DRAW_HOUR_UTC=19
TELEGRAM_CHANNEL_ID=
TRC20_MASTER_ADDRESS=
ERC20_MASTER_ADDRESS=
ETHERSCAN_API_KEY=
TRONGRID_API_KEY=
WEBHOOK_URL=
```

## Migrate
```bash
psql $DATABASE_URL -f scripts/migrate-daily-jackpot.sql
```


## Payments (native only)
- **TRX** (Tron) + **ETH** (Ethereum) — no USDT
- `TRX_MASTER_ADDRESS`, `ETH_MASTER_ADDRESS`
- `TRX_USD_RATE`, `ETH_USD_RATE` (for USD balance conversion)
- `WITHDRAW_FEE_TRX_USD`, `WITHDRAW_FEE_ETH_USD`
