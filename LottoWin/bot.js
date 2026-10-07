require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const config = require('./config');
const logger = require('./utils/logger');
const userHandlers = require('./handlers/user');
const adminHandlers = require('./handlers/admin');
const banCheck = require('./middleware/banCheck');
const privateOnly = require('./middleware/privateOnly');
const rateLimit = require('./middleware/rateLimit');
const adminGuard = require('./middleware/adminGuard');
const maintenance = require('./middleware/maintenance');
const termsGate = require('./middleware/termsGate');
const { startJobs, setBot } = require('./jobs');
const channelMembership = require('./services/channelMembershipService');
const { mainMenu } = require('./utils/ui');
const financeService = require('./services/financeService');
const adminKb = require('./keyboards/admin');

if (!config.botToken) {
  console.error('BOT_TOKEN missing');
  process.exit(1);
}

const bot = new Telegraf(config.botToken);

bot.use(session());
bot.use(privateOnly);
bot.use(rateLimit(30, 60000));
bot.use(banCheck);
bot.use(maintenance);
bot.use(termsGate);
bot.use(adminGuard);

// ─── Start: admin gets panel, users get onboarding ───
bot.start(async (ctx) => {
  if (adminHandlers.isAdmin(ctx)) {
    return adminHandlers.showPanel(ctx);
  }
  return userHandlers.start(ctx);
});

// ─── User commands (admins blocked by adminGuard for non-admin paths) ───
bot.command('balance', userHandlers.balance);
bot.command('wallet', (ctx) => userHandlers.wallet.showWallet(ctx));
bot.command('play', (ctx) => userHandlers.play.showGamePicker(ctx));
bot.command('deposit', userHandlers.deposit.showDeposit);
bot.command('withdraw', userHandlers.withdraw.showWithdraw);
bot.command('activity', userHandlers.activity);
bot.command('referral', userHandlers.referral);
bot.command('about', userHandlers.about);
bot.command('support', userHandlers.support.showSupport);
bot.command('responsible', userHandlers.responsible.show);

// ─── Admin commands ───

bot.command('maintenance', async (ctx) => {
  if (!adminHandlers.isAdmin(ctx)) return;
  const parts = (ctx.message.text || '').trim().split(/\s+/);
  const arg = (parts[1] || '').toLowerCase();
  const settingsService = require('./services/settingsService');
  const maintenance = require('./middleware/maintenance');
  if (arg === 'on') {
    await settingsService.set('maintenance_mode', 'true');
    maintenance.bustCache();
    return ctx.reply('🛠️ Maintenance mode *ON* — users are blocked.', { parse_mode: 'Markdown' });
  }
  if (arg === 'off') {
    await settingsService.set('maintenance_mode', 'false');
    maintenance.bustCache();
    return ctx.reply('✅ Maintenance mode *OFF* — bot open to users.', { parse_mode: 'Markdown' });
  }
  if (arg === 'status') {
    const on = await maintenance.isMaintenanceOn();
    return ctx.reply(`Maintenance is *${on ? 'ON' : 'OFF'}*`, { parse_mode: 'Markdown' });
  }
  return ctx.reply('Usage: /maintenance on | off | status');
});

bot.action('terms:accept', async (ctx) => {
  try {
    await ctx.answerCbQuery('Thanks');
  } catch (_) {}
  const termsGate = require('./middleware/termsGate');
  await termsGate.acceptTerms(ctx.from.id);
  await ctx.replyWithMarkdown(
    '✅ *Terms accepted.* Welcome aboard.\n\nTap *Play* or open the menu to continue.',
    require('./utils/ui').mainMenu()
  );
});

bot.action('terms:show', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch (_) {}
  const termsGate = require('./middleware/termsGate');
  await ctx.replyWithMarkdown(termsGate.termsText(), termsGate.termsKeyboard());
});

