import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

function adminIds() {
  return (process.env.ADMIN_IDS || '')
    .split(',')
    .map((s) => Number(s.trim()))
    .filter(Boolean);
}

function officialEnvelope(body) {
  return (
    `📩 *Official message from LottoWin Support*\n` +
    `━━━━━━━━━━━━━━\n` +
    `${body}\n` +
    `━━━━━━━━━━━━━━\n` +
    `_This message was sent through the official bot only.\n` +
    `We will never ask for your seed phrase, private key, or password.\n` +
    `Ignore anyone claiming to be admin in private chat outside this bot._`
  );
}

export async function POST(req) {
  try {
    const body = await req.json();
    const telegramId = Number(body.telegramId);
    const message = (body.message || '').trim();
    if (!telegramId || !message) {
      return NextResponse.json({ error: 'telegramId and message required' }, { status: 400 });
    }
    if (adminIds().includes(telegramId)) {
      return NextResponse.json({ error: 'Cannot message admin accounts' }, { status: 400 });
    }

    const token = process.env.BOT_TOKEN;
    if (!token) return NextResponse.json({ error: 'BOT_TOKEN not set on CMS' }, { status: 500 });

    const text = officialEnvelope(message);
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    let res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: telegramId, text, parse_mode: 'Markdown' }),
    });
    if (!res.ok) {
      res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: telegramId, text }),
      });
    }

    await query(
      `INSERT INTO audit_logs (actor_id, actor_type, action, target_type, target_id, details)
       VALUES (0, 'admin', 'official_dm', 'user', $1, $2)`,
      [String(telegramId), { preview: message.slice(0, 200), via: 'cms' }]
    );

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: 'Delivery failed', detail: err }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
