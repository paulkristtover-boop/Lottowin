const { query } = require('../database');

async function get(key, defaultValue = null) {
  const res = await query(`SELECT value FROM settings WHERE key = $1`, [key]);
  if (res.rows[0]) return res.rows[0].value;
  return defaultValue;
}

async function set(key, value) {
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    [key, value]
  );
}

module.exports = { get, set };
