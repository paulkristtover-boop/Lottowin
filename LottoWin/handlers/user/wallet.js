const userService = require('../../services/userService');
const ticketCreditService = require('../../services/ticketCreditService');
const config = require('../../config');
const { formatUsd } = require('../../utils/helpers');
const { Markup } = require('telegraf');
const cryptoPayment = require('../../services/cryptoPaymentService');

function walletKeyboard(user) {
  const min = Number(config.minDepositUsd);
  const play = Number(config.playCostUsd);
  const locked = Number(user.locked_tickets) || 0;
  const firstDone = !!user.is_first_deposit_completed;
  const linesPerDollar = play > 0 ? Math.floor(1 / play) : 0;

  const rows = [];
  if (!firstDone && locked > 0) {
    rows.push([
      Markup.button.callback(
        `💳 Deposit $${min.toFixed(2)} → Unlock ${locked} free tickets`,
        `dep:quick:${min}`
      ),
    ]);
  }
  rows.push([
    Markup.button.callback(
      `💳 $1 (~${linesPerDollar.toLocaleString()} lines${
        !firstDone && locked ? ` + ${locked} free` : ''
      })`,
      'dep:quick:1'
    ),
  ]);
  rows.push([
    Markup.button.callback('💳 $5', 'dep:quick:5'),
    Markup.button.callback('💳 $10', 'dep:quick:10'),
  ]);
  rows.push([
    Markup.button.callback('TRC-20 USDT', 'dep:trc20'),
    Markup.button.callback('ERC-20 USDT', 'dep:erc20'),
  ]);
  rows.push([Markup.button.callback('« Main menu', 'menu:main')]);
  return Markup.inlineKeyboard(rows);
}

async function showWallet(ctx) {
  try {
    const user = await userService.getUser(ctx.from.id);
    if (!user) return ctx.reply('Please /start first');

    const locked = Number(user.locked_tickets) || 0;
    const unlocked = Number(user.unlocked_tickets) || 0;
    const welcome = Number(config.welcomeFreeTickets) || 5;
    const firstDone = !!user.is_first_deposit_completed;

    let progress = '';
    if (!firstDone && user.welcome_tickets_granted) {
      const bar = ticketCreditService.progressBar(0, 1, 10);
      progress =
        `\n🎫 *Free Welcome Tickets*\n` +
        `${bar} 0/1 deposit\n` +
        `Deposit ≥ ${formatUsd(config.minDepositUsd)} to unlock *${locked || welcome}* free tickets.\n`;
    } else if (firstDone) {
      progress =
        `\n🎫 Free tickets unlocked: *${unlocked}*\n` +
        (locked > 0 ? `Still locked: ${locked}\n` : '');
    } else {
      progress = `\nComplete age & CAPTCHA verification to receive locked welcome tickets.\n`;
    }

    const text =
      `👛 *Wallet*\n\n` +
      `💰 Cash: *${formatUsd(user.balance_usd)}*\n` +
      `Unlocked free tickets: *${unlocked}*\n` +
      `Locked free tickets: *${locked}*\n` +
      progress +
      `\nStake: ${formatUsd(config.playCostUsd)} / line\n` +
      `Min deposit: ${formatUsd(config.minDepositUsd)} · Min withdraw: ${formatUsd(config.minWithdrawUsd)}\n\n` +
      `_Free tickets are used first. Only real cash is withdrawable._`;

    await ctx.replyWithMarkdown(text, walletKeyboard(user));
  } catch (e) {
    console.error('wallet', e);
    await ctx.reply('❌ Wallet error: ' + (e.message || 'try again. Run DB migrate if columns missing.'));
  }
}

async function handleQuickDeposit(ctx, amount) {
  const amt = parseFloat(amount);
  if (!Number.isFinite(amt) || amt < config.minDepositUsd) {
    try {
      await ctx.answerCbQuery('Invalid amount');
    } catch (_) {}
    return;
  }
  try {
    await ctx.answerCbQuery();
  } catch (_) {}
  await ctx.replyWithMarkdown(
    `Deposit *${formatUsd(amt)}*\n\nChoose network:`,
    Markup.inlineKeyboard([
      [Markup.button.callback('USDT TRC-20 (Tron)', `dep:net:trc20:${amt}`)],
      [Markup.button.callback('USDT ERC-20 (Ethereum)', `dep:net:erc20:${amt}`)],
      [Markup.button.callback('Cancel', 'menu:main')],
    ])
  );
}

async function handleNetAmount(ctx, network, amount) {
  const amt = parseFloat(amount);
  try {
    await ctx.answerCbQuery();
  } catch (_) {}
  try {
    const pending = await cryptoPayment.createPendingDeposit(ctx.from.id, network, amt);
    const netHuman = pending.network === 'erc20' ? 'ERC-20 (Ethereum)' : 'TRC-20 (Tron)';
    const exact = pending.exactAmount.toFixed(6);
    const user = await userService.getUser(ctx.from.id);
    const locked = Number(user?.locked_tickets) || 0;
    const unlockNote =
      !user?.is_first_deposit_completed && locked > 0
        ? `\n\n🎫 After confirm, *${locked} free tickets* unlock automatically.`
        : '';

    const msg =
      `📥 *Deposit USDT ${netHuman}*\n\n` +
      `Send *exactly*:\n\`${exact}\` USDT\n\n` +
      `To:\n\`${pending.masterAddress}\`\n\n` +
      `⏱ Valid 15 minutes\n` +
      `⚠️ Exact amount required.${unlockNote}`;

    await ctx.replyWithMarkdown(msg);
    const reminder = require('./deposit').pendingReminderText(pending);
    if (reminder) {
      await ctx.replyWithMarkdown(reminder + '\n\n_Save this until the deposit confirms._', require('../../utils/ui').mainMenu());
    }
  } catch (e) {
    await ctx.reply(`❌ ${e.message}`);
  }
}

module.exports = {
  showWallet,
  handleQuickDeposit,
  handleNetAmount,
  walletKeyboard,
};
