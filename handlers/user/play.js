const lottoService = require('../../services/lottoService');
const userService = require('../../services/userService');
const config = require('../../config');
const { playMenu, numberGrid, mainMenu, gamePicker, afterPlayMenu } = require('../../utils/ui');
const { formatUsd, formatNumbers } = require('../../utils/helpers');

const sessions = new Map();

function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, { gameId: '4_40', lines: [], current: [], step: 'idle' });
  }
  return sessions.get(userId);
}

function clearSession(userId) {
  sessions.delete(userId);
}

async function showGamePicker(ctx) {
  const user = await userService.getUser(ctx.from.id);
  const g440 = config.games['4_40'];
  const g330 = config.games['3_30'];
  const text =
    `🎰 *Choose a game*\n\n` +
    `*Insta Win 4/40*\n` +
    `Pick 4 from 1–40 · ${formatUsd(g440.playCostUsd)}/line\n` +
    `Match 4 → ${formatUsd(g440.prizesUsd[4])} · Match 3 → ${formatUsd(g440.prizesUsd[3])} · Match 2 → ${formatUsd(g440.prizesUsd[2])} · Match 1 → ${formatUsd(g440.prizesUsd[1])}\n\n` +
    `*Insta Win 3/30*\n` +
    `Pick 3 from 1–30 · ${formatUsd(g330.playCostUsd)}/line\n` +
    `Match 3 → ${formatUsd(g330.prizesUsd[3])} · Match 2 → ${formatUsd(g330.prizesUsd[2])} · Match 1 → ${formatUsd(g330.prizesUsd[1])}\n\n` +
    `Cash: *${formatUsd(user?.balance_usd || 0)}* · Free tickets: *${Number(user?.unlocked_tickets) || 0}*`;

  await ctx.replyWithMarkdown(text, gamePicker());
}

async function selectGame(ctx, gameId) {
  const s = getSession(ctx.from.id);
  s.gameId = gameId;
  s.lines = [];
  s.current = [];
  s.step = 'idle';
  await ctx.answerCbQuery();
  return showPlayScreen(ctx);
}

async function showPlayScreen(ctx) {
  const s = getSession(ctx.from.id);
  const game = lottoService.getGame(s.gameId || '4_40');
  const user = await userService.getUser(ctx.from.id);
  const cost = s.lines.length * game.playCostUsd;
  const free = Number(user?.unlocked_tickets) || 0;

  let text = `🎰 *${game.name}*\n\n`;
  text += `Lines: *${s.lines.length}/${game.maxLines}*\n`;
  text += `Cost: *${formatUsd(cost)}*`;
  if (free > 0) text += ` _(up to ${Math.min(free, s.lines.length || game.maxLines)} free)_`;
  text += `\nCash: *${formatUsd(user?.balance_usd || 0)}* · Free tickets: *${free}*\n\n`;

  if (s.lines.length === 0) {
    text += `_No lines yet. Add a line or use Quick Pick._\n`;
  } else {
    s.lines.forEach((line, i) => {
      text += `${i + 1}. ${formatNumbers(line)}\n`;
    });
  }

  text += `\nPick *${game.pick}* numbers from ${game.from}–${game.to}.`;

  await ctx.replyWithMarkdown(text, playMenu());
}

async function startAddLine(ctx) {
  const s = getSession(ctx.from.id);
  const game = lottoService.getGame(s.gameId || '4_40');
  if (s.lines.length >= game.maxLines) {
    return ctx.answerCbQuery(`Max ${game.maxLines} lines`);
  }
  s.current = [];
  s.step = 'picking';
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    `Select *${game.pick}* numbers from ${game.from}–${game.to}\nCurrent: *0 of ${game.pick}*`,
    numberGrid([], game)
  );
}

async function handleNumber(ctx) {
  const data = ctx.callbackQuery.data;
  const s = getSession(ctx.from.id);
  const game = lottoService.getGame(s.gameId || '4_40');
  if (s.step !== 'picking') return ctx.answerCbQuery();

  if (data === 'num:clear') {
    s.current = [];
    await ctx.editMessageReplyMarkup(numberGrid([], game).reply_markup);
    return ctx.answerCbQuery('Cleared');
  }

  if (data === 'num:done') {
    if (s.current.length !== game.pick) {
      return ctx.answerCbQuery(`Select exactly ${game.pick} numbers`);
    }
    s.lines.push([...s.current].sort((a, b) => a - b));
    s.current = [];
    s.step = 'idle';
    await ctx.answerCbQuery('Line added!');
    await ctx.deleteMessage().catch(() => {});
    return showPlayScreen(ctx);
  }

  const n = parseInt(data.replace('num:', ''), 10);
  if (Number.isNaN(n) || n < game.from || n > game.to) return ctx.answerCbQuery();

  if (s.current.includes(n)) {
    s.current = s.current.filter((x) => x !== n);
  } else {
    if (s.current.length >= game.pick) {
      return ctx.answerCbQuery(`Max ${game.pick} numbers`);
    }
    s.current.push(n);
  }

  await ctx.editMessageReplyMarkup(numberGrid(s.current, game).reply_markup);
  await ctx.answerCbQuery(`${s.current.length} of ${game.pick}`);
}

async function quickPick(ctx, count = 1) {
  const s = getSession(ctx.from.id);
  const game = lottoService.getGame(s.gameId || '4_40');
  await ctx.answerCbQuery();
  for (let i = 0; i < count; i++) {
    if (s.lines.length >= game.maxLines) break;
    s.lines.push(lottoService.quickPick(game));
  }
  return showPlayScreen(ctx);
}

async function confirmPlay(ctx) {
  const s = getSession(ctx.from.id);
  if (!s.lines.length) {
    return ctx.answerCbQuery('Add at least one line');
  }
  await ctx.answerCbQuery();
  try {
    const result = await lottoService.play(ctx.from.id, s.lines, s.gameId || '4_40');
    clearSession(ctx.from.id);

    let text = `🎲 *${result.gameName || 'Result'}*\n\n`;
    text += `Winning numbers: *${formatNumbers(result.winningNumbers)}*\n\n`;
    result.results.forEach((line, i) => {
      text += `${i + 1}. ${formatNumbers(line.numbers)} → Match *${line.matches}* · ${formatUsd(line.prize)}\n`;
    });
    text += `\nStake: ${formatUsd(result.faceCost || result.cost)}`;
    if (result.freeTicketsUsed) text += ` (${result.freeTicketsUsed} free)`;
    text += `\nPrize: *${formatUsd(result.totalPrize)}*`;
    if (result.liabilityCapped) text += `\n_Prize adjusted by pool protection._`;
    text += `\nBalance: *${formatUsd(result.balanceAfter)}*`;

    await ctx.replyWithMarkdown(text, afterPlayMenu(result.gameId || s.gameId || '4_40'));
  } catch (e) {
    await ctx.reply(`❌ ${e.message}`, mainMenu());
  }
}

async function cancelPlay(ctx) {
  clearSession(ctx.from.id);
  await ctx.answerCbQuery('Cancelled');
  await ctx.reply('Play cancelled.', mainMenu());
}

module.exports = {
  showGamePicker,
  selectGame,
  showPlayScreen,
  startAddLine,
  handleNumber,
  quickPick,
  confirmPlay,
  cancelPlay,
  getSession,
  clearSession,
};
