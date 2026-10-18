require('dotenv').config();
const { Telegraf, session } = require('telegraf');
const config = require('./config');
const userHandlers = require('./handlers/user');
const banCheck = require('./middleware/banCheck');
const privateOnly = require('./middleware/privateOnly');
const rateLimit = require('./middleware/rateLimit');
const maintenance = require('./middleware/maintenance');
const { startJobs, setBot } = require('./jobs');
const { mainMenu, moreMenu } = require('./utils/ui');
const express = require('express');

if (!config.botToken) {
  console.error('BOT_TOKEN missing');
  process.exit(1);
}

const bot = new Telegraf(config.botToken);

bot.use(session());
bot.use(privateOnly);
bot.use(rateLimit(40, 60000));
bot.use(banCheck);
bot.use(maintenance);

bot.start((ctx) => userHandlers.start(ctx));

bot.command('pot', (ctx) => userHandlers.jackpot.showStatus(ctx));
bot.command('buy', (ctx) => userHandlers.jackpot.showBuy(ctx));
bot.command('wallet', (ctx) => userHandlers.wallet.showWallet(ctx));
bot.command('deposit', (ctx) => userHandlers.deposit.showDeposit(ctx));
bot.command('withdraw', (ctx) => userHandlers.withdraw.showWithdraw(ctx));
bot.command('balance', (ctx) => userHandlers.balance(ctx));
bot.command('help', (ctx) => userHandlers.jackpot.howTo(ctx));

bot.hears('🎰 Buy lines', (ctx) => userHandlers.jackpot.showBuy(ctx));
bot.hears('💰 Pot & draw', (ctx) => userHandlers.jackpot.showStatus(ctx));
bot.hears('👛 Wallet', (ctx) => userHandlers.wallet.showWallet(ctx));
bot.hears('📥 Deposit', (ctx) => userHandlers.deposit.showDeposit(ctx));
bot.hears('📋 More', (ctx) => ctx.reply('More options:', moreMenu()));
bot.hears('« Main menu', (ctx) => ctx.reply('Main menu', mainMenu()));
bot.hears('💰 Balance', (ctx) => userHandlers.balance(ctx));
bot.hears('📤 Withdraw', (ctx) => userHandlers.withdraw.showWithdraw(ctx));
bot.hears('🎫 My lines', (ctx) => userHandlers.jackpot.myLines(ctx));
bot.hears('📊 Results', (ctx) => userHandlers.jackpot.results(ctx));
bot.hears('ℹ️ How to play', (ctx) => userHandlers.jackpot.howTo(ctx));
bot.hears('🆘 Support', (ctx) => userHandlers.support.showSupport(ctx));

bot.action('jp:status', (ctx) => userHandlers.jackpot.showStatus(ctx));
bot.action('jp:qp:1', (ctx) => userHandlers.jackpot.quickPick(ctx, 1));
bot.action('jp:qp:3', (ctx) => userHandlers.jackpot.quickPick(ctx, 3));
bot.action('jp:manual', (ctx) => userHandlers.jackpot.startManual(ctx));
bot.action('menu:main', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await ctx.reply('Main menu', mainMenu());
});

bot.on('text', async (ctx, next) => {
  if (await userHandlers.deposit.handleDepositText(ctx)) return;
  if (await userHandlers.withdraw.handleWithdrawText(ctx)) return;
  if (await userHandlers.jackpot.handleManualText(ctx)) return;
  if (userHandlers.start.handleOnboardingText && (await userHandlers.start.handleOnboardingText(ctx))) return;
  return next();
});

userHandlers.deposit.registerActions?.(bot);
userHandlers.withdraw.registerActions?.(bot);

bot.catch((err) => console.error('Bot error', err));

setBot(bot);
startJobs();

async function launch() {
  if (config.webhookUrl) {
    const app = express();
    app.use(express.json());
    app.get('/', (_, res) => res.send('LottoWin Daily Jackpot'));
    const path = `/telegraf/${bot.secretPathComponent()}`;
    app.use(bot.webhookCallback(path));
    await bot.telegram.setWebhook(`${config.webhookUrl.replace(/\/$/, '')}${path}`);
    app.listen(config.port, () => console.log('Webhook on', config.port));
  } else {
    await bot.launch();
    console.log('Daily Jackpot bot polling');
  }
}

launch().catch((e) => {
  console.error(e);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
