const config = require('../../config');
const { query } = require('../../database');
const financeService = require('../../services/financeService');
const broadcastService = require('../../services/broadcastService');
const liabilityService = require('../../services/liabilityService');
const taxService = require('../../services/taxService');
const rngService = require('../../services/rngService');
const { formatUsd } = require('../../utils/helpers');
const adminKb = require('../../keyboards/admin');

function isAdmin(ctx) {
  return config.adminIds.includes(Number(ctx.from?.id));
}

function requireAdmin(ctx) {
  if (!isAdmin(ctx)) {
    return false;
  }
  return true;
}

async function showPanel(ctx) {
  if (!requireAdmin(ctx)) return;
  await ctx.replyWithMarkdown(
    `🔒 *Admin Panel*\n\n` +
      `You are logged in as an operator.\n` +
      `• Admins *cannot* play, deposit, or withdraw.\n` +
      `• Use the buttons below for operations.\n\n` +
      `Commands also work: /stats /pending /approve /reject /broadcast /dm /liability /setdraw /taxexport`,
    adminKb.main()
  );
}

async function stats(ctx) {
  if (!requireAdmin(ctx)) return;
  const adminList = config.adminIds.length ? config.adminIds : [0];

  const users = await query(
    `SELECT COUNT(*) AS c FROM users WHERE telegram_id != ALL($1::bigint[])`,
    [adminList]
  );
  const bal = await query(
    `SELECT COALESCE(SUM(balance_usd),0) AS s FROM users WHERE telegram_id != ALL($1::bigint[])`,
    [adminList]
  );
  const tickets = await query(
    `SELECT COUNT(*) AS c, COALESCE(SUM(cost_usd),0) AS wagered, COALESCE(SUM(total_prize_usd),0) AS paid
     FROM tickets WHERE user_id != ALL($1::bigint[])`,
    [adminList]
  );
  const pendingWd = await query(`SELECT COUNT(*) AS c FROM withdrawals WHERE status = 'pending'`);
  const openSupport = await query(`SELECT COUNT(*) AS c FROM support_tickets WHERE status = 'open'`);

  const text =
    `📈 *Admin Stats*\n\n` +
    `Players: ${users.rows[0].c}\n` +
    `Player balances: ${formatUsd(bal.rows[0].s)}\n` +
    `Tickets: ${tickets.rows[0].c}\n` +
    `Wagered: ${formatUsd(tickets.rows[0].wagered)}\n` +
    `Prizes paid: ${formatUsd(tickets.rows[0].paid)}\n` +
    `Pending withdrawals: ${pendingWd.rows[0].c}\n` +
    `Open support: ${openSupport.rows[0].c}`;

  await ctx.replyWithMarkdown(text, adminKb.main());
}

async function listPendingWd(ctx) {
  if (!requireAdmin(ctx)) return;
  const list = await financeService.getPendingWithdrawals();
  if (list.length === 0) return ctx.reply('No pending withdrawals.', adminKb.main());

  for (const w of list.slice(0, 15)) {
    const exact = Number(w.amount_usd).toFixed(6);
    const fee = Number(w.fee_usd) || 0;
    const text =
      `💸 *Withdrawal*\n` +
      `ID: \`${w.id}\`\n` +
      `User: \`${w.user_id}\` @${w.username || '—'}\n\n` +
      `*SEND EXACTLY:*\n\`${exact}\` USDT\n\n` +
      `Fee held: ${formatUsd(fee)}\n` +
      `Chain: ${w.chain}\n` +
      `Address:\n\`${w.address}\`\n\n` +
      `/approve ${w.id} <txhash>`;
    await ctx.replyWithMarkdown(text, adminKb.pendingActions(w.id));
  }
}

async function startBroadcast(ctx) {
  if (!requireAdmin(ctx)) return;
  ctx.session = ctx.session || {};
  ctx.session.adminFlow = { type: 'broadcast_pick' };
  await ctx.replyWithMarkdown('📢 Choose broadcast audience:', adminKb.broadcastAudience());
}

async function pickBroadcastAudience(ctx, audience) {
  if (!requireAdmin(ctx)) return;
  ctx.session = ctx.session || {};
  ctx.session.adminFlow = { type: 'broadcast_msg', audience };
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    `Audience: *${audience}*\n\nSend the message text now (Markdown ok).\nOr /cancel`,
    adminKb.cancel()
  );
}

