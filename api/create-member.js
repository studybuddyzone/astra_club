// api/create-member.js  ->  POST /api/create-member
// Used by the Joint Secretary's "Create ID" panel (and anyone else holding
// members.create — President/VP always do, via the wildcard '*'). Creates a
// real Firebase Auth account (email + password) AND the matching
// /members/{uid} role record in the Realtime Database in one step, so no one
// has to manually copy UIDs between the Auth console and the Database console
// ever again.

const { auth, rtdb } = require('../lib/firebaseAdmin');
const { verifyToken } = require('../lib/authToken');
const { hasPermission, normalizeRole, ROLE_PERMISSIONS } = require('../lib/permissions');

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return (req.body && req.body.token) || null;
}

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // List members — used by the workspace to show existing IDs.
    if (!rtdb) { res.status(500).json({ error: 'Realtime Database is not configured.' }); return; }
    const caller = verifyToken(getToken(req));
    if (!caller || !hasPermission(caller.role, 'members.view')) {
      res.status(403).json({ error: 'You are not authorized to view the member list.' });
      return;
    }
    try {
      const snap = await rtdb.ref('members').once('value');
      const members = snap.val() || {};
      // Never send password data — there isn't any here (Firebase Auth holds
      // passwords, not the Realtime Database), but strip anything sensitive
      // defensively in case older data was written differently.
      Object.values(members).forEach(m => { delete m.password; });
      res.status(200).json(members);
    } catch (err) {
      console.error('Member list error:', err);
      res.status(500).json({ error: 'Could not load members.' });
    }
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!rtdb) {
    res.status(500).json({ error: 'Realtime Database is not configured (missing FIREBASE_DATABASE_URL).' });
    return;
  }

  const caller = verifyToken(getToken(req));
  if (!caller || !hasPermission(caller.role, 'members.create')) {
    res.status(403).json({ error: 'You are not authorized to create member IDs.' });
    return;
  }

  const { name, email, password, role, department } = req.body || {};
  if (!name || !email || !password || !role) {
    res.status(400).json({ error: 'name, email, password and role are all required.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }
  const normalizedRole = normalizeRole(role);
  if (!ROLE_PERMISSIONS[normalizedRole]) {
    res.status(400).json({ error: `Unknown role "${role}".` });
    return;
  }

  try {
    const userRecord = await auth.createUser({ email, password, displayName: name });
    await rtdb.ref(`members/${userRecord.uid}`).set({
      name,
      email,
      role: normalizedRole,
      department: department || null,
      status: 'active',
      createdBy: caller.name,
      createdAt: Date.now()
    });
    res.status(200).json({ success: true, uid: userRecord.uid });
  } catch (err) {
    console.error('Create member error:', err);
    const message = err && err.code === 'auth/email-already-exists'
      ? 'That email is already registered.'
      : (err.message || 'Could not create the member.');
    res.status(400).json({ error: message });
  }
};
