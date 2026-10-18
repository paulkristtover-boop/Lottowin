const config = require('../config');
const logger = require('../utils/logger');
const { query } = require('../database');
const { formatUsd } = require('../utils/helpers');
const dailyJackpot = require('./dailyJackpotService');

function channelId() {
  return process.env.TELEGRAM_CHANNEL_ID || config.telegramChannelId || '';
}

async function logPost(kind, body) {
  try {
    await query(`INSERT INTO channel_posts (kind, body) VALUES ($1, $2)`, [kind, body]);
  } catch (e) {
    logger.warn('channel_posts log', e.message);
  }
}

async function post(bot, text, kind = 'text') {
  const id = channelId();
  if (!id || !bot?.telegram) {
    logger.warn('Channel post skipped');
    return false;
  }
  try {
    await bot.telegram.sendMessage(id, text, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    });
    await logPost(kind, text);
    return true;
  } catch (e) {
    logger.error('Channel post failed', e.message);
    return false;
  }
}

async function postPotUpdate(bot) {
  const draw = await dailyJackpot.getOpenDraw();
  const open = dailyJackpot.isSalesOpen(draw);
  const text =
    `💰 *Daily pot update*\n\n` +
    `Draw *${draw.draw_date}*\n` +
    `Pot: *${formatUsd(draw.pot_usd)}*\n` +
    `Lines: *${draw.tickets_sold}*\n` +
    `Sales: *${open ? 'OPEN' : 'CLOSED'}*\n\n` +
    `Ticket ${formatUsd(config.ticketPriceUsd)} · Play in the bot\n18+`;
  return post(bot, text, 'pot');
}

async function postDrawResult(bot, draw) {
  const nums = (draw.winning_numbers || []).join(', ');
  const text =
    `🎲 *Draw result — ${draw.draw_date}*\n\n` +
    `Winning numbers: *${nums}*\n` +
    `Pot: *${formatUsd(draw.pot_usd)}*\n` +
    `Jackpot winners: *${draw.winners_count}*\n` +
    `Paid out: *${formatUsd(draw.jackpot_paid_usd)}*\n\n` +
    (draw.winners_count === 0
      ? `_No jackpot hit — pot rolls to next draw._\n\n`
      : `_Winners credited to in-app balance._\n\n`) +
    `Next draw: buy lines in the bot · 18+`;
  return post(bot, text, 'result');
}

module.exports = {
  post,
  postPotUpdate,
  postDrawResult,
  channelId,
  logPost,
};
