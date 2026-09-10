// lib/authToken.js
// A small, dependency-free signed token (similar idea to a JWT) so the
// backend can tell that a write request really came from someone who logged
// in through /api/login, without storing sessions in a database.
//
// Token shape: base64url(payloadJSON) + "." + hex HMAC-SHA256 signature
// Signed with ADMIN_ACTION_SECRET (set in Vercel Environment Variables).

const crypto = require('crypto');

const TOKEN_LIFETIME_MS = 12 * 60 * 60 * 1000; // 12 hours

function getSecret() {
  const secret = process.env.ADMIN_ACTION_SECRET;
  if (!secret) {
    throw new Error(
      'ADMIN_ACTION_SECRET environment variable is missing. ' +
      'Add it in Vercel Project Settings -> Environment Variables.'
    );
  }
  return secret;
}

function base64url(input) {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64urlDecode(input) {
  let padded = input.replace(/-/g, '+').replace(/_/g, '/');
  while (padded.length % 4) padded += '=';
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(payload) {
  return crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
}

function issueToken(member) {
  const payload = base64url(JSON.stringify({
    name: member.name,
    role: member.role,
    iat: Date.now(),
    exp: Date.now() + TOKEN_LIFETIME_MS
  }));
  return `${payload}.${sign(payload)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;

  const [payload, signature] = token.split('.');
  const expected = sign(payload);

  const a = Buffer.from(signature || '', 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  let data;
  try {
    data = JSON.parse(base64urlDecode(payload));
  } catch (err) {
    return null;
  }

  if (!data.exp || Date.now() > data.exp) return null; // expired
  return data;
}

module.exports = { issueToken, verifyToken };
