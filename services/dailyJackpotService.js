const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const config = require('../config');
const { query, getClient } = require('../database');
const logger = require('../utils/logger');
const { formatUsd } = require('../utils/helpers');

function todayDateUtc() {
  return new Date().toISOString().slice(0, 10);
}

function salesCloseFor(drawDateStr) {
  const [y, m, d] = drawDateStr.split('-').map(Number);
  const close = new Date(Date.UTC(y, m - 1, d, config.drawHourUtc, 0, 0));
  close.setUTCMinutes(close.getUTCMinutes() - (config.salesCloseMinutesBefore || 60));
  return close;
}

function drawTimeFor(drawDateStr) {
  const [y, m, d] = drawDateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, config.drawHourUtc, 0, 0));
}

function pickRandomNumbers(count, from, to) {
  const pool = [];
  for (let i = from; i <= to; i++) pool.push(i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

function countMatches(a, b) {
  const set = new Set(b);
  return a.filter((n) => set.has(n)).length;
}

async function getOrCreateOpenDraw() {
  const date = todayDateUtc();
  let res = await query(`SELECT * FROM draws WHERE draw_date = $1`, [date]);
  if (res.rows[0]) return res.rows[0];

  // rollover from last drawn unpaid residual pot
  let rollover = 0;
  const prev = await query(
    `SELECT pot_usd, jackpot_paid_usd, status FROM draws
     WHERE status = 'drawn' ORDER BY draw_date DESC LIMIT 1`
  );
  if (prev.rows[0] && Number(prev.rows[0].jackpot_paid_usd) === 0) {
    rollover = Number(prev.rows[0].pot_usd) || 0;
  } else if (prev.rows[0] && Number(prev.rows[0].winners_count) === 0) {
    rollover = Number(prev.rows[0].pot_usd) || 0;
  }

  const close = salesCloseFor(date);
  res = await query(
    `INSERT INTO draws (id, draw_date, status, sales_close_at, pot_usd, rollover_in_usd)
     VALUES ($1, $2, 'open', $3, $4, $4)
     ON CONFLICT (draw_date) DO UPDATE SET draw_date = EXCLUDED.draw_date
     RETURNING *`,
    [uuidv4(), date, close.toISOString(), rollover]
  );
  return res.rows[0];
}

async function getOpenDraw() {
  const d = await getOrCreateOpenDraw();
  const now = Date.now();
  if (d.status === 'open' && new Date(d.sales_close_at).getTime() <= now) {
    await query(`UPDATE draws SET status = 'closed' WHERE id = $1 AND status = 'open'`, [d.id]);
    d.status = 'closed';
  }
  return d;
}

function isSalesOpen(draw) {
  return draw.status === 'open' && new Date(draw.sales_close_at).getTime() > Date.now();
}

async function buyLines(telegramId, lines) {
  // lines = array of number arrays
  const game = config.game;
  const draw = await getOpenDraw();
  if (!isSalesOpen(draw)) {
    throw new Error('Sales closed for today. Come back after the draw for the next day.');
  }
  if (!lines.length) throw new Error('Add at least one line');
  if (lines.length > config.maxLinesPerUserPerDraw) {
    throw new Error(`Max ${config.maxLinesPerUserPerDraw} lines per draw`);
  }

  for (const nums of lines) {
    if (nums.length !== game.pick) throw new Error(`Each line needs exactly ${game.pick} numbers`);
    const set = new Set(nums);
    if (set.size !== nums.length) throw new Error('Numbers must be unique in a line');
    for (const n of nums) {
      if (n < game.from || n > game.to) throw new Error(`Numbers must be ${game.from}–${game.to}`);
    }
  }

  const existing = await query(
    `SELECT COUNT(*)::int AS c FROM jackpot_lines WHERE draw_id = $1 AND user_id = $2`,
    [draw.id, telegramId]
  );
  if (existing.rows[0].c + lines.length > config.maxLinesPerUserPerDraw) {
    throw new Error(`Max ${config.maxLinesPerUserPerDraw} lines per draw (you already have ${existing.rows[0].c})`);
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');
    const u = await client.query(`SELECT * FROM users WHERE telegram_id = $1 FOR UPDATE`, [telegramId]);
    if (!u.rows[0]) throw new Error('User not found');
    let free = Number(u.rows[0].free_lines) || 0;
    let balance = Number(u.rows[0].balance_usd) || 0;
    const price = config.ticketPriceUsd;
    let cashNeed = 0;
    let freeUsed = 0;
    for (let i = 0; i < lines.length; i++) {
      if (free > 0) {
        free -= 1;
        freeUsed += 1;
      } else {
        cashNeed += price;
      }
    }
    if (balance < cashNeed) throw new Error(`Insufficient balance. Need ${formatUsd(cashNeed)}`);

    const jackpotAdd = cashNeed * (config.jackpotSharePercent / 100);
    const houseAdd = cashNeed * (config.houseSharePercent / 100);

    if (cashNeed > 0) {
      await client.query(
        `UPDATE users SET balance_usd = balance_usd - $1, total_wagered = total_wagered + $1,
         free_lines = $2, updated_at = NOW() WHERE telegram_id = $3`,
        [cashNeed, free, telegramId]
      );
    } else {
      await client.query(
        `UPDATE users SET free_lines = $1, updated_at = NOW() WHERE telegram_id = $2`,
        [free, telegramId]
      );
    }

    for (let i = 0; i < lines.length; i++) {
      const nums = [...lines[i]].sort((a, b) => a - b);
      const usedFree = i < freeUsed;
      await client.query(
        `INSERT INTO jackpot_lines (id, draw_id, user_id, numbers, cost_usd, used_free)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [uuidv4(), draw.id, telegramId, nums, usedFree ? 0 : price, usedFree]
      );
    }

    await client.query(
      `UPDATE draws SET
         pot_usd = pot_usd + $1,
         sales_usd = sales_usd + $2,
         house_usd = house_usd + $3,
         tickets_sold = tickets_sold + $4
       WHERE id = $5`,
      [jackpotAdd, cashNeed, houseAdd, lines.length, draw.id]
    );

    await client.query('COMMIT');
    const updated = await query(`SELECT * FROM draws WHERE id = $1`, [draw.id]);
    return {
      lines: lines.length,
      cashPaid: cashNeed,
      freeUsed,
      draw: updated.rows[0],
    };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function runDraw(drawDate) {
  const date = drawDate || todayDateUtc();
  const res = await query(`SELECT * FROM draws WHERE draw_date = $1`, [date]);
  const draw = res.rows[0];
  if (!draw) throw new Error('No draw for date');
  if (draw.status === 'drawn' || draw.status === 'paid') return draw;

  await query(`UPDATE draws SET status = 'closed' WHERE id = $1 AND status = 'open'`, [draw.id]);

  const game = config.game;
  const seed = crypto.randomBytes(16).toString('hex');
  const winning = pickRandomNumbers(game.pick, game.from, game.to);

  const lines = await query(`SELECT * FROM jackpot_lines WHERE draw_id = $1`, [draw.id]);
  const pot = Number(draw.pot_usd) || 0;
  const jackpotWinners = [];

  for (const line of lines.rows) {
    const matches = countMatches(line.numbers, winning);
    let prize = 0;
    let freeWon = false;
    if (matches === game.pick) {
      jackpotWinners.push(line);
    } else if (matches >= (config.freeTicketMatch || 3)) {
      freeWon = true;
    }
    await query(
      `UPDATE jackpot_lines SET matches = $1, prize_usd = $2, free_line_won = $3 WHERE id = $4`,
      [matches, prize, freeWon, line.id]
    );
    if (freeWon) {
      await query(
        `UPDATE users SET free_lines = free_lines + 1 WHERE telegram_id = $1`,
        [line.user_id]
      );
    }
  }

  let paid = 0;
  if (jackpotWinners.length > 0 && pot > 0) {
    const each = pot / jackpotWinners.length;
    for (const w of jackpotWinners) {
      await query(`UPDATE jackpot_lines SET prize_usd = $1 WHERE id = $2`, [each, w.id]);
      await query(
        `UPDATE users SET balance_usd = balance_usd + $1, total_won = total_won + $1 WHERE telegram_id = $2`,
        [each, w.user_id]
      );
      paid += each;
    }
  }

  await query(
    `UPDATE draws SET status = 'drawn', drawn_at = NOW(), winning_numbers = $1,
     winners_count = $2, jackpot_paid_usd = $3, rng_seed = $4 WHERE id = $5`,
    [winning, jackpotWinners.length, paid, seed, draw.id]
  );

  return (await query(`SELECT * FROM draws WHERE id = $1`, [draw.id])).rows[0];
}

async function statusText() {
  const draw = await getOpenDraw();
  const game = config.game;
  const open = isSalesOpen(draw);
  const closeAt = new Date(draw.sales_close_at).toISOString().replace('T', ' ').slice(0, 16);
  return (
    `🎰 *${game.name}*\n\n` +
    `Draw date: *${draw.draw_date}*\n` +
    `Status: *${open ? 'OPEN — buy lines' : draw.status}*\n` +
    `Live pot: *${formatUsd(draw.pot_usd)}*\n` +
    `Lines sold: *${draw.tickets_sold}*\n` +
    `Ticket: *${formatUsd(config.ticketPriceUsd)}* / line\n` +
    `Pick *${game.pick}* from *${game.from}–${game.to}*\n` +
    (open ? `Sales close: *${closeAt} UTC*\n` : '') +
    `\nJackpot = *${config.jackpotSharePercent}%* of cash sales + rollover (no seed).\n` +
    `Match ${game.pick} → share the pot · Match ${config.freeTicketMatch}+ → free line next draw\n` +
    `18+ · Play responsibly`
  );
}

module.exports = {
  getOrCreateOpenDraw,
  getOpenDraw,
  isSalesOpen,
  buyLines,
  runDraw,
  statusText,
  pickRandomNumbers,
  todayDateUtc,
  salesCloseFor,
};
