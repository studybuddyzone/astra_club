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
    // List members — used by Joint Secretary/Secretary/leadership to see
    // everyone, and by every Head's role-workspace "Team" tab to see just
    // the members reporting to them.
    if (!rtdb) { res.status(500).json({ error: 'Realtime Database is not configured.' }); return; }
    const caller = verifyToken(getToken(req));
    if (!caller) { res.status(403).json({ error: 'Please log in.' }); return; }
    try {
      const snap = await rtdb.ref('members').once('value');
      const members = snap.val() || {};
      Object.values(members).forEach(m => { delete m.password; });

      // Full visibility: members.view permission (Secretary/Joint Secretary)
      // or the wildcard (President/VP). Everyone else only sees their OWN
      // team — the members whose reportsTo matches their own role.
      if (hasPermission(caller.role, 'members.view') || hasPermission(caller.role, '*')) {
        res.status(200).json(members);
        return;
      }
      const myTeam = {};
      Object.entries(members).forEach(([uid, m]) => {
        if (normalizeRole(m.reportsTo || '') === normalizeRole(caller.role)) myTeam[uid] = m;
      });
      res.status(200).json(myTeam);
    } catch (err) {
      console.error('Member list error:', err);
      res.status(500).json({ error: 'Could not load members.' });
    }
    return;
  }

  if (req.method === 'DELETE') {
    // Deletes the ID completely: the Firebase Auth account, the
    // /members/{uid} Realtime Database record, and (best-effort) any
    // /registrations/{uid} record if they came through self-registration.
    // Note: member/assistant accounts never had a Firestore document to
    // begin with (only Auth + Realtime Database hold their data), so
    // there's nothing to clean up there — this removes every place their
    // account actually lives.
    if (!rtdb) { res.status(500).json({ error: 'Realtime Database is not configured.' }); return; }
    const caller = verifyToken(getToken(req));
    if (!caller || !hasPermission(caller.role, 'members.create')) {
      res.status(403).json({ error: 'You are not authorized to delete member IDs.' });
      return;
    }
    const { uid } = req.body || {};
    if (!uid) { res.status(400).json({ error: 'uid is required.' }); return; }

    try {
      await auth.deleteUser(uid).catch(err => {
        if (err && err.code !== 'auth/user-not-found') throw err; // already gone from Auth is fine
      });
      await rtdb.ref(`members/${uid}`).remove();
      await rtdb.ref(`registrations/${uid}`).remove().catch(() => {}); // best-effort, may not exist
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Delete member error:', err);
      res.status(500).json({ error: err.message || 'Could not delete this ID.' });
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

  const { name, email, password, role, department, phone, reportsTo } = req.body || {};
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
  const normalizedReportsTo = reportsTo ? normalizeRole(reportsTo) : null;
  if (normalizedReportsTo && !ROLE_PERMISSIONS[normalizedReportsTo]) {
    res.status(400).json({ error: `Unknown head/role "${reportsTo}" for "reports to".` });
    return;
  }

  try {
    // Enforce: max 5 members under any one Head.
    if (normalizedReportsTo) {
      const snap = await rtdb.ref('members').orderByChild('reportsTo').equalTo(normalizedReportsTo).once('value');
      const existing = snap.val() || {};
      if (Object.keys(existing).length >= 5) {
        res.status(400).json({ error: `This head already has 5 members under them. Remove one before adding another.` });
        return;
      }
    }

    const userRecord = await auth.createUser({ email, password, displayName: name });
    await rtdb.ref(`members/${userRecord.uid}`).set({
      name,
      email,
      phone: phone || null,
      role: normalizedRole,
      reportsTo: normalizedReportsTo,
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
