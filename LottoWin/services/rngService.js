const crypto = require('crypto');
const { query } = require('../database');

function drawAuto(pick = 4, poolSize = 40) {
  const seed = crypto.randomBytes(16).toString('hex');
  const pool = Array.from({ length: poolSize }, (_, i) => i + 1);
  const result = [];
  let entropy = crypto.createHash('sha256').update(seed).digest();

  for (let i = 0; i < pick; i++) {
    const idx = entropy[i % entropy.length] % pool.length;
    result.push(pool.splice(idx, 1)[0]);
    entropy = crypto.createHash('sha256').update(Buffer.concat([entropy, Buffer.from([i])])).digest();
  }

  return {
    numbers: result.sort((a, b) => a - b),
    seed,
    source: 'auto',
  };
}

let pendingOverride = null; // { numbers, adminId, note, expires, pick }

function setPendingOverride(numbers, adminId, note = '') {
  if (!Array.isArray(numbers) || numbers.length < 3) {
    throw new Error('Override requires the correct count of numbers for the game');
  }
  const sorted = [...numbers].map(Number).sort((a, b) => a - b);
  pendingOverride = {
    numbers: sorted,
    adminId,
    note,
    pick: sorted.length,
    expires: Date.now() + 5 * 60 * 1000,
  };
}

async function getNextDraw(game) {
  const pick = game?.pick || 4;
  const poolSize = game?.to || 40;

  if (
    pendingOverride &&
    pendingOverride.expires > Date.now() &&
    pendingOverride.pick === pick
  ) {
    const o = pendingOverride;
    pendingOverride = null;
    return {
      numbers: o.numbers,
      seed: `manual:${o.adminId}:${Date.now()}`,
      source: 'manual',
    };
  }

  return drawAuto(pick, poolSize);
}

async function logRngForTicket(ticketId, draw) {
  await query(
    `INSERT INTO rng_events (ticket_id, source, seed, numbers)
     VALUES ($1::uuid, $2::text, $3::text, $4::int[])`,
    [ticketId, draw.source, draw.seed, draw.numbers]
  ).catch(() => {});
}

module.exports = {
  drawAuto,
  getNextDraw,
  setPendingOverride,
  logRngForTicket,
};
