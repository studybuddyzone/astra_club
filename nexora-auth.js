// nexora-auth.js
// Wraps Firebase Auth (email/password) + our /api/session double-check into
// two simple calls: NexoraAuth.login(email, password) and NexoraAuth.logout().
// Include this AFTER firebase-app-compat.js + firebase-auth-compat.js +
// firebase-config.js, and BEFORE any page-specific script that calls it.

(function () {
  if (!window.firebase || !window.NEXORA_FIREBASE_CONFIG) {
    console.error('nexora-auth.js: Firebase SDK or firebase-config.js not loaded.');
    return;
  }
  if (!firebase.apps.length) {
    firebase.initializeApp(window.NEXORA_FIREBASE_CONFIG);
  }

  async function login(email, password) {
    // STEP 1 of 2: Firebase Auth itself confirms this email/password is real.
    const credential = await firebase.auth().signInWithEmailAndPassword(email, password);
    const idToken = await credential.user.getIdToken();

    // STEP 2 of 2: our backend re-checks the token AND looks up a role in
    // the Realtime Database. No role there = no access, even though Firebase
    // Auth itself succeeded.
    let resp, result;
    try {
      resp = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken })
      });
      result = await resp.json();
    } catch (err) {
      await firebase.auth().signOut();
      throw new Error('Could not reach the server. Please try again.');
    }

    if (!resp.ok) {
      await firebase.auth().signOut(); // don't leave a half-authenticated session
      throw new Error(result.error || 'Permission denied.');
    }

    sessionStorage.setItem('nexora_auth_token', result.token);
    sessionStorage.setItem('nexora_logged_member', JSON.stringify(result.member));
    return result.member;
  }

  async function logout() {
    sessionStorage.removeItem('nexora_auth_token');
    sessionStorage.removeItem('nexora_logged_member');
    try { await firebase.auth().signOut(); } catch (e) { /* ignore */ }
  }

  window.NexoraAuth = { login, logout };
})();
