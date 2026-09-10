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
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

module.exports = { admin, db };
