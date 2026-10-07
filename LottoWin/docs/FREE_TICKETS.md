# Free Tickets (anti bonus-farming)

## Rules
- **Welcome:** 5 tickets granted as LOCKED after age + CAPTCHA.
- **Unlock:** First confirmed deposit >= MIN_DEPOSIT moves locked → unlocked.
- **Referral tickets:** 3 unlocked tickets to referrer when referred user places first **cash** bet.
- **Commission:** 5% of referred user's **cash** ticket spend only.
- Free tickets consumed before cash. Cash spend counts toward $50 daily limit.

## Postgres (no Prisma required)
See `scripts/migrate-free-tickets.sql` and `postgres/schema.sql`.

## Redis (optional cache layer)
If you add Redis later:
```
liability:daily:{YYYY-MM-DD}     → prizes_paid (string float)
spend:user:{telegramId}:{YYYY-MM-DD} → cash spent USD
```
Current implementation uses `daily_liability` and `daily_spend` tables (atomic, survives restarts).

## Deploy
```bash
psql $DATABASE_URL -f scripts/migrate-free-tickets.sql
# set env WELCOME_FREE_TICKETS=5 REFERRAL_FREE_TICKETS=3 MIN_WITHDRAW_USD=2
# restart bot
```
