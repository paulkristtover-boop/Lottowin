/**
 * User-facing copy — always pull amounts from config so PLAY_COST / prizes stay in sync.
 */
const config = require('../config');
const { formatUsd } = require('./helpers');

function game(id) {
  return config.games[id] || config.games['4_40'];
}

function prizeLines(g) {
  const lines = [];
  const keys = Object.keys(g.prizesUsd || {})
    .map(Number)
    .filter((n) => n > 0)
    .sort((a, b) => b - a);
  for (const k of keys) {
    lines.push(`• Match ${k} → *${formatUsd(g.prizesUsd[k])}*`);
  }
  return lines.join('\n');
}

function prizeOneLiner(g) {
  const keys = Object.keys(g.prizesUsd || {})
    .map(Number)
    .filter((n) => n > 0)
    .sort((a, b) => b - a);
  return keys.map((k) => `Match ${k} → ${formatUsd(g.prizesUsd[k])}`).join(' · ');
}

function howToPlay(gameId) {
  const g = game(gameId);
  if (!g) return 'Unknown game.';
  const top = g.prizesUsd[g.pick];
  const multi = g.playCostUsd > 0 ? Math.round(top / g.playCostUsd) : 0;
  if (gameId === '3_30' || g.pick === 3) {
    return (
      `🎲 *How to play ${g.name}*\n\n` +
      `Lightning picks. Instant result. No waiting for a draw.\n\n` +
      `*Goal:* Match your *${g.pick}* numbers to the winning set. Even *1 match* can pay!\n\n` +
      `*1.* Choose numbers — pick *exactly ${g.pick}* from *${g.from}–${g.to}* (or Quick Pick).\n` +
      `*2.* Confirm — stake *${formatUsd(g.playCostUsd)}* per line (free tickets used first).\n` +
      `*3.* See the result *instantly*.\n\n` +
      `*Prizes (per line)*\n${prizeLines(g)}\n\n` +
      `Up to *${g.maxLines}* lines. 18+ · Play smart · Stay in control.`
    );
  }
  return (
    `🎯 *How to play ${g.name}*\n\n` +
    `Instant lottery energy — pick your numbers, get the result in seconds.\n\n` +
    `*Goal:* Match your *${g.pick}* numbers to the *${g.pick}* winning numbers. Even *1 match* wins!\n\n` +
    `*1.* Choose numbers — pick *exactly ${g.pick}* from *${g.from}–${g.to}* (or Quick Pick).\n` +
    `*2.* Place your bet — *${formatUsd(g.playCostUsd)}* per line (free tickets first).\n` +
    `*3.* Instant reveal — no waiting.\n\n` +
    `*Prizes (per line)*${multi ? ` — up to *${multi}×* top` : ''}\n${prizeLines(g)}\n\n` +
    `Stack up to *${g.maxLines}* lines. 18+ · Play responsibly.`
  );
}

function welcome(user) {
  const g440 = game('4_40');
  const g330 = game('3_30');
  const locked = Number(user.locked_tickets) || 0;
  const unlocked = Number(user.unlocked_tickets) || 0;
  return (
    `✨ *Welcome to Insta Win*\n\n` +
    `Two instant games. Real USDT. Results in a heartbeat.\n\n` +
    `🎯 *${g440.name}*\n` +
    `   Top prize *${formatUsd(g440.prizesUsd[4])}* · only *${formatUsd(g440.playCostUsd)}*/line\n\n` +
    `🎲 *${g330.name}*\n` +
    `   Top prize *${formatUsd(g330.prizesUsd[3])}* · *${formatUsd(g330.playCostUsd)}*/line\n\n` +
    `💰 Balance: *${formatUsd(user.balance_usd)}*\n` +
    `🎫 Free tickets: *${unlocked}* ready` +
    (locked > 0 ? ` · *${locked}* locked` : '') +
    `\n\n` +
    `💎 Deposit *${formatUsd(config.minDepositUsd)}+* to unlock welcome free tickets.\n` +
    `Tap *Play* — each game has its own guide.\n\n` +
    `⚠️ *18+* · Play responsibly · Set limits · Take breaks`
  );
}

function gamePickerText() {
  const g440 = game('4_40');
  const g330 = game('3_30');
  return (
    `🎰 *Choose your game*\n\n` +
    `🎯 *${g440.name}*\n` +
    `Pick ${g440.pick} from ${g440.from}–${g440.to} · *${formatUsd(g440.playCostUsd)}*/line\n` +
    `${prizeOneLiner(g440)}\n\n` +
    `🎲 *${g330.name}*\n` +
    `Pick ${g330.pick} from ${g330.from}–${g330.to} · *${formatUsd(g330.playCostUsd)}*/line\n` +
    `${prizeOneLiner(g330)}\n\n` +
    `Free tickets burn first. Feeling lucky?`
  );
}

function selectGameBlurb(gameId) {
  const g = game(gameId);
  return (
    `🔥 *${g.name}*\n` +
    `Pick *${g.pick}* from *${g.from}–${g.to}* · *${formatUsd(g.playCostUsd)}*/line\n` +
    `${prizeOneLiner(g)}\n\n` +
    `Build your ticket — Quick Pick or tap the grid.`
  );
}

module.exports = {
  game,
  prizeLines,
  prizeOneLiner,
  howToPlay,
  welcome,
  gamePickerText,
  selectGameBlurb,
};
