// api/session.js  ->  POST /api/session
// This is verification step 2 of 2.
//   Step 1 (client-side, in the browser): firebase.auth().signInWithEmailAndPassword()
//           proves the person owns that email/password — this is Firebase Auth itself.
//   Step 2 (here, server-side): we re-verify the ID token Firebase just gave the
//           browser (so a forged token can't be faked), then look the user's
//           UID up in the Realtime Database at /members/{uid}. If there is no
//           member record there, they are a valid Firebase Auth user but have
//           NO ROLE in this club system — access is denied.
//
// On success this issues the same signed session token the rest of the site
// already uses (Authorization: Bearer <token> on /api/data and friends), so
// nothing else in the app had to change.

const { auth, rtdb } = require('../lib/firebaseAdmin');
const { issueToken } = require('../lib/authToken');
const { normalizeRole, getPermissions } = require('../lib/permissions');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!rtdb) {
    res.status(500).json({ error: 'Realtime Database is not configured (missing FIREBASE_DATABASE_URL).' });
    return;
  }

  const { idToken } = req.body || {};
  if (!idToken) {
    res.status(400).json({ error: 'Missing idToken.' });
    return;
  }

  let decoded;
  try {
    // VERIFICATION 1 (re-checked server-side): is this a real, unexpired
    // Firebase Auth token, signed by Firebase, for this project?
    decoded = await auth.verifyIdToken(idToken);
  } catch (err) {
    res.status(401).json({ error: 'Your session could not be verified. Please log in again.' });
    return;
  }

  try {
    // VERIFICATION 2: does this UID have a role assigned in our club
    // hierarchy? Being a valid Firebase user is NOT enough on its own.
    const snap = await rtdb.ref(`members/${decoded.uid}`).once('value');
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
    const token = issueToken({ uid: decoded.uid, name: member.name || decoded.email, email: decoded.email, role });

    res.status(200).json({
      token,
      member: {
        uid: decoded.uid,
        name: member.name || decoded.email,
        email: decoded.email,
        role,
        department: member.department || null,
        permissions: getPermissions(role)
      }
    });
  } catch (err) {
    console.error('Session role lookup failed:', err);
    res.status(500).json({ error: 'Could not verify your role. Please try again.' });
  }
};
