import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function getFlag() {
  try {
    const res = await query(`SELECT value FROM settings WHERE key = 'maintenance_mode'`);
    return String(res.rows[0]?.value || 'false').toLowerCase() === 'true';
  } catch {
    return false;
  }
}

export async function GET() {
  const on = await getFlag();
  let message = '';
  try {
    const m = await query(`SELECT value FROM settings WHERE key = 'maintenance_message'`);
    message = m.rows[0]?.value || '';
  } catch {
    /* ignore */
  }
  return NextResponse.json({ maintenance: on, message });
}

export async function POST(req) {
  try {
    const body = await req.json();
    const on = !!body.on;
    const message = body.message != null ? String(body.message) : null;

    await query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('maintenance_mode', $1, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [on ? 'true' : 'false']
    );
    if (message != null) {
      await query(
        `INSERT INTO settings (key, value, updated_at) VALUES ('maintenance_message', $1, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [message]
      );
    }
    return NextResponse.json({ ok: true, maintenance: on });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
