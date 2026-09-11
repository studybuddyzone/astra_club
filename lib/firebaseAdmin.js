// lib/firebaseAdmin.js
// Initializes the Firebase Admin SDK exactly once, using the service account
// JSON stored in the FIREBASE_SERVICE_ACCOUNT environment variable (set in
// Vercel Project Settings -> Environment Variables). This SDK always bypasses
// Firestore/Realtime Database security rules, which is why the rules were
// set to read/write: false -- only this backend can talk to the database.

const admin = require('firebase-admin');

if (!admin.apps.length) {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT environment variable is missing. ' +
      'Add it in Vercel Project Settings -> Environment Variables.'
    );
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.');
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    // Needed for admin.database() (Realtime Database) below. Find this URL
    // in Firebase Console -> Realtime Database -> it looks like
    // https://YOUR-PROJECT-default-rtdb.<region>.firebasedatabase.app
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.firestore();
// Realtime Database handle — this is where member accounts + roles live
// (see lib/permissions.js for what a role can do, and README_SETUP.md §9
// for the exact JSON shape expected under /members).
const rtdb = process.env.FIREBASE_DATABASE_URL ? admin.database() : null;
const auth = admin.auth();

module.exports = { admin, db, rtdb, auth };
