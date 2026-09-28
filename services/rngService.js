const crypto = require('crypto');
const { query } = require('../database');

/**
 * Cryptographically stronger draw than Math.random.
 * Returns { numbers, seed, source }
 */
function drawAuto() {
  const seed = crypto.randomBytes(16).toString('hex');
  const pool = Array.from({ length: 40 }, (_, i) => i + 1);
  const result = [];
  let entropy = crypto.createHash('sha256').update(seed).digest();

  for (let i = 0; i < 4; i++) {
    const idx = entropy[i % entropy.length] % pool.length;
    result.push(pool.splice(idx, 1)[0]);
    // remix entropy
    entropy = crypto.createHash('sha256').update(Buffer.concat([entropy, Buffer.from([i])])).digest();
  }

  return {
    numbers: result.sort((a, b) => a - b),
    seed,
    source: 'auto',
  };
}

/**
 * Manual override by admin — audited.
 */
async function drawManual(numbers, adminId, note = '') {
  if (!Array.isArray(numbers) || numbers.length !== 4) {
    throw new Error('Manual draw requires exactly 4 numbers');
  }
  const set = new Set(numbers);
  if (set.size !== 4 || numbers.some((n) => n < 1 || n > 40 || !Number.isInteger(n))) {
    throw new Error('Invalid manual numbers');
  }
  const sorted = [...numbers].sort((a, b) => a - b);
  const seed = `manual:${adminId}:${Date.now()}`;

  await query(
    `INSERT INTO rng_events (source, seed, numbers, admin_id, note)
     VALUES ('manual', $1, $2, $3, $4)`,
    [seed, sorted, adminId, note]
  );

  await query(
    `INSERT INTO audit_logs (actor_id, actor_type, action, target_type, details)
     VALUES ($1, 'admin', 'manual_draw', 'rng', $2)`,
    [adminId, { numbers: sorted, note }]
  );

  return { numbers: sorted, seed, source: 'manual' };
}

async function logRngForTicket(ticketId, draw) {
  await query(
    `INSERT INTO rng_events (ticket_id, source, seed, numbers)
     VALUES ($1::uuid, $2::text, $3::text, $4::int[])`,
    [ticketId, draw.source, draw.seed, draw.numbers]
  );
}

/** Pending manual override for next play (admin sets, consumed once) */
let pendingOverride = null;

function setPendingOverride(numbers, adminId, note) {
  pendingOverride = { numbers, adminId, note, setAt: Date.now() };
}

function consumePendingOverride() {
  if (!pendingOverride) return null;
  // expire after 5 minutes
  if (Date.now() - pendingOverride.setAt > 5 * 60 * 1000) {
    pendingOverride = null;
    return null;
  }
  const o = pendingOverride;
  pendingOverride = null;
  return o;
}

async function getNextDraw(adminIdForManual = null) {
  const pending = consumePendingOverride();
  if (pending) {
    return drawManual(pending.numbers, pending.adminId, pending.note);
  }
  return drawAuto();
}

module.exports = {
  drawAuto,
  drawManual,
  logRngForTicket,
  setPendingOverride,
  consumePendingOverride,
  getNextDraw,
};
