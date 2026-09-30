const config = require('../../config');
const cryptoPayment = require('../../services/cryptoPaymentService');
const { mainMenu } = require('../../utils/ui');
const { Markup } = require('telegraf');
const { formatUsd } = require('../../utils/helpers');

/** @type {Map<number, {step:string, network?:string}>} */
const depositFlow = new Map();

function depositMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('USDT TRC-20 (Tron)', 'dep:trc20')],
    [Markup.button.callback('USDT ERC-20 (Ethereum)', 'dep:erc20')],
    [Markup.button.callback('📋 My pending deposit', 'dep:status')],
    [Markup.button.callback('« Back', 'menu:main')],
  ]);
}

async function showDeposit(ctx) {
  depositFlow.delete(ctx.from.id);
  const text =
    `📥 *Deposit USDT*\n\n` +
    `Supported networks:\n` +
    `• *TRC-20* (Tron) — lower fees\n` +
    `• *ERC-20* (Ethereum)\n\n` +
    `Min deposit: ${formatUsd(config.minDepositUsd)}\n\n` +
    `You will receive a *unique exact amount* to send.\n` +
    `The bot detects payment automatically — no TX hash needed.`;

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
  depositFlow.set(ctx.from.id, { step: 'amount', network });
  try {
    await ctx.answerCbQuery();
  } catch (_) {}
  await ctx.replyWithMarkdown(
    `Enter the *USD amount* you want to deposit (e.g. \`10\` or \`25.5\`).\n\n` +
      `Min: ${formatUsd(config.minDepositUsd)}\n\nOr /cancel`
  );
}

async function showStatus(ctx) {
  try {
    await ctx.answerCbQuery();
  } catch (_) {}
  const p = cryptoPayment.getPendingForUser(ctx.from.id);
  if (!p) {
    return ctx.reply('No active pending deposit. Start one from Deposit menu.', depositMenu());
  }
  const left = Math.max(0, Math.ceil((p.expiresAt - Date.now()) / 60000));
  const master = cryptoPayment.getMasterAddress(p.network);
  const netLabel = p.network === 'erc20' ? 'ERC-20' : 'TRC-20';
  const msg =
    `📋 *Pending deposit*\n\n` +
    `Network: *USDT ${netLabel}*\n` +
    `Send exactly:\n\`${p.exactAmount.toFixed(6)}\` USDT\n\n` +
    `To:\n\`${master}\`\n\n` +
    `Expires in ~${left} min\n` +
    `⚠️ Exact amount required or it will not credit.`;
  await ctx.replyWithMarkdown(msg, depositMenu());
}

/**
 * Handle amount text. Returns true if consumed.
 */
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
    const pending = cryptoPayment.createPendingDeposit(ctx.from.id, state.network, base);
    depositFlow.delete(ctx.from.id);

    const netHuman = pending.network === 'erc20' ? 'ERC-20 (Ethereum)' : 'TRC-20 (Tron)';
    const exact = pending.exactAmount.toFixed(6);
    const addr = pending.masterAddress;
    const mins = Math.floor(cryptoPayment.DEPOSIT_TTL_MS / 60000);

    const msg =
      `📥 *Deposit USDT ${netHuman}*\n\n` +
      `Send *exactly* this amount (USDT):\n` +
      `\`${exact}\`\n\n` +
      `To this address:\n` +
      `\`${addr}\`\n\n` +
      `⏱ Valid for *${mins} minutes*\n\n` +
      `⚠️ *CRITICAL:* You must send the *exact* amount including all decimals.\n` +
      `If you send a different amount, the deposit *will not* be credited automatically.\n\n` +
      `Base credit on success: *${formatUsd(pending.baseAmount)}*\n` +
      `Network fees are paid by you.`;

    await ctx.replyWithMarkdown(msg, mainMenu());
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
};
