const { query } = require('../database');
const config = require('../config');

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

async function getTodayPrizesPaid() {
  const d = todayUTC();
  const res = await query(
    `SELECT prizes_paid FROM daily_liability WHERE period_date = $1::date`,
    [d]
  );
  return res.rows[0] ? Number(res.rows[0].prizes_paid) : 0;
}

/**
 * Tiered payout grader + liability caps.
 */
function gradePayout(matches, game) {
  const prizes = (game && game.prizesUsd) || config.prizesUsd;
  const maxLine = Number((game && game.maxPrizePerLineUsd) || config.maxPrizePerLineUsd);
  const base = Number(prizes[matches] ?? 0);
  let prize = base;
  let tier = `match_${matches}`;

  if (prize > maxLine) {
    prize = maxLine;
    tier = 'line_capped';
  }

  return { prize, beforeCap: base, tier };
}

async function applyTicketLiability(lineResults, game) {
  let totalBefore = 0;
  let anyCapped = false;
  const maxTicket = Number(config.maxPrizePerTicketUsd);

  const graded = lineResults.map((r) => {
    const g = gradePayout(r.matches, game);
    totalBefore += g.beforeCap;
    return { ...r, prize: g.prize, beforeCap: g.beforeCap, tier: g.tier };
  });

  if (totalBefore > maxTicket) {
    const scale = maxTicket / totalBefore;
    for (const g of graded) {
      g.prize = Math.round(g.prize * scale * 100) / 100;
    }
    anyCapped = true;
  }

  let totalAfter = graded.reduce((s, g) => s + g.prize, 0);

  const paidToday = await getTodayPrizesPaid();
  const remaining = Math.max(0, Number(config.dailyLiabilityCapUsd) - paidToday);

  if (totalAfter > remaining) {
    if (remaining <= 0) {
      for (const g of graded) g.prize = 0;
      totalAfter = 0;
    } else {
      const scale = remaining / totalAfter;
      for (const g of graded) {
        g.prize = Math.round(g.prize * scale * 100) / 100;
      }
      totalAfter = graded.reduce((s, g) => s + g.prize, 0);
    }
    anyCapped = true;
  }

  return {
    lines: graded,
    totalPrize: totalAfter,
    prizeBeforeCap: totalBefore,
    liabilityCapped: anyCapped,
  };
}

async function recordPrizesPaid(amount, ticketCount = 1, capped = false) {
  const d = todayUTC();
  const amt = Number(amount) || 0;
  const tickets = Number(ticketCount) || 1;
  const capInc = capped ? 1 : 0;

  await query(
    `INSERT INTO daily_liability (period_date, prizes_paid, tickets, capped_count, updated_at)
     VALUES ($1::date, $2::numeric, $3::int, $4::int, NOW())
     ON CONFLICT (period_date) DO UPDATE SET
       prizes_paid  = daily_liability.prizes_paid  + EXCLUDED.prizes_paid,
       tickets      = daily_liability.tickets      + EXCLUDED.tickets,
       capped_count = daily_liability.capped_count + EXCLUDED.capped_count,
       updated_at   = NOW()`,
    [d, amt, tickets, capInc]
  );
}

module.exports = {
  gradePayout,
  applyTicketLiability,
  recordPrizesPaid,
  getTodayPrizesPaid,
  todayUTC,
};
