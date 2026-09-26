const lottoService = require('../../services/lottoService');
const { formatUsd, formatNumbers } = require('../../utils/helpers');
const { mainMenu } = require('../../utils/ui');

module.exports = async (ctx) => {
  const tickets = await lottoService.getRecentTickets(ctx.from.id, 8);
  const txs = await lottoService.getStatement(ctx.from.id, 15);

  let text = `📊 *Recent Activity*\n\n*Last Tickets*\n`;
  if (tickets.length === 0) {
    text += `_No tickets yet_\n`;
  } else {
    for (const t of tickets) {
      const lines = typeof t.lines === 'string' ? JSON.parse(t.lines) : t.lines;
      text += `• ${new Date(t.created_at).toLocaleString()} – cost ${formatUsd(t.cost_usd)} → won ${formatUsd(t.total_prize_usd)}\n`;
      text += `  Draw: ${formatNumbers(t.winning_numbers)}\n`;
    }
  }

  text += `\n*Statement*\n`;
  if (txs.length === 0) {
    text += `_No transactions_\n`;
  } else {
    for (const tx of txs) {
      const sign = Number(tx.amount_usd) >= 0 ? '+' : '';
      text += `• ${tx.type}: ${sign}${formatUsd(tx.amount_usd)} → bal ${formatUsd(tx.balance_after)}\n`;
    }
  }

  await ctx.replyWithMarkdown(text, mainMenu());
};
