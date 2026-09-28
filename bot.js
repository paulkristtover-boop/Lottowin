require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const config = require('./config');
const logger = require('./utils/logger');
const userHandlers = require('./handlers/user');
const adminHandlers = require('./handlers/admin');
const banCheck = require('./middleware/banCheck');
const privateOnly = require('./middleware/privateOnly');
const rateLimit = require('./middleware/rateLimit');
const { startJobs } = require('./jobs');
const { mainMenu } = require('./utils/ui');
const financeService = require('./services/financeService');

if (!config.botToken) {
  console.error('BOT_TOKEN missing');
  process.exit(1);
}

const bot = new Telegraf(config.botToken);

bot.use(session());
bot.use(privateOnly);
bot.use(rateLimit(30, 60000));
bot.use(banCheck);

// Commands
bot.start(userHandlers.start);
bot.command('balance', userHandlers.balance);
bot.command('play', (ctx) => userHandlers.play.showPlayScreen(ctx));
bot.command('deposit', userHandlers.deposit.showDeposit);
bot.command('withdraw', userHandlers.withdraw.showWithdraw);
bot.command('activity', userHandlers.activity);
bot.command('referral', userHandlers.referral);
bot.command('about', userHandlers.about);
bot.command('support', userHandlers.support.showSupport);
bot.command('responsible', userHandlers.responsible.show);

// Admin
bot.command('stats', adminHandlers.stats);
bot.command('pending', adminHandlers.listPendingWd);
bot.command('approve', async (ctx) => {
  if (!adminHandlers.isAdmin(ctx)) return;
  const parts = ctx.message.text.split(' ');
  const id = parts[1];
  const tx = parts[2] || null;
  if (!id) return ctx.reply('Usage: /approve <uuid> [txhash]');
  const w = await financeService.approveWithdrawal(id, ctx.from.id, tx);
  if (w) await ctx.reply(`Approved ${id}`);
  else await ctx.reply('Not found or already processed');
});
bot.command('reject', async (ctx) => {
  if (!adminHandlers.isAdmin(ctx)) return;
  const parts = ctx.message.text.split(' ');
  const id = parts[1];
  const reason = parts.slice(2).join(' ') || 'Rejected by admin';
  if (!id) return ctx.reply('Usage: /reject <uuid> <reason>');
  const w = await financeService.rejectWithdrawal(id, ctx.from.id, reason);
  if (w) await ctx.reply(`Rejected ${id}`);
  else await ctx.reply('Not found');
});

// Text menu buttons
bot.hears('🎰 Play Lotto', (ctx) => userHandlers.play.showPlayScreen(ctx));
bot.hears('💰 Balance', userHandlers.balance);
bot.hears('📥 Deposit', userHandlers.deposit.showDeposit);
bot.hears('📤 Withdraw', userHandlers.withdraw.showWithdraw);
bot.hears('📊 Activity', userHandlers.activity);
bot.hears('👥 Referral', userHandlers.referral);
bot.hears(['ℹ️ About','ℹ️ How to Play'], userHandlers.about);
bot.hears('🆘 Support', userHandlers.support.showSupport);
bot.hears(['🛡️ Responsible', '🛡️ Responsible Play'], userHandlers.responsible.show);

// Callbacks – play
bot.action('play:add', userHandlers.play.startAddLine);
bot.action('play:qp', (ctx) => userHandlers.play.quickPick(ctx, 1));
bot.action('play:plus3', (ctx) => userHandlers.play.quickPick(ctx, 3));
bot.action('play:plus5', (ctx) => userHandlers.play.quickPick(ctx, 5));
bot.action('play:confirm', userHandlers.play.confirmPlay);
bot.action('play:cancel', userHandlers.play.cancelPlay);
bot.action(/^num:/, userHandlers.play.handleNumber);

// Deposit callbacks
bot.action('dep:usdt_trc20', (ctx) => userHandlers.deposit.showAddress(ctx, 'usdt_trc20'));
bot.action('dep:usdt_erc20', (ctx) => userHandlers.deposit.showAddress(ctx, 'usdt_erc20'));
bot.action('dep:claim', userHandlers.deposit.startClaim);

// Withdraw
bot.action(/^wd:(.+)/, (ctx) => {
  const chain = ctx.match[1];
  userHandlers.withdraw.startWithdraw(ctx, chain);
});

