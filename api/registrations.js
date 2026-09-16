// api/registrations.js  ->  GET (list) / POST (approve|reject) /api/registrations
// The Joint Secretary's approval queue for self-service Assistant
// registrations. Approving is the moment the account actually becomes
// usable — this is where /members/{uid} finally gets written (same shape
// as api/create-member.js), completing what used to be a fully manual
// process.

const { auth, rtdb } = require('../lib/firebaseAdmin');
const { verifyToken } = require('../lib/authToken');
const { hasPermission, normalizeRole } = require('../lib/permissions');

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return (req.body && req.body.token) || null;
}

function authorized(caller) {
  return caller && (hasPermission(caller.role, 'members.create') || hasPermission(caller.role, '*'));
}

module.exports = async (req, res) => {
  if (!rtdb) { res.status(500).json({ error: 'Realtime Database is not configured.' }); return; }

  if (req.method === 'GET') {
    const caller = verifyToken(getToken(req));
    if (!authorized(caller)) { res.status(403).json({ error: 'You are not authorized to view registrations.' }); return; }
    try {
      const snap = await rtdb.ref('registrations').once('value');
      res.status(200).json(snap.val() || {});
    } catch (err) {
      console.error('Registrations list error:', err);
      res.status(500).json({ error: 'Could not load registrations.' });
    }
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const caller = verifyToken(getToken(req));
  if (!authorized(caller)) { res.status(403).json({ error: 'You are not authorized to review registrations.' }); return; }

  const { uid, action, reason } = req.body || {};
  if (!uid || !['approve', 'reject'].includes(action)) {
    res.status(400).json({ error: 'uid and a valid action (approve/reject) are required.' });
    return;
  }

  const regSnap = await rtdb.ref(`registrations/${uid}`).once('value');
  const registration = regSnap.val();
  if (!registration) { res.status(404).json({ error: 'Registration not found.' }); return; }
  if (registration.status !== 'pending') { res.status(400).json({ error: `This registration was already ${registration.status}.` }); return; }

  if (action === 'reject') {
    try {
      await auth.deleteUser(uid).catch(() => {}); // free up the email for re-registration
      await rtdb.ref(`registrations/${uid}`).update({ status: 'rejected', reviewedBy: caller.name, reviewedAt: Date.now(), reviewComment: reason || null });
      res.status(200).json({ success: true });
    } catch (err) {
      console.error('Reject registration error:', err);
      res.status(500).json({ error: 'Could not reject this registration.' });
    }
    return;
  }

  // action === 'approve'
  try {
    // Final, authoritative 5-per-head check — more people may have
    // registered/been approved for this head since this one was submitted.
    const existingSnap = await rtdb.ref('members').orderByChild('reportsTo').equalTo(registration.reportsTo).once('value');
    const existingCount = Object.keys(existingSnap.val() || {}).length;
    if (existingCount >= 5) {
      res.status(400).json({ error: `${normalizeRole(registration.reportsTo)} already has 5 assistants. Reject this one or ask them to pick a different head.` });
      return;
    }

    await rtdb.ref(`members/${uid}`).set({
      name: registration.name,
      email: registration.email,
      phone: registration.phone,
      role: 'assistant',
      reportsTo: registration.reportsTo,
      department: null,
      status: 'active',
      createdBy: caller.name,
      createdAt: Date.now(),
      registrationRef: uid
    });
    await rtdb.ref(`registrations/${uid}`).update({ status: 'approved', reviewedBy: caller.name, reviewedAt: Date.now() });
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Approve registration error:', err);
    res.status(500).json({ error: 'Could not approve this registration.' });
  }
};
