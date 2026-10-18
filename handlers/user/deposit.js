const config = require('../../config');
const cryptoPayment = require('../../services/cryptoPaymentService');
const { mainMenu, depositMenu } = require('../../utils/ui');
const { Markup } = require('telegraf');
const { formatUsd } = require('../../utils/helpers');

const depositFlow = new Map();

function pendingText(p) {
  const left = Math.max(0, p.expiresAt - Date.now());
  const min = Math.ceil(left / 60000);
  const sym = p.symbol || cryptoPayment.assetSymbol(p.network);
  return (
    `⏱ *Pending deposit* (~${min} min left)\n\n` +
    `Network: *${cryptoPayment.networkLabel(p.network)}*\n` +
    `Send *exactly* this amount:\n\`${p.exactAmount}\` *${sym}*\n\n` +
    `To:\n\`${p.masterAddress}\`\n\n` +
    `You get *${formatUsd(p.baseAmount)}* after confirm.\n` +
    `⚠️ Wrong amount = no auto-credit.`
  );
}

function pendingKb() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔄 Refresh', 'dep:status')],
    [Markup.button.callback('« Main', 'menu:main')],
  ]);
}

async function showDeposit(ctx) {
  depositFlow.delete(ctx.from.id);
  const p = await cryptoPayment.getPendingForUser(ctx.from.id);
  let text =
    `📥 *Deposit*\n\n` +
    `We accept:\n` +
    `• *TRX* (Tron)\n` +
    `• *ETH* (Ethereum)\n\n` +
    `Min *${formatUsd(config.minDepositUsd)}*\n` +
    `1. Pick network\n` +
    `2. Enter USD amount (e.g. 5)\n` +
    `3. Send the *exact* crypto shown\n` +
    `4. Auto-credit when confirmed`;

  if (p) text += `\n\n` + pendingText(p);
  await ctx.replyWithMarkdown(text, p ? pendingKb() : depositMenu());
}

async function startNetwork(ctx, network) {
  const master = cryptoPayment.getMasterAddress(network);
  if (!master) {
    try {
      await ctx.answerCbQuery('Not configured');
    } catch (_) {}
    return ctx.reply(`${cryptoPayment.networkLabel(network)} address not set.`, mainMenu());
  }
  depositFlow.set(ctx.from.id, { step: 'amount', network: cryptoPayment.normalizeNetwork(network) });
  try {
    await ctx.answerCbQuery();
  } catch (_) {}
  await ctx.replyWithMarkdown(
    `*${cryptoPayment.networkLabel(network)}*\n\n` +
      `Enter *USD* amount to credit (e.g. \`5\` or \`10\`)\n` +
      `Min: ${formatUsd(config.minDepositUsd)}\n\n` +
      `Or /cancel`
  );
}

async function showStatus(ctx) {
  try {
    await ctx.answerCbQuery();
  } catch (_) {}
  const p = await cryptoPayment.getPendingForUser(ctx.from.id);
  if (!p) return ctx.reply('No pending deposit.', depositMenu());
  await ctx.replyWithMarkdown(pendingText(p), pendingKb());
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

  const amount = parseFloat(text.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) {
    await ctx.reply('Enter a valid number, e.g. 5');
    return true;
  }

  try {
    const pending = await cryptoPayment.createPendingDeposit(ctx.from.id, state.network, amount);
    depositFlow.delete(ctx.from.id);
    await ctx.replyWithMarkdown(pendingText(pending), pendingKb());
  } catch (e) {
    await ctx.reply(`❌ ${e.message}`, mainMenu());
  }
  return true;
}

function registerActions(bot) {
  bot.action('dep:trx', (ctx) => startNetwork(ctx, 'trx'));
  bot.action('dep:eth', (ctx) => startNetwork(ctx, 'eth'));
  bot.action('dep:status', (ctx) => showStatus(ctx));
}

module.exports = {
  showDeposit,
  startNetwork,
  showStatus,
  handleDepositText,
  depositFlow,
  registerActions,
};