bot.command('admin', (ctx) => adminHandlers.showPanel(ctx));
bot.command('stats', (ctx) => adminHandlers.stats(ctx));
bot.command('pending', (ctx) => adminHandlers.listPendingWd(ctx));
bot.command('pendingdep', (ctx) => adminHandlers.listPendingDeposits(ctx));
bot.command('creditdep', (ctx) => adminHandlers.creditDeposit(ctx));
bot.command('approve', async (ctx) => {
  if (!adminHandlers.isAdmin(ctx)) return;
  const parts = ctx.message.text.split(/\s+/);
  const id = parts[1];
  const tx = parts[2] || null;
  if (!id) return ctx.reply('Usage: /approve <uuid> [txhash]', adminKb.main());
  const w = await financeService.approveWithdrawal(id, ctx.from.id, tx);
  await ctx.reply(w ? `Approved ${id}` : 'Not found or already processed', adminKb.main());
});
bot.command('reject', async (ctx) => {
  if (!adminHandlers.isAdmin(ctx)) return;
  const parts = ctx.message.text.split(/\s+/);
  const id = parts[1];
  const reason = parts.slice(2).join(' ') || 'Rejected by admin';
  if (!id) return ctx.reply('Usage: /reject <uuid> <reason>', adminKb.main());
  const w = await financeService.rejectWithdrawal(id, ctx.from.id, reason);
  await ctx.reply(w ? `Rejected ${id}` : 'Not found', adminKb.main());
});
bot.command('setdraw', (ctx) => adminHandlers.startSetDraw(ctx));
bot.command('taxexport', (ctx) => adminHandlers.taxExport(ctx));
bot.command('broadcast', async (ctx) => {
  if (!adminHandlers.isAdmin(ctx)) return;
  const msg = ctx.message.text.replace(/^\/broadcast(@\w+)?\s*/, '').trim();
  if (msg) {
    // One-shot: /broadcast Hello everyone
    const broadcastService = require('./services/broadcastService');
    const id = await broadcastService.createBroadcast({
      message: msg,
      audience: 'all',
      createdBy: ctx.from.id,
    });
    await ctx.reply('📢 Sending…');
    const result = await broadcastService.sendBroadcast(bot, id);
    return ctx.reply(
      `Done. Sent: ${result?.sent ?? 0}, failed: ${result?.fail ?? 0}`,
      require('./keyboards/admin').main()
    );
  }
  return adminHandlers.startBroadcast(ctx);
});
bot.command('dm', (ctx) => adminHandlers.startDm(ctx));
bot.command('liability', (ctx) => adminHandlers.liability(ctx));
bot.command('tickets', (ctx) => adminHandlers.listSupport(ctx));

// ─── User text menu (slim primary + More) ───
bot.hears(['🎰 Play', '🎰 Play Lotto'], async (ctx) => {
  await channelMembership.softRemindIfNeeded(ctx, bot).catch(() => {});
  return userHandlers.play.showGamePicker(ctx);
});
bot.hears(['👛 Wallet', 'Wallet'], (ctx) => userHandlers.wallet.showWallet(ctx));
bot.hears('🆘 Support', userHandlers.support.showSupport);
bot.hears('📋 More', async (ctx) => {
  const { moreMenu } = require('./utils/ui');
  await ctx.reply('More options:', moreMenu());
});
bot.hears(['« Main menu', 'Main menu'], async (ctx) => {
  await ctx.reply('Main menu', mainMenu());
});
bot.hears('💰 Balance', userHandlers.balance);
bot.hears('📥 Deposit', userHandlers.deposit.showDeposit);
bot.hears('📤 Withdraw', userHandlers.withdraw.showWithdraw);
bot.hears('📊 Activity', userHandlers.activity);
bot.hears(['🎯 Wager', 'Wager'], userHandlers.wager);
bot.hears(['📡 Live bets', 'Live bets'], userHandlers.live);
bot.hears(['⚔️ Battle', 'Referral Battle'], userHandlers.battle);
bot.hears(['🏁 Contest', 'Daily Contest'], (ctx) => userHandlers.contest.showDaily(ctx));
bot.hears('👥 Referral', userHandlers.referral);
bot.hears(['ℹ️ About', 'ℹ️ How to Play'], userHandlers.about);
bot.hears(['🛡️ Responsible', '🛡️ Responsible Play'], userHandlers.responsible.show);