// Responsible
bot.action('resp:timeout24', (ctx) => userHandlers.responsible.setTimeout(ctx, 24));
bot.action('resp:exclude7', (ctx) => userHandlers.responsible.setTimeout(ctx, 24 * 7));
bot.action('resp:daily', (ctx) => userHandlers.responsible.promptLimit(ctx, 'daily'));
bot.action('resp:session', (ctx) => userHandlers.responsible.promptLimit(ctx, 'session'));
bot.action('menu:main', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Main menu', mainMenu());
});

// Text fallback for multi-step
bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;

  if (await userHandlers.start.handleOnboardingText(ctx)) return;
  if (await userHandlers.deposit.handleClaimText(ctx)) return;
  if (await userHandlers.withdraw.handleWithdrawText(ctx)) return;
  if (await userHandlers.support.handleSupportText(ctx)) return;

  // Limit setting
  if (ctx.session?.pendingLimit) {
    const type = ctx.session.pendingLimit;
    const val = parseFloat(ctx.message.text);
    delete ctx.session.pendingLimit;
    if (isNaN(val) || val < 1) {
      return ctx.reply('Invalid number. Try again from Responsible menu.');
    }
    const user = await require('./services/userService').getUser(ctx.from.id);
    const daily = type === 'daily' ? val : user.daily_limit_usd;
    const session = type === 'session' ? val : user.session_limit_usd;
    await require('./services/userService').setLimits(ctx.from.id, daily, session);
    return ctx.reply(`✅ ${type} limit set to $${val.toFixed(2)}`, mainMenu());
  }
});


// Admin: manual RNG override for next ticket
bot.command('setdraw', async (ctx) => {
  if (!adminHandlers.isAdmin(ctx)) return;
  const parts = ctx.message.text.split(/\s+/).slice(1).map(Number);
  if (parts.length !== 4 || parts.some((n) => isNaN(n))) {
    return ctx.reply('Usage: /setdraw 1 5 12 33');
  }
  try {
    require('./services/rngService').setPendingOverride(parts, ctx.from.id, 'telegram setdraw');
    await ctx.reply(`Next draw override set: ${parts.sort((a,b)=>a-b).join(', ')} (expires in 5 min)`);
  } catch (e) {
    await ctx.reply(e.message);
  }
});

bot.command('taxexport', async (ctx) => {
  if (!adminHandlers.isAdmin(ctx)) return;
  const tax = require('./services/taxService');
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const csv = await tax.exportCsv(from, to);
  const sum = await tax.summary();
  await ctx.replyWithDocument(
    { source: Buffer.from(csv), filename: `tax-ledger-${from}-${to}.csv` },
    { caption: `Tax summary: GGR $${Number(sum.ggr).toFixed(2)} | Tax $${Number(sum.tax).toFixed(2)}` }
  );
});

bot.command('broadcast', async (ctx) => {
  if (!adminHandlers.isAdmin(ctx)) return;
  const msg = ctx.message.text.replace(/^\/broadcast\s*/, '').trim();
  if (!msg) return ctx.reply('Usage: /broadcast Your message here');
  const broadcastService = require('./services/broadcastService');
  const id = await broadcastService.createBroadcast({
    message: msg,
    audience: 'all',
    createdBy: ctx.from.id,
  });
  await ctx.reply(`Broadcast queued (${id}). Sending…`);
  const result = await broadcastService.sendBroadcast(bot, id);
  await ctx.reply(`Done. Sent: ${result.sent}, failed: ${result.fail}`);
});

bot.command('liability', async (ctx) => {
  if (!adminHandlers.isAdmin(ctx)) return;
  const li = require('./services/liabilityService');
  const paid = await li.getTodayPrizesPaid();
  const config = require('./config');
  await ctx.reply(
    `Today prizes paid: $${paid.toFixed(2)} / cap $${config.dailyLiabilityCapUsd}\nRemaining: $${Math.max(0, config.dailyLiabilityCapUsd - paid).toFixed(2)}`
  );
});

bot.catch((err, ctx) => {
  logger.error('Bot error', err);
  ctx.reply('Something went wrong. Please try again.').catch(() => {});
});

async function launch() {
  startJobs();
  if (config.webhookUrl) {
    await bot.telegram.setWebhook(`${config.webhookUrl}/bot${config.botToken}`);
    logger.info('Webhook set');
  } else {
    await bot.launch();
    logger.info('Bot started (polling)');
  }
}

launch().catch((e) => {
  logger.error('Failed to start', e);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