async function startDm(ctx) {
  if (!requireAdmin(ctx)) return;
  ctx.session = ctx.session || {};
  ctx.session.adminFlow = { type: 'dm_id' };
  await ctx.replyWithMarkdown(
    `💬 *Message a user*\n\nSend the user's *Telegram ID* (numeric).\nOr /cancel`,
    adminKb.cancel()
  );
}

async function listSupport(ctx) {
  if (!requireAdmin(ctx)) return;
  const res = await query(
    `SELECT s.*, u.username FROM support_tickets s
     LEFT JOIN users u ON u.telegram_id = s.user_id
     WHERE s.status = 'open'
     ORDER BY s.created_at ASC LIMIT 20`
  );
  if (res.rows.length === 0) return ctx.reply('No open support tickets.', adminKb.main());

  for (const t of res.rows) {
    const text =
      `🎫 *Support ticket*\n` +
      `ID: \`${t.id}\`\n` +
      `User: \`${t.user_id}\` @${t.username || '—'}\n` +
      `Message:\n${t.message}`;
    await ctx.replyWithMarkdown(text, adminKb.supportActions(t.id));
  }
}

async function liability(ctx) {
  if (!requireAdmin(ctx)) return;
  const paid = await liabilityService.getTodayPrizesPaid();
  await ctx.reply(
    `🛡️ Today prizes paid: $${paid.toFixed(2)} / cap $${config.dailyLiabilityCapUsd}\n` +
      `Remaining: $${Math.max(0, config.dailyLiabilityCapUsd - paid).toFixed(2)}`,
    adminKb.main()
  );
}

async function startSetDraw(ctx) {
  if (!requireAdmin(ctx)) return;
  ctx.session = ctx.session || {};
  ctx.session.adminFlow = { type: 'setdraw' };
  await ctx.replyWithMarkdown(
    `🎲 Send 4 numbers (1–40), e.g.\n\`5 12 23 40\`\nOr /cancel`,
    adminKb.cancel()
  );
}

async function taxExport(ctx) {
  if (!requireAdmin(ctx)) return;
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
  const csv = await taxService.exportCsv(from, to);
  const sum = await taxService.summary();
  await ctx.replyWithDocument(
    { source: Buffer.from(csv), filename: `tax-ledger-${from}-${to}.csv` },
    {
      caption: `Tax summary: GGR $${Number(sum.ggr).toFixed(2)} | Tax $${Number(sum.tax).toFixed(2)}`,
      ...adminKb.main(),
    }
  );
}

/**
 * Official staff message template — reduces fake-admin risk.
 * Never asks for secrets; always labeled as system message.
 */
function officialEnvelope(body, kind = 'support') {
  const title =
    kind === 'support'
      ? '📩 *Official message from LottoWin Support*'
      : '📢 *Official message from LottoWin*';
  return (
    `${title}\n` +
    `━━━━━━━━━━━━━━\n` +
    `${body}\n` +
    `━━━━━━━━━━━━━━\n` +
    `_This message was sent through the official bot only.\n` +
    `We will never ask for your seed phrase, private key, or password.\n` +
    `Ignore anyone claiming to be admin in private chat outside this bot._`
  );
}

async function sendOfficialDm(bot, telegramId, body, adminId, kind = 'support') {
  const text = officialEnvelope(body, kind);
  const ok = await broadcastService.notifyUser(bot, telegramId, text);
  await query(
    `INSERT INTO audit_logs (actor_id, actor_type, action, target_type, target_id, details)
     VALUES ($1, 'admin', 'official_dm', 'user', $2, $3)`,
    [adminId, String(telegramId), { kind, preview: String(body).slice(0, 200) }]
  );
  return ok;
}

/**
 * Handle multi-step admin text flows. Returns true if consumed.
 */
