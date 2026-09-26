const config = require('../../config');
const { query } = require('../../database');
const financeService = require('../../services/financeService');
const userService = require('../../services/userService');
const { formatUsd } = require('../../utils/helpers');

function isAdmin(ctx) {
  return config.adminIds.includes(ctx.from?.id);
}

async function stats(ctx) {
  if (!isAdmin(ctx)) return;
  const users = await query(`SELECT COUNT(*) AS c FROM users`);
  const bal = await query(`SELECT COALESCE(SUM(balance_usd),0) AS s FROM users`);
  const tickets = await query(`SELECT COUNT(*) AS c, COALESCE(SUM(cost_usd),0) AS wagered, COALESCE(SUM(total_prize_usd),0) AS paid FROM tickets`);
  const pendingWd = await query(`SELECT COUNT(*) AS c FROM withdrawals WHERE status = 'pending'`);

  const text = `📈 *Admin Stats*

Users: ${users.rows[0].c}
Total balances: ${formatUsd(bal.rows[0].s)}
Tickets: ${tickets.rows[0].c}
Wagered: ${formatUsd(tickets.rows[0].wagered)}
Prizes paid: ${formatUsd(tickets.rows[0].paid)}
Pending withdrawals: ${pendingWd.rows[0].c}`;

  await ctx.replyWithMarkdown(text);
}

async function listPendingWd(ctx) {
  if (!isAdmin(ctx)) return;
  const list = await financeService.getPendingWithdrawals();
  if (list.length === 0) return ctx.reply('No pending withdrawals.');
  let text = '*Pending Withdrawals*\n\n';
  for (const w of list) {
    text += `ID: \`${w.id}\`\nUser: ${w.user_id} (@${w.username || '—'})\n${formatUsd(w.amount_usd)} → ${w.chain}\n\`${w.address}\`\n\n`;
  }
  text += 'Approve: /approve <id> <txhash>\nReject: /reject <id> <reason>';
  await ctx.replyWithMarkdown(text);
}

module.exports = {
  isAdmin,
  stats,
  listPendingWd,
};
