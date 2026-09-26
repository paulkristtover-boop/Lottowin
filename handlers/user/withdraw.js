const financeService = require('../../services/financeService');
const userService = require('../../services/userService');
const config = require('../../config');
const { withdrawMenu, mainMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');

const pendingWithdraw = new Map();

async function showWithdraw(ctx) {
  const user = await userService.getUser(ctx.from.id);
  const text = `📤 *Withdraw*

Available: *${formatUsd(user.balance_usd)}*
Minimum: ${formatUsd(config.minWithdrawUsd)}

Choose network:`;
  await ctx.replyWithMarkdown(text, withdrawMenu());
}

async function startWithdraw(ctx, chain) {
  pendingWithdraw.set(ctx.from.id, { chain, step: 'address' });
  await ctx.replyWithMarkdown(
    `Send the *destination address* for ${chain.toUpperCase()}.\n\nOr /cancel`
  );
}

async function handleWithdrawText(ctx) {
  const state = pendingWithdraw.get(ctx.from.id);
  if (!state) return false;

  const text = ctx.message.text.trim();

  if (state.step === 'address') {
    // Basic validation
    if (text.length < 20) {
      await ctx.reply('Address looks invalid. Try again or /cancel');
      return true;
    }
    state.address = text;
    state.step = 'amount';
    pendingWithdraw.set(ctx.from.id, state);
    await ctx.replyWithMarkdown(
      `Address saved.\nNow enter the *USD amount* to withdraw (min ${formatUsd(config.minWithdrawUsd)}).`
    );
    return true;
  }

  if (state.step === 'amount') {
    const amount = parseFloat(text);
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('Invalid amount. Enter a number.');
      return true;
    }
    pendingWithdraw.delete(ctx.from.id);
    try {
      const w = await financeService.createWithdrawal(
        ctx.from.id,
        state.chain,
        state.address,
        amount
      );
      await ctx.replyWithMarkdown(
        `✅ *Withdrawal requested*\n\nAmount: ${formatUsd(w.amount_usd)}\nNetwork: ${w.chain}\nAddress: \`${w.address}\`\n\nStatus: pending review. You will be notified when processed.`,
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
};
