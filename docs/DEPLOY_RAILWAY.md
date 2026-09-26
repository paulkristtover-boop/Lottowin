# Deploy Bot to Railway

1. Create a new Railway project.
2. Add a PostgreSQL plugin.
3. Connect your GitHub repo (or deploy from CLI).
4. Set environment variables from `.env.example`.
5. Run migration once:
   ```
   railway run npm run migrate
   ```
6. Deploy. The `Procfile` / `railway.json` starts `node bot.js`.

Webhook (optional): set `WEBHOOK_URL` to your Railway public URL and the bot will use webhook mode.