// ─── Admin text menu ───
bot.hears('📈 Stats', (ctx) => adminHandlers.stats(ctx));
bot.hears('💸 Pending WD', (ctx) => adminHandlers.listPendingWd(ctx));
bot.hears(['📥 Pending Dep', '📥 Pending Deposits'], (ctx) => adminHandlers.listPendingDeposits(ctx));
bot.hears('📢 Broadcast', (ctx) => adminHandlers.startBroadcast(ctx));
bot.hears('💬 Message User', (ctx) => adminHandlers.startDm(ctx));
bot.hears('🎫 Support Tickets', (ctx) => adminHandlers.listSupport(ctx));
bot.hears('🛡️ Liability', (ctx) => adminHandlers.liability(ctx));
bot.hears('🎲 Set Draw', (ctx) => adminHandlers.startSetDraw(ctx));
bot.hears('📊 Tax Export', (ctx) => adminHandlers.taxExport(ctx));
bot.hears('🔒 Admin Panel', (ctx) => adminHandlers.showPanel(ctx));

// ─── User callbacks ───
bot.action('game:4_40', (ctx) => userHandlers.play.selectGame(ctx, '4_40'));
bot.action('game:3_30', (ctx) => userHandlers.play.selectGame(ctx, '3_30'));
bot.action('howto:4_40', (ctx) => userHandlers.about.showHowTo(ctx, '4_40'));
bot.action('howto:3_30', (ctx) => userHandlers.about.showHowTo(ctx, '3_30'));
bot.action('howto:menu', (ctx) => userHandlers.about(ctx));
bot.action('menu:play', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch (_) {}
  return userHandlers.play.showGamePicker(ctx);
});
bot.action('play:add', userHandlers.play.startAddLine);
bot.action('play:qp', (ctx) => userHandlers.play.quickPick(ctx, 1));
bot.action('play:plus3', (ctx) => userHandlers.play.quickPick(ctx, 3));
bot.action('play:plus5', (ctx) => userHandlers.play.quickPick(ctx, 5));
bot.action('play:confirm', userHandlers.play.confirmPlay);
bot.action('play:cancel', userHandlers.play.cancelPlay);
bot.action(/^num:/, userHandlers.play.handleNumber);
bot.action('dep:trc20', (ctx) => userHandlers.deposit.startNetwork(ctx, 'trc20'));
bot.action('dep:erc20', (ctx) => userHandlers.deposit.startNetwork(ctx, 'erc20'));
bot.action('dep:usdt_trc20', (ctx) => userHandlers.deposit.startNetwork(ctx, 'trc20'));
bot.action('dep:usdt_erc20', (ctx) => userHandlers.deposit.startNetwork(ctx, 'erc20'));
bot.action('dep:status', (ctx) => userHandlers.deposit.showStatus(ctx));
bot.action(/^dep:quick:(.+)$/, (ctx) => userHandlers.wallet.handleQuickDeposit(ctx, ctx.match[1]));
bot.action(/^dep:net:(trc20|erc20):(.+)$/, (ctx) =>
  userHandlers.wallet.handleNetAmount(ctx, ctx.match[1], ctx.match[2])
);
bot.action(/^wd:(.+)/, (ctx) => {
  userHandlers.withdraw.startWithdraw(ctx, ctx.match[1]);
});
bot.action('resp:timeout24', (ctx) => userHandlers.responsible.setTimeout(ctx, 24));
bot.action('resp:exclude7', (ctx) => userHandlers.responsible.setTimeout(ctx, 24 * 7));
bot.action('resp:daily', (ctx) => userHandlers.responsible.promptLimit(ctx, 'daily'));
bot.action('resp:session', (ctx) => userHandlers.responsible.promptLimit(ctx, 'session'));
bot.action('ux:live', async (ctx) => { await ctx.answerCbQuery().catch(()=>{}); return userHandlers.live(ctx); });
bot.action('channel:check', async (ctx) => channelMembership.handleCheckCallback(ctx, { telegram: ctx.telegram }));
bot.action('channel:later', async (ctx) => channelMembership.handleLaterCallback(ctx));