async function handleAdminText(ctx, bot) {
  if (!isAdmin(ctx)) return false;
  const flow = ctx.session?.adminFlow;
  if (!flow) return false;

  const text = (ctx.message?.text || '').trim();
  if (text === '/cancel') {
    delete ctx.session.adminFlow;
    await ctx.reply('Cancelled.', adminKb.main());
    return true;
  }

  if (flow.type === 'broadcast_msg') {
    delete ctx.session.adminFlow;
    const id = await broadcastService.createBroadcast({
      message: text,
      audience: flow.audience || 'all',
      createdBy: ctx.from.id,
    });
    await ctx.reply(`📢 Sending broadcast…`);
    const result = await broadcastService.sendBroadcast(bot, id);
    await ctx.reply(
      `Done. Audience: ${flow.audience}\nSent: ${result?.sent ?? 0}\nFailed: ${result?.fail ?? 0}`,
      adminKb.main()
    );
    return true;
  }

  if (flow.type === 'dm_id') {
    const tid = parseInt(text, 10);
    if (!tid || Number.isNaN(tid)) {
      await ctx.reply('Invalid Telegram ID. Send a number or /cancel');
      return true;
    }
    if (config.adminIds.includes(tid)) {
      await ctx.reply('Cannot message another admin account this way.');
      return true;
    }
    ctx.session.adminFlow = { type: 'dm_body', targetId: tid };
    await ctx.replyWithMarkdown(
      `Target: \`${tid}\`\n\nNow send the *message body*.\nIt will be wrapped in an official Support envelope.\nOr /cancel`
    );
    return true;
  }

  if (flow.type === 'dm_body') {
    const targetId = flow.targetId;
    delete ctx.session.adminFlow;
    const ok = await sendOfficialDm(bot, targetId, text, ctx.from.id, 'support');
    await ctx.reply(ok ? `✅ Delivered to ${targetId}` : `❌ Failed to deliver (user may have blocked the bot)`, adminKb.main());
    return true;
  }

  if (flow.type === 'support_reply') {
    const ticketId = flow.ticketId;
    delete ctx.session.adminFlow;
    const t = await query(`SELECT * FROM support_tickets WHERE id = $1`, [ticketId]);
    if (!t.rows[0]) {
      await ctx.reply('Ticket not found.', adminKb.main());
      return true;
    }
    const row = t.rows[0];
    await query(
      `UPDATE support_tickets SET admin_reply = $2, status = 'replied', updated_at = NOW() WHERE id = $1`,
      [ticketId, text]
    );
    const ok = await sendOfficialDm(bot, row.user_id, text, ctx.from.id, 'support');
    await ctx.reply(
      ok ? `✅ Reply sent to user ${row.user_id}` : `Saved reply but delivery failed`,
      adminKb.main()
    );
    return true;
  }

  if (flow.type === 'setdraw') {
    const parts = text.split(/[\s,]+/).map(Number);
    if (parts.length !== 4 || parts.some((n) => isNaN(n))) {
      await ctx.reply('Need exactly 4 numbers. Example: 5 12 23 40');
      return true;
    }
    try {
      rngService.setPendingOverride(parts, ctx.from.id, 'admin panel');
      delete ctx.session.adminFlow;
      await ctx.reply(
        `Next draw override: ${[...parts].sort((a, b) => a - b).join(', ')} (5 min)`,
        adminKb.main()
      );
    } catch (e) {
      await ctx.reply(e.message);
    }
    return true;
  }

  return false;
}

async function handleAdminCallback(ctx, bot) {
  if (!isAdmin(ctx)) return false;
  const data = ctx.callbackQuery?.data || '';
  if (!data.startsWith('adm:')) return false;

  if (data === 'adm:cancel') {
    if (ctx.session) delete ctx.session.adminFlow;
    await ctx.answerCbQuery('Cancelled');
    await ctx.reply('Cancelled.', adminKb.main());
    return true;
  }

  if (data.startsWith('adm:bc:')) {
    const audience = data.replace('adm:bc:', '');
    await pickBroadcastAudience(ctx, audience);
    return true;
  }

  if (data.startsWith('adm:wd:ok:')) {
    const id = data.replace('adm:wd:ok:', '');
    await ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    // Approve without tx hash first; admin can paste hash later via /approve
    const w = await financeService.approveWithdrawal(id, ctx.from.id, null);
    if (w) {
      await ctx.reply(`✅ Approved ${id}`, adminKb.main());
      try {
        const exact = Number(w.amount_usd).toFixed(6);
        await ctx.telegram.sendMessage(
          w.user_id,
          `✅ *Withdrawal paid*\n\nYou received *${exact}* USDT\nRef: \`${w.id}\``,
          { parse_mode: 'Markdown' }
        );
      } catch {
        /* user blocked bot */
      }
    } else {
      await ctx.reply('Not found / already processed', adminKb.main());
    }
    return true;
  }

  if (data.startsWith('adm:wd:no:')) {
    const id = data.replace('adm:wd:no:', '');
    await ctx.answerCbQuery();
    const w = await financeService.rejectWithdrawal(id, ctx.from.id, 'Rejected by admin');
    if (w) {
      await ctx.reply(`❌ Rejected ${id} — full amount + fee refunded`, adminKb.main());
      try {
        const payout = Number(w.amount_usd) || 0;
        const fee = Number(w.fee_usd) || 0;
        const refund = (payout + fee).toFixed(6);
        await ctx.telegram.sendMessage(
          w.user_id,
          `❌ *Withdrawal rejected*\n\nRef: \`${w.id}\`\nRefunded to balance: *$${refund}* (payout + fee)`,
          { parse_mode: 'Markdown' }
        );
      } catch {
        /* user blocked bot */
      }
    } else {
      await ctx.reply('Not found / already processed', adminKb.main());
    }
    return true;
  }

  if (data.startsWith('adm:sup:reply:')) {
    const ticketId = data.replace('adm:sup:reply:', '');
    await ctx.answerCbQuery();
    ctx.session = ctx.session || {};
    ctx.session.adminFlow = { type: 'support_reply', ticketId };
    await ctx.replyWithMarkdown('Send your *reply* to the user now.\nOr /cancel');
    return true;
  }

  if (data.startsWith('adm:sup:close:')) {
    const ticketId = data.replace('adm:sup:close:', '');
    await ctx.answerCbQuery();
    await query(
      `UPDATE support_tickets SET status = 'closed', updated_at = NOW() WHERE id = $1`,
      [ticketId]
    );
    await ctx.reply(`Ticket ${ticketId} closed.`, adminKb.main());
    return true;
  }

  return false;
}


