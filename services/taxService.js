const { query } = require('../database');
const config = require('../config');

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Record wager + prize for gaming tax (GGR × tax rate).
 * GGR = gross wagered − prizes paid
 */
async function recordPlay(wageredUsd, prizesUsd) {
  const d = todayUTC();
  const rate = config.gamingTaxRate;

  await query(
    `INSERT INTO tax_ledger (period_date, gross_wagered, gross_prizes, ggr, tax_rate, tax_amount, ticket_count, updated_at)
     VALUES ($1, $2, $3, $2 - $3, $4, ($2 - $3) * $4, 1, NOW())
     ON CONFLICT (period_date) DO UPDATE SET
       gross_wagered = tax_ledger.gross_wagered + $2,
       gross_prizes = tax_ledger.gross_prizes + $3,
       ggr = (tax_ledger.gross_wagered + $2) - (tax_ledger.gross_prizes + $3),
       tax_amount = ((tax_ledger.gross_wagered + $2) - (tax_ledger.gross_prizes + $3)) * $4,
       ticket_count = tax_ledger.ticket_count + 1,
       updated_at = NOW()`,
    [d, wageredUsd, prizesUsd, rate]
  );
}

async function getLedger(fromDate, toDate) {
  const res = await query(
    `SELECT * FROM tax_ledger
     WHERE period_date >= $1 AND period_date <= $2
     ORDER BY period_date ASC`,
    [fromDate, toDate]
  );
  return res.rows;
}

async function exportCsv(fromDate, toDate) {
  const rows = await getLedger(fromDate, toDate);
  const header = 'date,gross_wagered,gross_prizes,ggr,tax_rate,tax_amount,ticket_count\n';
  const body = rows
    .map(
      (r) =>
        `${r.period_date},${r.gross_wagered},${r.gross_prizes},${r.ggr},${r.tax_rate},${r.tax_amount},${r.ticket_count}`
    )
    .join('\n');
  return header + body;
}

async function summary() {
  const res = await query(
    `SELECT
       COALESCE(SUM(gross_wagered),0) AS wagered,
       COALESCE(SUM(gross_prizes),0) AS prizes,
       COALESCE(SUM(ggr),0) AS ggr,
       COALESCE(SUM(tax_amount),0) AS tax,
       COALESCE(SUM(ticket_count),0) AS tickets
     FROM tax_ledger`
  );
  return res.rows[0];
}

module.exports = {
  recordPlay,
  getLedger,
  exportCsv,
  summary,
};
