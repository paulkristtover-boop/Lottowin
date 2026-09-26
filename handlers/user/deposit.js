const config = require('../../config');
const { depositMenu, mainMenu } = require('../../utils/ui');
const blockchainChecker = require('../../services/blockchainChecker');
const { formatUsd } = require('../../utils/helpers');

const pendingClaim = new Map();

async function showDeposit(ctx) {
  const text = `📥 *Deposit Crypto*

Send USDT to one of our treasury addresses.
After sending, tap *Claim by TX Hash* and paste the transaction hash.

Min deposit: ${formatUsd(config.minDepositUsd)}

⚠️ Always double-check the address and network!`;

  await ctx.replyWithMarkdown(text, depositMenu());
}

async function showAddress(ctx, chain) {
  let addr = '';
  let label = '';
  if (chain === 'usdt_trc20') {
    addr = config.treasury.usdtTrc20;
    label = 'USDT (TRC20 – Tron)';
  } else if (chain === 'usdt_erc20') {
    addr = config.treasury.usdtErc20;
    label = 'USDT (ERC20 – Ethereum)';
  }

  if (!addr) {
    return ctx.reply('This deposit method is temporarily unavailable.');
  }

  const text = `📥 *${label}*

\`\`\`
${addr}
\`\`\`

1. Send USDT to the address above
2. Wait for network confirmation
3. Come back and use *Claim by TX Hash*
4. Paste the transaction hash

Min: ${formatUsd(config.minDepositUsd)}`;

  await ctx.replyWithMarkdown(text, depositMenu());
}

async function startClaim(ctx) {
  pendingClaim.set(ctx.from.id, true);
  await ctx.replyWithMarkdown(
    `Paste the *transaction hash* (TXID) of your deposit now.\n\nOr /cancel to abort.`
  );
}

async function handleClaimText(ctx) {
  if (!pendingClaim.get(ctx.from.id)) return false;
  pendingClaim.delete(ctx.from.id);

  const txHash = ctx.message.text.trim();
  if (txHash.length < 20) {
    await ctx.reply('Invalid TX hash. Try again from the Deposit menu.');
    return true;
  }

  try {
    const dep = await blockchainChecker.claimDeposit(ctx.from.id, txHash);
    await ctx.replyWithMarkdown(
      `✅ *Deposit credited!*\n\nAmount: *${formatUsd(dep.amount_usd)}*\nChain: ${dep.chain}\nTX: \`${dep.tx_hash}\``,
      mainMenu()
    );
  } catch (e) {
    await ctx.reply(`❌ ${e.message}`, mainMenu());
  }
  return true;
}

module.exports = {
  showDeposit,
  showAddress,
  startClaim,
  handleClaimText,
  pendingClaim,
};
