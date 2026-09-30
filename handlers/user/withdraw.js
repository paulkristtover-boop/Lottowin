const financeService = require('../../services/financeService');
const userService = require('../../services/userService');
const cryptoPayment = require('../../services/cryptoPaymentService');
const config = require('../../config');
const { mainMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');
const { Markup } = require('telegraf');
const { v4: uuidv4 } = require('uuid');

/** @type {Map<number, {step:string, network?:string, address?:string}>} */
const pendingWithdraw = new Map();

function withdrawMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('USDT TRC-20 (Tron)', 'wd:trc20')],
    [Markup.button.callback('USDT ERC-20 (Ethereum)', 'wd:erc20')],
    [Markup.button.callback('« Back', 'menu:main')],
  ]);
}

async function showWithdraw(ctx) {
  pendingWithdraw.delete(ctx.from.id);
  const user = await userService.getUser(ctx.from.id);
  if (!user) return ctx.reply('Please /start first');

  const bal = Number(user.balance_usd);
  if (bal < config.minWithdrawUsd) {
    return ctx.replyWithMarkdown(
      `📤 *Withdraw*\n\nAvailable: *${formatUsd(bal)}*\nMinimum: *${formatUsd(config.minWithdrawUsd)}*\n\nInsufficient balance to withdraw.`,
      mainMenu()
    );
  }

  await ctx.replyWithMarkdown(
    `📤 *Withdraw USDT*\n\nAvailable: *${formatUsd(bal)}*\nMinimum: *${formatUsd(config.minWithdrawUsd)}*\n\nChoose network:`,
    withdrawMenu()
  );
}

async function startWithdraw(ctx, network) {
  const n = cryptoPayment.normalizeNetwork(network);
  pendingWithdraw.set(ctx.from.id, { step: 'address', network: n });
  await ctx.answerCbQuery?.().catch?.(() => {});
  const hint =
    n === 'erc20'
      ? 'EVM address starting with `0x`…'
      : 'Tron address starting with `T`…';
  await ctx.replyWithMarkdown(
    `Send your *destination wallet address* (${hint}).\n\nOr /cancel`
  );
}

/**
 * After DB insert, notify all admin IDs with structured payout request.
 */
async function notifyAdmins(bot, payload) {
  const text =
    `🚨 *WITHDRAWAL REQUEST*\n\n` +
    `Ref: \`${payload.ref}\`\n` +
    `User ID: \`${payload.userId}\`\n` +
    `Username: @${payload.username || '—'}\n` +
    `Amount: *${formatUsd(payload.amount)}*\n` +
    `Network: *${payload.networkLabel}*\n` +
    `Address:\n\`${payload.address}\`\n\n` +
    `Approve after on-chain send:\n` +
    `/approve ${payload.ref} <txhash>\n` +
    `Or reject:\n/reject ${payload.ref} reason`;

  for (const adminId of config.adminIds) {
    try {
      await bot.telegram.sendMessage(adminId, text, { parse_mode: 'Markdown' });
    } catch {
      /* admin may not have started bot */
    }
  }
}

async function handleWithdrawText(ctx, bot) {
  const state = pendingWithdraw.get(ctx.from.id);
  if (!state) return false;

  const text = (ctx.message.text || '').trim();
  if (text === '/cancel') {
    pendingWithdraw.delete(ctx.from.id);
    await ctx.reply('Cancelled.', mainMenu());
    return true;
  }

  if (state.step === 'address') {
    try {
      const addr = cryptoPayment.validateWithdrawAddress(state.network, text);
      state.address = addr;
      state.step = 'amount';
      pendingWithdraw.set(ctx.from.id, state);
      await ctx.replyWithMarkdown(
        `Address saved.\nEnter *USD amount* to withdraw (min ${formatUsd(config.minWithdrawUsd)}).\n\nOr /cancel`
      );
    } catch (e) {
      await ctx.reply(`❌ ${e.message}\nTry again or /cancel`);
    }
    return true;
  }

  if (state.step === 'amount') {
    const amount = parseFloat(text.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      await ctx.reply('Invalid amount. Enter a number.');
      return true;
    }
    pendingWithdraw.delete(ctx.from.id);

    try {
      const chainKey = state.network === 'erc20' ? 'usdt_erc20' : 'usdt_trc20';
      const w = await financeService.createWithdrawal(
        ctx.from.id,
        chainKey,
        state.address,
        amount
      );

      const user = await userService.getUser(ctx.from.id);
      const networkLabel = state.network === 'erc20' ? 'USDT ERC-20' : 'USDT TRC-20';

      // Notify owner(s) for manual payout
      if (bot) {
        await notifyAdmins(bot, {
          ref: w.id,
          userId: ctx.from.id,
          username: user?.username || ctx.from.username,
          amount,
          networkLabel,
          address: state.address,
        });
      }

      await ctx.replyWithMarkdown(
        `✅ *Withdrawal requested*\n\n` +
          `Amount: *${formatUsd(amount)}*\n` +
          `Network: ${networkLabel}\n` +
          `Address: \`${state.address}\`\n` +
          `Ref: \`${w.id}\`\n\n` +
          `Status: *pending manual review*.\n` +
          `Funds are held from your balance. You will be notified when paid.`,
        mainMenu()
      );
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`, mainMenu());
    }
    return true;
  }

  return false;
}

module.exports = {
  showWithdraw,
  startWithdraw,
  handleWithdrawText,
  pendingWithdraw,
  withdrawMenu,
  notifyAdmins,
};
