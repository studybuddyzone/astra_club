// api/login.js  ->  POST /api/login
// SUPERSEDED — kept only so nothing 404s if an old bookmark/script still
// calls it. All pages now log in through Firebase Auth (email + password)
// + /api/session.js instead (see astra-auth.js). That flow gives you real
// double verification: Firebase Auth confirms the credentials, then
// /api/session checks the Realtime Database for a role. This file's
// Firestore "astra_members" name+password check has neither of those
// properties, so don't point new UI at it.
//
// Verifies an office bearer's name + password against Firestore (collection
// "astra_members"), and returns a signed token the frontend must send with
// any future add/edit/delete request. Passwords never leave the backend and
// are never visible in the website's front-end code.

const { db } = require('../lib/firebaseAdmin');
const { issueToken } = require('../lib/authToken');
const { normalizeRole, getPermissions } = require('../lib/permissions');

// Used only the very first time, before you've added real members in
// Firestore. Once you add documents to the "astra_members" collection,
// this fallback is ignored. Change/remove this once real members are set up.
const FALLBACK_MEMBERS = [
  { id: 'member-anurag', name: 'Anurag', password: 'Anurag7028@2026', role: 'president' }
];

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { name, password } = req.body || {};
    if (!name || !password) {
      res.status(400).json({ error: 'Name and password are required.' });
      return;
    }

    let members = [];
    const snapshot = await db.collection('astra_members').get();
    if (!snapshot.empty) {
      snapshot.forEach(docSnap => members.push(docSnap.data()));
    } else {
      members = FALLBACK_MEMBERS;
    }

    const match = members.find(m =>
      String(m.name).trim().toLowerCase() === String(name).trim().toLowerCase() &&
      m.password === password
    );

    if (!match) {
      res.status(401).json({ error: 'Invalid name or password.' });
      return;
    }

    const normalizedRole = normalizeRole(match.role);
    const token = issueToken({ name: match.name, role: normalizedRole });
    res.status(200).json({
      token,
      member: {
        name: match.name,
        role: normalizedRole,
        department: match.department || null,
        permissions: getPermissions(normalizedRole)
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};