bot.action('ux:contest', async (ctx) => { await ctx.answerCbQuery().catch(() => {}); return userHandlers.contest.showDaily(ctx); });
bot.action('ux:battle', async (ctx) => { await ctx.answerCbQuery().catch(()=>{}); return userHandlers.battle(ctx); });
bot.action('ux:wager', async (ctx) => { await ctx.answerCbQuery().catch(()=>{}); return userHandlers.wager(ctx); });
bot.action('ux:activity', async (ctx) => { await ctx.answerCbQuery().catch(()=>{}); return userHandlers.activity(ctx); });
bot.action('ux:referral', async (ctx) => { await ctx.answerCbQuery().catch(()=>{}); return userHandlers.referral(ctx); });
bot.action('ux:wallet', async (ctx) => {
  try { await ctx.answerCbQuery(); } catch (_) {}
  return userHandlers.wallet.showWallet(ctx);
});
bot.action('menu:main', async (ctx) => {
  await ctx.answerCbQuery();
  if (adminHandlers.isAdmin(ctx)) {
    return adminHandlers.showPanel(ctx);
  }
  await ctx.reply('Main menu', mainMenu());
});

// ─── Admin callbacks ───
bot.on('callback_query', async (ctx, next) => {
  if (await adminHandlers.handleAdminCallback(ctx, bot)) return;
  return next();
});

// ─── Text fallback ───
bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;

  if (await adminHandlers.handleAdminText(ctx, bot)) return;
  if (await userHandlers.start.handleOnboardingText(ctx)) return;
  if (await userHandlers.deposit.handleDepositText(ctx)) return;
  if (await userHandlers.withdraw.handleWithdrawText(ctx, bot)) return;
  if (await userHandlers.support.handleSupportText(ctx)) return;

  if (ctx.session?.pendingLimit) {
    if (adminHandlers.isAdmin(ctx)) {
      delete ctx.session.pendingLimit;
      return ctx.reply('Admins cannot set player limits on their own account.', adminKb.main());
    }
    const type = ctx.session.pendingLimit;
    const val = parseFloat(ctx.message.text);
    delete ctx.session.pendingLimit;
    if (isNaN(val) || val < 1) {
      return ctx.reply('Invalid number. Try again from Responsible menu.');
    }
    const user = await require('./services/userService').getUser(ctx.from.id);
    const daily = type === 'daily' ? val : user.daily_limit_usd;
    const sessionLim = type === 'session' ? val : user.session_limit_usd;
    await require('./services/userService').setLimits(ctx.from.id, daily, sessionLim);
    return ctx.reply(`✅ ${type} limit set to $${val.toFixed(2)}`, mainMenu());
  }
});

bot.catch((err, ctx) => {
  logger.error('Bot error', err);
  ctx.reply('Something went wrong. Please try again.').catch(() => {});
});

async function launch() {
  setBot(bot);
  startJobs();
  if (config.webhookUrl) {
    const express = require('express');
    const app = express();
    app.use(express.json());
    // Internal CMS hook to trigger broadcast send (same process)
    app.post('/internal/broadcast/:id', async (req, res) => {
      const secret = req.headers['x-cms-secret'];
      if (secret !== config.cmsSecret) return res.status(401).json({ error: 'unauthorized' });
      try {
        const result = await require('./services/broadcastService').sendBroadcast(bot, req.params.id);
        res.json(result || { ok: true });
      } catch (e) {
        res.status(500).json({ error: e.message });
      }
    });
    app.use(bot.webhookCallback(`/bot${config.botToken}`));
    await bot.telegram.setWebhook(`${config.webhookUrl}/bot${config.botToken}`);
    app.listen(config.port, () => logger.info(`Webhook + internal API on :${config.port}`));
  } else {
    await bot.launch();
    logger.info('Bot started (polling)');
  }
}

// Export bot for potential programmatic use
module.exports = { bot };

launch().catch((e) => {
  logger.error('Failed to start', e);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
