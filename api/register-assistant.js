// api/register-assistant.js  ->  POST /api/register-assistant
// Public — anyone can apply to become an Assistant. This does NOT grant
// access by itself: it creates the Firebase Auth account (so the person's
// login already exists) but writes NOTHING to /members/{uid} yet. Without
// a /members/{uid} entry, /api/session's verification 2 will always say
// "no role assigned" — so a pending applicant genuinely cannot log into
// anything until a Joint Secretary approves them (see
// api/registrations.js), which is when /members/{uid} finally gets
// written. Rejecting deletes the Auth account again, so the local-part is
// free to re-apply with.
//
// EMAIL NORMALIZATION: whatever email the applicant types (Gmail, Yahoo,
// anything), only the part before "@" is kept, and it's always issued as
// <localpart>@astra.club — that is their real Firebase Auth login email
// from here on, not whatever they originally typed. Their original email
// is kept separately as personalEmail, purely for the Joint Secretary to
// have a contact address — it is never used for login.

const { auth, rtdb } = require('../lib/firebaseAdmin');
const { normalizeRole, ROLE_PERMISSIONS } = require('../lib/permissions');
const { getCapacity } = require('../lib/capacity');

const REGISTRATION_FEE = 100;
const CLUB_EMAIL_DOMAIN = 'astra.club';

// Keeps only characters that are safe/normal in an email local-part, so a
// messy or copy-pasted input can't produce an invalid address.
function toClubEmail(rawEmail) {
  const localPart = String(rawEmail || '').split('@')[0]
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');
  return localPart ? `${localPart}@${CLUB_EMAIL_DOMAIN}` : null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!rtdb) {
    res.status(500).json({ error: 'Realtime Database is not configured (missing FIREBASE_DATABASE_URL).' });
    return;
  }

  const { name, email, phone, password, reportsTo, paymentMethod, paymentReceiptUrl } = req.body || {};

  if (!name || !email || !phone || !password || !reportsTo || !paymentMethod) {
    res.status(400).json({ error: 'Name, email, phone, password, head, and payment method are all required.' });
    return;
  }
  if (password.length < 8) {
    res.status(400).json({ error: 'Password must be at least 8 characters.' });
    return;
  }
  const normalizedReportsTo = normalizeRole(reportsTo);
  if (!ROLE_PERMISSIONS[normalizedReportsTo]) {
    res.status(400).json({ error: `Unknown head "${reportsTo}".` });
    return;
  }
  if (!['cash', 'online'].includes(paymentMethod)) {
    res.status(400).json({ error: 'Payment method must be cash or online.' });
    return;
  }
  if (paymentMethod === 'online' && !paymentReceiptUrl) {
    res.status(400).json({ error: 'Please upload your payment receipt/screenshot for an online payment.' });
    return;
  }

  const clubEmail = toClubEmail(email);
  if (!clubEmail) {
    res.status(400).json({ error: 'That email could not be converted into a valid login address. Please try a different one.' });
    return;
  }

  // Soft check now (final, authoritative check happens again at approval
  // time in api/registrations.js, since more people may register for the
  // same head in the meantime).
  try {
    const existingSnap = await rtdb.ref('members').orderByChild('reportsTo').equalTo(normalizedReportsTo).once('value');
    const pendingSnap = await rtdb.ref('registrations').orderByChild('reportsTo').equalTo(normalizedReportsTo).once('value');
    const existingCount = Object.keys(existingSnap.val() || {}).length;
    const pendingCount = Object.values(pendingSnap.val() || {}).filter(r => r.status === 'pending').length;
    const capacity = await getCapacity(rtdb, normalizedReportsTo);
    if (existingCount + pendingCount >= capacity) {
      res.status(400).json({ error: `This head already has ${capacity} assistants (including pending approvals). Please choose a different head.` });
      return;
    }
  } catch (err) {
    console.error('Registration capacity check failed:', err);
  }

  let userRecord;
  try {
    userRecord = await auth.createUser({ email: clubEmail, password, displayName: name });
  } catch (err) {
    const message = err && err.code === 'auth/email-already-exists'
      ? `The login address ${clubEmail} is already taken by someone else's registration. Try a different email (its part before "@" is what becomes your login).`
      : (err.message || 'Could not create your account.');
    res.status(400).json({ error: message });
    return;
  }

  try {
    await rtdb.ref(`registrations/${userRecord.uid}`).set({
      name,
      email: clubEmail,
      personalEmail: email,
      phone,
      reportsTo: normalizedReportsTo,
      paymentMethod,
      paymentReceiptUrl: paymentReceiptUrl || null,
      amount: REGISTRATION_FEE,
      status: 'pending',
      submittedAt: Date.now()
    });
    res.status(200).json({
      success: true,
      loginEmail: clubEmail,
      message: `Registration submitted! Your login email is ${clubEmail} — a Joint Secretary will review and approve your account soon.`
    });
  } catch (err) {
    console.error('Registration record write failed:', err);
    // Roll back the auth account so a retry doesn't hit "email already exists".
    try { await auth.deleteUser(userRecord.uid); } catch (e2) { /* best effort */ }
    res.status(500).json({ error: 'Could not submit your registration. Please try again.' });
  }
};
