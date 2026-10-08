const { query } = require('../database');

/**
 * settings.value is JSONB — always read/write valid JSON.
 */
function toJsonbParam(value) {
  // node-pg: pass JS values; for strings use JSON string so JSONB accepts them
  if (value === undefined) return null;
  return JSON.stringify(value);
}

function fromJsonb(raw) {
  if (raw === null || raw === undefined) return null;
  // pg may already parse JSONB to object/boolean/number/string
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    // accidental wrap like { value: true } — uncommon
    return raw;
  }
  return raw;
}

async function get(key, defaultValue = null) {
  const res = await query(`SELECT value FROM settings WHERE key = $1`, [key]);
  if (!res.rows[0]) return defaultValue;
  return fromJsonb(res.rows[0].value);
}

async function set(key, value) {
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
    [key, toJsonbParam(value)]
  );
}

/** Coerce maintenance flag from JSONB boolean or string */
function asBool(v) {
  if (v === true || v === false) return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
  if (typeof v === 'number') return v !== 0;
  return false;
}

function asString(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

module.exports = { get, set, asBool, asString, toJsonbParam };
