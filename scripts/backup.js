require('dotenv').config();
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const outDir = path.join(__dirname, '../backups');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const file = path.join(outDir, `lottowin-${stamp}.sql`);

const cmd = `pg_dump "${process.env.DATABASE_URL}" > "${file}"`;

exec(cmd, (err) => {
  if (err) {
    console.error('Backup failed', err);
    process.exit(1);
  }
  console.log('Backup written to', file);
});