async function listPendingDeposits(ctx) {
  if (!requireAdmin(ctx)) return;
  const cryptoPayment = require('../../services/cryptoPaymentService');
  const list = await cryptoPayment.listPending();
  if (!list.length) return ctx.reply('No active pending deposits.', adminKb.main());
  let text = '*Active pending deposits*\n\n';
  for (const p of list.slice(0, 20)) {
    const left = Math.max(0, Math.ceil((p.expiresAt - Date.now()) / 60000));
    text += `User \`${p.userId}\` | ${p.network} | exact \`${p.exactAmount.toFixed(6)}\` | base $${p.baseAmount} | ${left}m left\n`;
  }
  await ctx.replyWithMarkdown(text, adminKb.main());
}



/** /creditdep <telegramId> <amount> <erc20|trc20> [txhash] */
async function creditDeposit(ctx) {
  if (!requireAdmin(ctx)) return;
  const parts = (ctx.message.text || '').trim().split(/\s+/);
  // /creditdep uid amount network [hash]
  if (parts.length < 4) {
    return ctx.reply('Usage: /creditdep <telegramId> <amount> <erc20|trc20> [txHash]');
  }
  const userId = Number(parts[1]);
  const amount = parseFloat(parts[2]);
  const network = parts[3];
  const txHash = parts[4] || null;
  try {
    const cryptoPayment = require('../../services/cryptoPaymentService');
    const { formatUsd } = require('../../utils/helpers');
    await cryptoPayment.manualCreditDeposit(userId, amount, network, txHash);
    await ctx.reply(`Credited ${formatUsd(amount)} to ${userId} (${network})${txHash ? ' TX ' + txHash : ''}`);
    try {
      await ctx.telegram.sendMessage(userId, `✅ Deposit credited by admin: ${formatUsd(amount)}`);
    } catch (_) {}
  } catch (e) {
    await ctx.reply('Error: ' + e.message);
  }
}


async function toggleMaintenance(ctx) {
  if (!requireAdmin(ctx)) return;
  const settingsService = require('../../services/settingsService');
  const maintenance = require('../../middleware/maintenance');
  const adminKb = require('../../keyboards/admin');
  const on = await maintenance.isMaintenanceOn();
  await settingsService.set('maintenance_mode', !on);
  maintenance.bustCache();
  const now = !on;
  await ctx.replyWithMarkdown(
    now
      ? '🛠️ Maintenance *ON* — users blocked.\nToggle again or `/maintenance off` when done.'
      : '✅ Maintenance *OFF* — bot open.\nBroadcast users to send `/start`.',
    adminKb.main()
  );
}

module.exports = {
  isAdmin,
  requireAdmin,
  showPanel,
  toggleMaintenance,
  listPendingDeposits,
  creditDeposit,
  stats,
  listPendingWd,
  startBroadcast,
  startDm,
  listSupport,
  liability,
  startSetDraw,
  taxExport,
  handleAdminText,
  handleAdminCallback,
  sendOfficialDm,
  officialEnvelope,
};
