# Deploy Admin CMS to Vercel

1. `cd admin-cms`
2. `vercel` or connect the folder in Vercel dashboard.
3. Environment variables:
   - `DATABASE_URL` (same Postgres as the bot)
   - `CMS_SECRET`
   - `CMS_ADMIN_USER` / `CMS_ADMIN_PASS`
   - `NEXT_PUBLIC_BOT_USERNAME`
4. Deploy.

The CMS is a standard Next.js App Router app with cookie-based auth.
