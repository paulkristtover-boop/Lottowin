const lottoService = require('../../services/lottoService');
const userService = require('../../services/userService');
const config = require('../../config');
const { playMenu, numberGrid, mainMenu } = require('../../utils/ui');
const { formatUsd, formatNumbers } = require('../../utils/helpers');

// In-memory session state (for production use Redis)
const sessions = new Map();

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, { lines: [], current: [], step: 'idle' });
  }
  return sessions.get(userId);
}

function clearSession(userId) {
  sessions.delete(userId);
}

async function showPlayScreen(ctx) {
  const s = getSession(ctx.from.id);
  const user = await userService.getUser(ctx.from.id);
  const cost = s.lines.length * config.playCostUsd;

  let text = `🎰 *Build Your Ticket*\n\n`;
  text += `Lines: *${s.lines.length}/${config.maxLines}*\n`;
  text += `Cost: *${formatUsd(cost)}*\n`;
  text += `Balance: *${formatUsd(user.balance_usd)}*\n\n`;

  if (s.lines.length === 0) {
    text += `_No lines yet. Add a line or use Quick Pick._\n`;
  } else {
    s.lines.forEach((line, i) => {
      text += `${i + 1}. ${formatNumbers(line)}\n`;
    });
  }

  text += `\n*0 of 4 selected* for current line.`;

  await ctx.replyWithMarkdown(text, playMenu());
}

async function startAddLine(ctx) {
  const s = getSession(ctx.from.id);
  if (s.lines.length >= config.maxLines) {
    return ctx.answerCbQuery(`Max ${config.maxLines} lines`);
  }
  s.current = [];
  s.step = 'picking';
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    `Select *4 numbers* from 1–40\nCurrent: *0 of 4*`,
    numberGrid([])
  );
}

async function handleNumber(ctx) {
  const data = ctx.callbackQuery.data;
  const s = getSession(ctx.from.id);
  if (s.step !== 'picking') return ctx.answerCbQuery();

  if (data === 'num:clear') {
    s.current = [];
    await ctx.editMessageReplyMarkup(numberGrid([]).reply_markup);
    return ctx.answerCbQuery('Cleared');
  }

  if (data === 'num:done') {
    if (s.current.length !== 4) {
      return ctx.answerCbQuery('Select exactly 4 numbers');
    }
    s.lines.push([...s.current].sort((a, b) => a - b));
    s.current = [];
    s.step = 'idle';
    await ctx.answerCbQuery('Line added!');
    await ctx.deleteMessage().catch(() => {});
    return showPlayScreen(ctx);
  }

  const n = parseInt(data.replace('num:', ''), 10);
  if (isNaN(n) || n < 1 || n > 40) return ctx.answerCbQuery();

  const idx = s.current.indexOf(n);
  if (idx >= 0) {
    s.current.splice(idx, 1);
  } else {
    if (s.current.length >= 4) {
      return ctx.answerCbQuery('Already 4 numbers – tap Done or clear');
    }
    s.current.push(n);
  }

  const count = s.current.length;
  await ctx.editMessageText(
    `Select *4 numbers* from 1–40\nCurrent: *${count} of 4*\n${formatNumbers(s.current.sort((a,b)=>a-b))}`,
    { parse_mode: 'Markdown', ...numberGrid(s.current) }
  );
  await ctx.answerCbQuery();
}

async function quickPick(ctx, count = 1) {
  const s = getSession(ctx.from.id);
  const remaining = config.maxLines - s.lines.length;
  const toAdd = Math.min(count, remaining);
  if (toAdd <= 0) return ctx.answerCbQuery(`Max ${config.maxLines} lines`);

  for (let i = 0; i < toAdd; i++) {
    s.lines.push(lottoService.quickPick());
  }
  await ctx.answerCbQuery(`Added ${toAdd} Quick Pick line(s)`);
  await showPlayScreen(ctx);
}

async function confirmPlay(ctx) {
  const s = getSession(ctx.from.id);
  if (s.lines.length === 0) {
    return ctx.answerCbQuery('Add at least one line');
  }

  try {
    await ctx.answerCbQuery('Drawing…');
    const result = await lottoService.play(ctx.from.id, s.lines);
    clearSession(ctx.from.id);

    let text = `🎲 *DRAW COMPLETE*\n\n`;
    text += `Winning numbers: *${formatNumbers(result.winningNumbers)}*\n\n`;

    result.results.forEach((r, i) => {
      const emoji = r.matches === 4 ? '🏆' : r.matches === 3 ? '🎉' : r.matches === 2 ? '✨' : '•';
      text += `${emoji} Line ${i + 1}: ${formatNumbers(r.numbers)} → *${r.matches} match*`;
      if (r.prize > 0) text += ` → +${formatUsd(r.prize)}`;
      text += `\n`;
    });

    text += `\nCost: ${formatUsd(result.cost)}`;
    text += `\nWon: *${formatUsd(result.totalPrize)}*`;
    text += `\nNew balance: *${formatUsd(result.balanceAfter)}*`;

    if (result.totalPrize === 0) {
      text += `\n\nBetter luck next time! 🍀`;
    } else if (result.results.some((r) => r.matches === 4)) {
      text += `\n\n🎊 *JACKPOT!* Congratulations!`;
    }

    text += `\n\n⚠️ Play responsibly. 18+`;

    await ctx.replyWithMarkdown(text, mainMenu());
  } catch (e) {
    await ctx.reply(`❌ ${e.message}`, mainMenu());
  }
}

async function cancelPlay(ctx) {
  clearSession(ctx.from.id);
  await ctx.answerCbQuery('Cancelled');
  await ctx.reply('Ticket cancelled.', mainMenu());
}

module.exports = {
  showPlayScreen,
  startAddLine,
  handleNumber,
  quickPick,
  confirmPlay,
  cancelPlay,
  getSession,
  clearSession,
};
