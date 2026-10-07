import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { randomUUID } from 'crypto';

function adminIds() {
  return (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter(Boolean);
}

async function getAudience(audience) {
  const admins = adminIds();
  const params = [admins.length ? admins : [0]];
  let sql = `SELECT telegram_id FROM users WHERE is_banned = FALSE AND telegram_id != ALL($1::bigint[])`;
  if (audience === 'active') sql += ` AND last_active_at > NOW() - INTERVAL '7 days'`;
  if (audience === 'depositors') sql += ` AND total_deposited > 0`;
  const res = await query(sql, params);
  return res.rows.map((r) => Number(r.telegram_id));
}

async function sendTelegram(chatId, text) {
  const token = process.env.BOT_TOKEN;
  if (!token) throw new Error('BOT_TOKEN not set on CMS');
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  let res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
  });
  if (!res.ok) {
    // retry plain
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }
  return res.ok;
}

export async function POST(req) {
  try {
    const body = await req.json();
    const message = (body.message || '').trim();
    const audience = body.audience || 'all';
    if (!message) return NextResponse.json({ error: 'Message required' }, { status: 400 });

    const id = randomUUID();
    await query(
      `INSERT INTO broadcasts (id, title, message, audience, status, created_by)
       VALUES ($1, $2, $3, $4, 'sending', 0)`,
      [id, body.title || null, message, audience]
    );

    const ids = await getAudience(audience);
    let sent = 0;
    let fail = 0;
    for (const tid of ids) {
      const ok = await sendTelegram(tid, message);
      if (ok) sent += 1;
      else fail += 1;
      await new Promise((r) => setTimeout(r, 40));
    }

    await query(
      `UPDATE broadcasts SET status = 'done', sent_count = $2, fail_count = $3, completed_at = NOW() WHERE id = $1`,
      [id, sent, fail]
    );

    return NextResponse.json({ id, sent, fail, total: ids.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
