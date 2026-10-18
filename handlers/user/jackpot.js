const dailyJackpot = require('../../services/dailyJackpotService');
const config = require('../../config');
const { playActions, mainMenu } = require('../../utils/ui');
const { formatUsd } = require('../../utils/helpers');
const { query } = require('../../database');

const manualFlow = new Map(); // userId -> { numbers: [] }

async function showStatus(ctx) {
  const text = await dailyJackpot.statusText();
  await ctx.replyWithMarkdown(text, playActions());
}

async function showBuy(ctx) {
  const text = await dailyJackpot.statusText();
  await ctx.replyWithMarkdown(
    text + `\n\nChoose how to add lines:`,
    playActions()
  );
}

async function quickPick(ctx, count) {
  try {
    await ctx.answerCbQuery().catch(() => {});
    const game = config.game;
    const lines = [];
    for (let i = 0; i < count; i++) {
      lines.push(dailyJackpot.pickRandomNumbers(game.pick, game.from, game.to));
    }
    const result = await dailyJackpot.buyLines(ctx.from.id, lines);
    const linesText = lines.map((l, i) => `${i + 1}. \`${l.join(' ')}\``).join('\n');
    await ctx.replyWithMarkdown(
      `✅ *${result.lines} line(s) booked*\n` +
        `Cash: *${formatUsd(result.cashPaid)}* · Free used: *${result.freeUsed}*\n` +
        `Pot now: *${formatUsd(result.draw.pot_usd)}*\n\n${linesText}\n\n` +
        `Good luck at today's draw!`,
      mainMenu()
    );
  } catch (e) {
    await ctx.reply(`❌ ${e.message}`, mainMenu());
  }
}

async function startManual(ctx) {
  await ctx.answerCbQuery().catch(() => {});
  const game = config.game;
  manualFlow.set(ctx.from.id, { numbers: [] });
  await ctx.replyWithMarkdown(
    `✍️ Send *${game.pick}* numbers from *${game.from}–${game.to}*, separated by space.\n` +
      `Example: \`3 12 19 40\``
  );
}

async function handleManualText(ctx) {
  const state = manualFlow.get(ctx.from.id);
  if (!state) return false;
  const parts = (ctx.message.text || '')
    .trim()
    .split(/[\s,]+/)
    .map((x) => parseInt(x, 10))
    .filter((n) => !isNaN(n));
  try {
    const result = await dailyJackpot.buyLines(ctx.from.id, [parts]);
    manualFlow.delete(ctx.from.id);
    await ctx.replyWithMarkdown(
      `✅ Line booked: \`${[...parts].sort((a, b) => a - b).join(' ')}\`\n` +
        `Paid *${formatUsd(result.cashPaid)}* · Pot *${formatUsd(result.draw.pot_usd)}*`,
      mainMenu()
    );
  } catch (e) {
    await ctx.reply(`❌ ${e.message}`);
  }
  return true;
}

async function myLines(ctx) {
  const draw = await dailyJackpot.getOpenDraw();
  const res = await query(
    `SELECT numbers, cost_usd, used_free FROM jackpot_lines WHERE draw_id = $1 AND user_id = $2 ORDER BY created_at`,
    [draw.id, ctx.from.id]
  );
  if (!res.rows.length) {
    return ctx.replyWithMarkdown(`No lines for *${draw.draw_date}* yet. Tap *Buy lines*.`, mainMenu());
  }
  const body = res.rows
    .map((r, i) => `${i + 1}. \`${r.numbers.join(' ')}\` ${r.used_free ? '(free)' : formatUsd(r.cost_usd)}`)
    .join('\n');
  await ctx.replyWithMarkdown(`🎫 *Your lines — ${draw.draw_date}*\n\n${body}`, mainMenu());
}

async function results(ctx) {
  const res = await query(
    `SELECT * FROM draws WHERE status = 'drawn' ORDER BY draw_date DESC LIMIT 5`
  );
  if (!res.rows.length) return ctx.reply('No draws yet.', mainMenu());
  const body = res.rows
    .map((d) => {
      const nums = (d.winning_numbers || []).join(' ');
      return (
        `*${d.draw_date}* → \`${nums}\`\n` +
        `Pot ${formatUsd(d.pot_usd)} · Winners ${d.winners_count} · Paid ${formatUsd(d.jackpot_paid_usd)}`
      );
    })
    .join('\n\n');
  await ctx.replyWithMarkdown(`📊 *Recent results*\n\n${body}`, mainMenu());
}

async function howTo(ctx) {
  const g = config.game;
  await ctx.replyWithMarkdown(
    `ℹ️ *How to play ${g.name}*\n\n` +
      `1. Deposit TRX or ETH\n` +
      `2. Buy lines — pick *${g.pick}* numbers from *${g.from}–${g.to}* (or Quick Pick)\n` +
      `3. Ticket *${formatUsd(config.ticketPriceUsd)}* / line (free lines used first)\n` +
      `4. Wait for *daily draw* (sales close before draw time)\n` +
      `5. Match all ${g.pick} → share the *live pot*\n` +
      `   Match ${config.freeTicketMatch}+ → *free line* next draw\n\n` +
      `Pot = *${config.jackpotSharePercent}%* of cash ticket sales + rollover. *No seed.*\n` +
      `18+ · Play responsibly`,
    mainMenu()
  );
}

module.exports = {
  showStatus,
  showBuy,
  quickPick,
  startManual,
  handleManualText,
  myLines,
  results,
  howTo,
  manualFlow,
};
