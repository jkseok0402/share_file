import crypto from 'crypto';

const SESSION_MS = 8 * 60 * 60 * 1000;

function b64u(str) {
  return Buffer.from(str).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function fromb64u(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/');
  const rem = s.length % 4;
  if (rem) s += '='.repeat(4 - rem);
  return Buffer.from(s, 'base64').toString('utf8');
}

export function createToken() {
  const payload = b64u(JSON.stringify({ exp: Date.now() + SESSION_MS }));
  const sig = crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'changeme')
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

export function verifyToken(authHeader) {
  if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig     = token.slice(dot + 1);
  const expected = crypto
    .createHmac('sha256', process.env.SESSION_SECRET || 'changeme')
    .update(payload)
    .digest('hex');
  if (sig !== expected) return false;
  try {
    const { exp } = JSON.parse(fromb64u(payload));
    return typeof exp === 'number' && Date.now() < exp;
  } catch {
    return false;
  }
}
