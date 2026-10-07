const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.nodeEnv === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
});

pool.on('error', (err) => {
  console.error('Unexpected PG error', err);
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 200) {
    console.warn('Slow query', { text: text.slice(0, 80), duration, rows: res.rowCount });
  }
  return res;
}

async function getClient() {
  return pool.connect();
}

module.exports = { pool, query, getClient };
