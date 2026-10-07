/**
 * Rank prize ratios from operator table.
 * Absolute USD = (rankShare / totalShare) * configured pool.
 * Source totals: daily $2630 / 100 ranks, weekly $1100 / 20 ranks.
 */

/** @type {number[]} */
const DAILY_WAGER_WEIGHTS = (() => {
  const w = [];
  w.push(500, 250, 100, 75, 75);
  for (let i = 0; i < 4; i++) w.push(50); // 6-9
  for (let i = 0; i < 41; i++) w.push(30); // 10-50
  for (let i = 0; i < 30; i++) w.push(5); // 51-80
  for (let i = 0; i < 20; i++) w.push(2.5); // 81-100
  return w;
})();

/** @type {number[]} */
const WEEKLY_REFERRAL_WEIGHTS = [
  400, 200, 100, 50, 40, 40, 30, 30, 30, 30, 20, 20, 20, 20, 20, 10, 10, 10, 10, 10,
];

function scalePrizes(weights, poolUsd) {
  const total = weights.reduce((a, b) => a + b, 0);
  const pool = Number(poolUsd) || 0;
  return weights.map((w, i) => ({
    rank: i + 1,
    weight: w,
    prizeUsd: total > 0 ? Math.round((w / total) * pool * 1e6) / 1e6 : 0,
  }));
}

module.exports = {
  DAILY_WAGER_WEIGHTS,
  WEEKLY_REFERRAL_WEIGHTS,
  scalePrizes,
  DAILY_WEIGHT_SUM: DAILY_WAGER_WEIGHTS.reduce((a, b) => a + b, 0),
  WEEKLY_WEIGHT_SUM: WEEKLY_REFERRAL_WEIGHTS.reduce((a, b) => a + b, 0),
};
