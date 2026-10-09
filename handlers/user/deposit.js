const config = require('../../config');
const cryptoPayment = require('../../services/cryptoPaymentService');
const { mainMenu, depositMenu } = require('../../utils/ui');
const { Markup } = require('telegraf');
const { formatUsd } = require('../../utils/helpers');

const depositFlow = new Map();

function netHuman(network) {
  const n = cryptoPayment.normalizeNetwork(network);
  if (n === 'erc20') return 'ERC-20 (Ethereum)';
  if (n === 'sol') return 'Solana (SPL)';
  return 'TRC-20 (Tron)';
}

function pendingReminderText(pending) {
  if (!pending) return null;
  const leftMs = Math.max(0, pending.expiresAt - Date.now());
  const leftMin = Math.ceil(leftMs / 60000);
  const master = cryptoPayment.getMasterAddress(pending.network);
  return (
    `⏱ *Pending deposit* (~${leftMin} min left)\n\n` +
    `Network: *${cryptoPayment.networkLabel(pending.network)}*\n` +
    `Send *exactly*:\n\`${Number(pending.exactAmount).toFixed(6)}\` USDT\n\n` +
    `To:\n\`${master}\`\n\n` +
    `⚠️ Wrong amount = no auto-credit.`
  );
}

function pendingActions() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📋 Refresh pending', 'dep:status')],
    [Markup.button.callback('👛 Wallet', 'ux:wallet')],
    [Markup.button.callback('« Main menu', 'menu:main')],
  ]);
}

async function showDeposit(ctx) {
  depositFlow.delete(ctx.from.id);
  const pending = await cryptoPayment.getPendingForUser(ctx.from.id);
  let text =
    `📥 *Fuel your balance*\n\n` +
    `Send *USDT* on:\n` +
    `• *TRC-20* (Tron) — usually cheaper gas\n` +
    `• *ERC-20* (Ethereum)\n` +
    `• *Solana* (SPL) — fast & low fee\n\n` +
    `Minimum *${formatUsd(config.minDepositUsd)}* · first deposit unlocks *${config.welcomeFreeTickets}* free tickets\n\n` +
    `You'll get a *unique exact amount* — send that amount only. We detect it automatically.`;

  if (pending) {
    text += `\n\n` + pendingReminderText(pending);
  }

  await ctx.replyWithMarkdown(text, depositMenu());
}

async function startNetwork(ctx, network) {
  const master = cryptoPayment.getMasterAddress(network);
  if (!master) {
    try {
      await ctx.answerCbQuery('Network not configured');
    } catch (_) {}
    return ctx.reply('This network is temporarily unavailable.', mainMenu());
  }
  depositFlow.set(ctx.from.id, { step: 'amount', network: cryptoPayment.normalizeNetwork(network) });
  try {
    await ctx.answerCbQuery();
  } catch (_) {}
  await ctx.replyWithMarkdown(
    `Enter the *USD amount* to deposit (e.g. \`10\` or \`25.5\`).\n\n` +
      `Network: *${netHuman(network)}*\n` +
      `Min: ${formatUsd(config.minDepositUsd)}\n\nOr /cancel`
  );
}

async function showStatus(ctx) {
  try {
    await ctx.answerCbQuery();
  } catch (_) {}
  const p = await cryptoPayment.getPendingForUser(ctx.from.id);
  if (!p) {
    return ctx.reply('No active pending deposit.', depositMenu());
  }
  await ctx.replyWithMarkdown(pendingReminderText(p), pendingActions());
}

async function handleDepositText(ctx) {
  const state = depositFlow.get(ctx.from.id);
  if (!state || state.step !== 'amount') return false;

  const text = (ctx.message.text || '').trim();
  if (text === '/cancel') {
    depositFlow.delete(ctx.from.id);
    await ctx.reply('Cancelled.', mainMenu());
    return true;
  }

  const base = parseFloat(text.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(base) || base <= 0) {
    await ctx.reply('Invalid amount. Enter a number like 10 or 25.5');
    return true;
  }
  if (base < config.minDepositUsd) {
    await ctx.reply(`Minimum deposit is ${formatUsd(config.minDepositUsd)}`);
    return true;
  }

  try {
    const pending = await cryptoPayment.createPendingDeposit(ctx.from.id, state.network, base);
    depositFlow.delete(ctx.from.id);

    const exact = pending.exactAmount.toFixed(6);
    const mins = Math.floor(cryptoPayment.DEPOSIT_TTL_MS / 60000);

    const msg =
      `📥 *Deposit ${cryptoPayment.networkLabel(pending.network)}*\n\n` +
      `Send *exactly* this amount (USDT):\n` +
      `\`${exact}\`\n\n` +
      `To this address:\n` +
      `\`${pending.masterAddress}\`\n\n` +
      `⏱ Valid for *${mins} minutes*\n\n` +
      `⚠️ *CRITICAL:* Exact amount required including decimals.\n` +
      `Base credit on success: *${formatUsd(pending.baseAmount)}*\n` +
      `Network fees are paid by you.`;

    await ctx.replyWithMarkdown(msg, pendingActions());
    await ctx.replyWithMarkdown(
      pendingReminderText(pending) + `\n\n_Save this message until the deposit confirms._`,
      mainMenu()
    );
  } catch (e) {
    depositFlow.delete(ctx.from.id);
    await ctx.reply(`❌ ${e.message}`, mainMenu());
  }
  return true;
}

module.exports = {
  showDeposit,
  startNetwork,
  showStatus,
  handleDepositText,
  depositMenu,
  depositFlow,
  pendingReminderText,
};
