// firebase-config.js
// Paste the "Firebase SDK config" object from:
//   Firebase Console -> Project Settings -> General -> Your apps -> Web app
// These values are PUBLIC by design (they identify your project, they are
// not secret keys) — it's normal and safe for them to sit in client-side
// code like this. Security is enforced by:
//   1. Firebase Auth (only real users can sign in)
//   2. The server checking Realtime Database roles (see api/session.js)
//   3. Realtime Database + Firestore security rules (set both to
//      read/write: false for direct client access — only your backend,
//      using the Admin SDK, is allowed to touch the data)
//
// Also go to Firebase Console -> Authentication -> Sign-in method and
// enable the "Email/Password" provider, or logins will fail.

window.NEXORA_FIREBASE_CONFIG = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://PASTE_YOUR_PROJECT-default-rtdb.firebaseio.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};
