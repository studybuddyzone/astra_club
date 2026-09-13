// api/session.js  ->  POST /api/session
// Everything happens on the backend now — the browser never talks to
// Firebase directly and never loads any Firebase SDK or config.
//
//   Body: { email, password }
//
//   VERIFICATION 1 (password): we call Firebase's own Identity Toolkit REST
//   API from the server, using FIREBASE_WEB_API_KEY (an env var — never
//   shipped to the browser). This is the same check firebase/auth's
//   signInWithEmailAndPassword() does under the hood; we're just making the
//   call server-side instead of client-side.
//
//   VERIFICATION 2 (role): once the password is confirmed, we look the
//   user's UID up in the Realtime Database at /members/{uid}. No record
//   there (or no role field) = permission denied, even though the password
//   was correct.
//
// On success this issues the same signed session token the rest of the
// site already uses (Authorization: Bearer <token> on /api/data, etc).

const { rtdb } = require('../lib/firebaseAdmin');
const { issueToken } = require('../lib/authToken');
const { normalizeRole, getPermissions } = require('../lib/permissions');

const IDENTITY_TOOLKIT_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';

const FRIENDLY_ERRORS = {
  EMAIL_NOT_FOUND: 'No account exists with that email.',
  INVALID_PASSWORD: 'Incorrect password.',
  INVALID_LOGIN_CREDENTIALS: 'Incorrect email or password.',
  USER_DISABLED: 'This account has been disabled.',
  TOO_MANY_ATTEMPTS_TRY_LATER: 'Too many attempts. Please wait a few minutes and try again.'
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!rtdb) {
    res.status(500).json({ error: 'Realtime Database is not configured (missing FIREBASE_DATABASE_URL).' });
    return;
  }
  const apiKey = process.env.FIREBASE_WEB_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Server is missing FIREBASE_WEB_API_KEY.' });
    return;
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  // ---- VERIFICATION 1: is this a real email/password pair? ----
  let authData;
  try {
    const authResp = await fetch(`${IDENTITY_TOOLKIT_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true })
    });
    authData = await authResp.json();
    if (!authResp.ok) {
      const code = authData?.error?.message || '';
      res.status(401).json({ error: FRIENDLY_ERRORS[code] || 'Incorrect email or password.' });
      return;
    }
  } catch (err) {
    console.error('Identity Toolkit request failed:', err);
    res.status(502).json({ error: 'Could not reach the authentication service. Please try again.' });
    return;
  }

  const uid = authData.localId;

  // ---- VERIFICATION 2: does this UID have a role in our club hierarchy? ----
  try {
    const snap = await rtdb.ref(`members/${uid}`).once('value');
    const member = snap.val();

    if (!member || !member.role) {
      res.status(403).json({ error: 'Permission denied — your account has no role assigned yet. Ask a Joint Secretary, Secretary or the President to create your ID.' });
      return;
    }
    if (member.status && member.status !== 'active') {
      res.status(403).json({ error: 'Permission denied — this account is inactive.' });
      return;
    }

    const role = normalizeRole(member.role);
    const token = issueToken({ uid, name: member.name || email, email, role });

    res.status(200).json({
      token,
      member: {
        uid,
        name: member.name || email,
        email,
        role,
        department: member.department || null,
        phone: member.phone || null,
        reportsTo: member.reportsTo || null,
        permissions: getPermissions(role)
      }
    });
  } catch (err) {
    console.error('Session role lookup failed:', err);
    res.status(500).json({ error: 'Could not verify your role. Please try again.' });
  }
};
