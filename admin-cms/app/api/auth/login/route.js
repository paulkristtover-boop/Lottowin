import { NextResponse } from 'next/server';
import { createToken, checkCredentials } from '@/lib/auth';

export async function POST(req) {
  const body = await req.json();
  if (!checkCredentials(body.user, body.pass)) {
    return NextResponse.json({ error: 'Invalid' }, { status: 401 });
  }
  const token = await createToken({ role: 'admin' });
  const res = NextResponse.json({ ok: true });
  res.cookies.set('cms_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 12,
    path: '/',
  });
  return res;
}
