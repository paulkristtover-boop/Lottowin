import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

function asBool(v) {
  if (v === true || v === false) return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true' || v === '1';
  if (v && typeof v === 'object' && 'value' in v) return asBool(v.value);
  return false;
}

function asString(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  return String(v);
}

async function getFlag() {
  try {
    const res = await query(`SELECT value FROM settings WHERE key = 'maintenance_mode'`);
    return asBool(res.rows[0]?.value);
  } catch {
    return false;
  }
}

export async function GET() {
  const on = await getFlag();
  let message = '';
  try {
    const m = await query(`SELECT value FROM settings WHERE key = 'maintenance_message'`);
    message = asString(m.rows[0]?.value);
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

    // value column is JSONB — pass proper JSON text
    await query(
      `INSERT INTO settings (key, value, updated_at) VALUES ('maintenance_mode', $1::jsonb, NOW())
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
      [JSON.stringify(on)]
    );
    if (message != null) {
      await query(
        `INSERT INTO settings (key, value, updated_at) VALUES ('maintenance_message', $1::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_at = NOW()`,
        [JSON.stringify(message)]
      );
    }
    return NextResponse.json({ ok: true, maintenance: on });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
