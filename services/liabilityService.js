const { query } = require('../database');
const config = require('../config');

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

async function getTodayPrizesPaid() {
  const d = todayUTC();
  const res = await query(
    `SELECT prizes_paid FROM daily_liability WHERE period_date = $1`,
    [d]
  );
  return res.rows[0] ? Number(res.rows[0].prizes_paid) : 0;
}

/**
 * Tiered payout grader + liability caps.
 * Returns { prize, beforeCap, capped, tier }
 */
function gradePayout(matches, stakeUsd = config.playCostUsd) {
  const base = config.prizesUsd[matches] ?? 0;
  let prize = base;
  let tier = `match_${matches}`;

  // Per-line hard cap
  if (prize > config.maxPrizePerLineUsd) {
    prize = config.maxPrizePerLineUsd;
    tier = 'line_capped';
  }

  return { prize, beforeCap: base, tier };
}

/**
 * Apply ticket-level and daily liability caps across all line prizes.
 */
async function applyTicketLiability(lineResults) {
  let totalBefore = 0;
  let totalAfter = 0;
  let anyCapped = false;

  const graded = lineResults.map((r) => {
    const g = gradePayout(r.matches);
    totalBefore += g.beforeCap;
    return { ...r, prize: g.prize, beforeCap: g.beforeCap, tier: g.tier };
  });

  // Ticket-level cap
  if (totalBefore > config.maxPrizePerTicketUsd) {
    const scale = config.maxPrizePerTicketUsd / totalBefore;
    for (const g of graded) {
      g.prize = Math.round(g.prize * scale * 100) / 100;
    }
    anyCapped = true;
  }

  totalAfter = graded.reduce((s, g) => s + g.prize, 0);

  // Daily liability cap
  const paidToday = await getTodayPrizesPaid();
  const remaining = Math.max(0, config.dailyLiabilityCapUsd - paidToday);

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
  await query(
    `INSERT INTO daily_liability (period_date, prizes_paid, tickets, capped_count, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (period_date) DO UPDATE SET
       prizes_paid = daily_liability.prizes_paid + $2,
       tickets = daily_liability.tickets + $3,
       capped_count = daily_liability.capped_count + $4,
       updated_at = NOW()`,
    [d, amount, ticketCount, capped ? 1 : 0]
  );
}

module.exports = {
  gradePayout,
  applyTicketLiability,
  recordPrizesPaid,
  getTodayPrizesPaid,
  todayUTC,
};
