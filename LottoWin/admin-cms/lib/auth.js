import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.CMS_SECRET || 'change-me');

export async function createToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('12h')
    .sign(secret);
}

export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, secret);
  return payload;
}

export function checkCredentials(user, pass) {
  return (
    user === (process.env.CMS_ADMIN_USER || 'admin') &&
    pass === (process.env.CMS_ADMIN_PASS || 'admin')
  );
}
