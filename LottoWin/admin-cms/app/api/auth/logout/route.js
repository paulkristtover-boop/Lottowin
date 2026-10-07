import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.redirect(new URL('/login', process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'));
  res.cookies.set('cms_token', '', { maxAge: 0, path: '/' });
  return res;
}
