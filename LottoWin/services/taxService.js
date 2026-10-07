const { query } = require('../database');
const config = require('../config');

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Record wager + prize for gaming tax (GGR × tax rate).
 * GGR = gross wagered − prizes paid
 *
 * IMPORTANT: All arithmetic is done in JS. Never write `$1 - $2` in SQL
 * with untyped params — Postgres raises:
 *   operator is not unique: unknown - unknown
 */
async function recordPlay(wageredUsd, prizesUsd) {
  const d = todayUTC();
  const rate = Number(config.gamingTaxRate) || 0.11;
  const wagered = Number(wageredUsd) || 0;
  const prizes = Number(prizesUsd) || 0;
  const ggr = wagered - prizes;
  const tax = ggr * rate;

  await query(
    `INSERT INTO tax_ledger (
       period_date, gross_wagered, gross_prizes, ggr, tax_rate, tax_amount, ticket_count, updated_at
     ) VALUES (
       $1::date, $2::numeric, $3::numeric, $4::numeric, $5::numeric, $6::numeric, 1, NOW()
     )
     ON CONFLICT (period_date) DO UPDATE SET
       gross_wagered = tax_ledger.gross_wagered + EXCLUDED.gross_wagered,
       gross_prizes  = tax_ledger.gross_prizes  + EXCLUDED.gross_prizes,
       ggr           = tax_ledger.gross_wagered + EXCLUDED.gross_wagered
                     - (tax_ledger.gross_prizes  + EXCLUDED.gross_prizes),
       tax_amount    = (
                         tax_ledger.gross_wagered + EXCLUDED.gross_wagered
                       - (tax_ledger.gross_prizes  + EXCLUDED.gross_prizes)
                       ) * COALESCE(tax_ledger.tax_rate, EXCLUDED.tax_rate),
       ticket_count  = tax_ledger.ticket_count + 1,
       updated_at    = NOW()`,
    [d, wagered, prizes, ggr, rate, tax]
  );
}

async function getLedger(fromDate, toDate) {
  const res = await query(
    `SELECT * FROM tax_ledger
     WHERE period_date >= $1::date AND period_date <= $2::date
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
