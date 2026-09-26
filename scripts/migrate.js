require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../database');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, '../postgres/schema.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration completed successfully');
  } catch (e) {
    console.error('Migration failed', e);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
