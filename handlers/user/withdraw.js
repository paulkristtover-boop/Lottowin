const financeService = require('../../services/financeService');
const userService = require('../../services/userService');
const cryptoPayment = require('../../services/cryptoPaymentService');
const config = require('../../config');
const { mainMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');
const { Markup } = require('telegraf');
const wagerService = require('../../services/wagerService');

/** @type {Map<number, {step:string, network?:string, address?:string}>} */
const pendingWithdraw = new Map();

function withdrawMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('USDT TRC-20 (Tron)', 'wd:trc20')],
    [Markup.button.callback('USDT ERC-20 (Ethereum)', 'wd:erc20')],
    [Markup.button.callback('« Back', 'menu:main')],
  ]);
}

function feeLineForNetwork(network) {
  const chain = network === 'erc20' ? 'usdt_erc20' : 'usdt_trc20';
  const fee = financeService.getWithdrawFeeUsd(chain);
  const label = network === 'erc20' ? 'ERC-20' : 'TRC-20';
  return `Network fee (${label}): *${formatUsd(fee)}* (covers ~2× chain cost)`;
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

  const feeTrc = financeService.getWithdrawFeeUsd('usdt_trc20');
  const feeErc = financeService.getWithdrawFeeUsd('usdt_erc20');

  await ctx.replyWithMarkdown(
    `📤 *Cash out USDT*\n\n` +
      `Available *${formatUsd(bal)}* · min *${formatUsd(config.minWithdrawUsd)}*\n` +
      `Play-through *${config.playthroughPercent || 100}%* of deposits\n\n` +
      `*Fixed network fees* (not % of amount):\n` +
      `• TRC-20: *${formatUsd(feeTrc)}*\n` +
      `• ERC-20: *${formatUsd(feeErc)}*\n\n` +
      `You receive a unique exact amount. Fee is held with the payout.\n\n` +
      `Choose network (manual payout after review):`,
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
    `Send your *destination wallet address* (${hint}).\n\n` +
      `${feeLineForNetwork(n)}\n\nOr /cancel`
  );
}

/**
 * After DB insert, notify all admin IDs with structured payout request.
 */
async function notifyAdmins(bot, payload) {
  const exactStr = Number(payload.exactAmount).toFixed(6);
  const text =
    `🚨 *WITHDRAWAL REQUEST*\n\n` +
    `Ref: \`${payload.ref}\`\n` +
    `User ID: \`${payload.userId}\`\n` +
    `Username: @${payload.username || '—'}\n\n` +
    `*SEND EXACTLY:*\n\`${exactStr}\` USDT\n\n` +
    `Fee held: *${formatUsd(payload.feeUsd)}*\n` +
    `Total debited from user: *${formatUsd(payload.totalDebit)}*\n` +
    `Network: *${payload.networkLabel}*\n` +
    `Address:\n\`${payload.address}\`\n\n` +
    `After on-chain send:\n` +
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
      const chainKey = state.network === 'erc20' ? 'usdt_erc20' : 'usdt_trc20';
      const fee = financeService.getWithdrawFeeUsd(chainKey);
      await ctx.replyWithMarkdown(
        `Address saved.\n` +
          `Enter *USD amount* you want to receive (min ${formatUsd(config.minWithdrawUsd)}).\n\n` +
          `Network fee *${formatUsd(fee)}* will be added on top and held from your balance.\n` +
          `You will get a unique exact payout amount for verification.\n\nOr /cancel`
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
      await wagerService.assertCanWithdraw(ctx.from.id);
      const chainKey = state.network === 'erc20' ? 'usdt_erc20' : 'usdt_trc20';
      const w = await financeService.createWithdrawal(
        ctx.from.id,
        chainKey,
        state.address,
        amount
      );

      const user = await userService.getUser(ctx.from.id);
      const networkLabel = state.network === 'erc20' ? 'USDT ERC-20' : 'USDT TRC-20';
      const exact = Number(w.exact_amount ?? w.amount_usd);
      const fee = Number(w.fee_usd);
      const totalDebit = Number(w.total_debit ?? exact + fee);

      if (bot) {
        await notifyAdmins(bot, {
          ref: w.id,
          userId: ctx.from.id,
          username: user?.username || ctx.from.username,
          exactAmount: exact,
          feeUsd: fee,
          totalDebit,
          networkLabel,
          address: state.address,
        });
      }

      await ctx.replyWithMarkdown(
        `✅ *Withdrawal requested*\n\n` +
          `*You will receive (exact):*\n\`${exact.toFixed(6)}\` USDT\n\n` +
          `Network fee: *${formatUsd(fee)}*\n` +
          `Total held from balance: *${formatUsd(totalDebit)}*\n\n` +
          `Network: ${networkLabel}\n` +
          `Address: \`${state.address}\`\n` +
          `Ref: \`${w.id}\`\n\n` +
          `Status: *pending manual review*.\n` +
          `Funds are held. You will be notified when paid or if rejected.`,
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
