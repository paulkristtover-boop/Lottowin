const config = require('../../config');
const cryptoPayment = require('../../services/cryptoPaymentService');
const userService = require('../../services/userService');
const { mainMenu, withdrawMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');
const { query } = require('../../database');
const { v4: uuidv4 } = require('uuid');

const pendingWithdraw = new Map();

async function showWithdraw(ctx) {
  pendingWithdraw.delete(ctx.from.id);
  const u = await userService.getUser(ctx.from.id);
  const bal = Number(u?.balance_usd) || 0;
  const feeTrx = cryptoPayment.getWithdrawFeeUsd('trx');
  const feeEth = cryptoPayment.getWithdrawFeeUsd('eth');
  await ctx.replyWithMarkdown(
    `📤 *Withdraw*\n\n` +
      `Balance: *${formatUsd(bal)}*\n` +
      `Min withdraw: *${formatUsd(config.minWithdrawUsd)}*\n\n` +
      `Payout in *TRX* or *ETH* (manual after review).\n` +
      `Fees:\n` +
      `• TRX: *${formatUsd(feeTrx)}*\n` +
      `• ETH: *${formatUsd(feeEth)}*\n\n` +
      `Choose network:`,
    withdrawMenu()
  );
}

async function startWithdraw(ctx, network) {
  const n = cryptoPayment.normalizeNetwork(network);
  pendingWithdraw.set(ctx.from.id, { step: 'address', network: n });
  try {
    await ctx.answerCbQuery();
  } catch (_) {}
  const hint = n === 'eth' ? 'Your ETH address (0x…)' : 'Your TRX address (T…)';
  await ctx.replyWithMarkdown(
    `*${cryptoPayment.networkLabel(n)}*\n\nSend ${hint}\n\nOr /cancel`
  );
}

async function handleWithdrawText(ctx) {
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
      const fee = cryptoPayment.getWithdrawFeeUsd(state.network);
      await ctx.replyWithMarkdown(
        `Address saved.\n\nEnter *USD* amount to withdraw.\n` +
          `Fee *${formatUsd(fee)}* extra (from balance).\nMin *${formatUsd(config.minWithdrawUsd)}*`
      );
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
    return true;
  }

  if (state.step === 'amount') {
    const amount = parseFloat(text.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(amount) || amount < (config.minWithdrawUsd || 1)) {
      await ctx.reply(`Enter amount ≥ ${formatUsd(config.minWithdrawUsd)}`);
      return true;
    }
    const fee = cryptoPayment.getWithdrawFeeUsd(state.network);
    const total = Math.round((amount + fee) * 1e6) / 1e6;
    const u = await userService.getUser(ctx.from.id);
    const bal = Number(u?.balance_usd) || 0;
    if (bal < total) {
      await ctx.reply(`Need ${formatUsd(total)} (amount + fee). Balance ${formatUsd(bal)}`);
      return true;
    }

    const cryptoAmt = cryptoPayment.usdToCrypto(amount, state.network);
    const id = uuidv4();
    try {
      await query(
        `UPDATE users SET balance_usd = balance_usd - $1, updated_at = NOW() WHERE telegram_id = $2`,
        [total, ctx.from.id]
      );
      await query(
        `INSERT INTO withdrawals (id, user_id, chain, address, amount_usd, amount_crypto, fee_usd, status)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'pending')`,
        [
          id,
          ctx.from.id,
          cryptoPayment.chainKeyForDb(state.network),
          state.address,
          amount,
          cryptoAmt,
          fee,
        ]
      );
    } catch (e) {
      // try without id column
      try {
        await query(
          `INSERT INTO withdrawals (user_id, chain, address, amount_usd, amount_crypto, fee_usd, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')`,
          [
            ctx.from.id,
            cryptoPayment.chainKeyForDb(state.network),
            state.address,
            amount,
            cryptoAmt,
            fee,
          ]
        );
      } catch (e2) {
        await query(
          `UPDATE users SET balance_usd = balance_usd + $1 WHERE telegram_id = $2`,
          [total, ctx.from.id]
        );
        await ctx.reply(`❌ ${e2.message}`, mainMenu());
        pendingWithdraw.delete(ctx.from.id);
        return true;
      }
    }

    pendingWithdraw.delete(ctx.from.id);
    const sym = cryptoPayment.assetSymbol(state.network);
    await ctx.replyWithMarkdown(
      `✅ *Withdraw requested*\n\n` +
        `You get ≈ *${cryptoAmt}* *${sym}*\n` +
        `(${formatUsd(amount)} − fee already taken: ${formatUsd(fee)})\n` +
        `To: \`${state.address}\`\n\n` +
        `_Paid manually after review._`,
      mainMenu()
    );

    // notify admins if configured
    for (const aid of config.adminIds || []) {
      try {
        await ctx.telegram.sendMessage(
          aid,
          `📤 Withdraw #${String(id).slice(0, 8)}\n` +
            `User ${ctx.from.id}\n` +
            `${formatUsd(amount)} → ~${cryptoAmt} ${sym}\n` +
            `${state.address}\nFee ${formatUsd(fee)}`
        );
      } catch (_) {}
    }
    return true;
  }
  return false;
}

function registerActions(bot) {
  bot.action('wd:trx', (ctx) => startWithdraw(ctx, 'trx'));
  bot.action('wd:eth', (ctx) => startWithdraw(ctx, 'eth'));
}

module.exports = {
  showWithdraw,
  startWithdraw,
  handleWithdrawText,
  pendingWithdraw,
  registerActions,
};
