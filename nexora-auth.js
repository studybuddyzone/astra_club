// nexora-auth.js
// Every page's login form calls NexoraAuth.login(email, password). No
// Firebase SDK is loaded in the browser and no Firebase project config is
// ever shipped to the client — the password check AND the role check both
// happen on the server, inside /api/session.js.

(function () {
  async function login(email, password) {
    let resp, result;
    try {
      resp = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      result = await resp.json();
    } catch (err) {
      throw new Error('Could not reach the server. Please try again.');
    }

    if (!resp.ok) {
      throw new Error(result.error || 'Permission denied.');
    }

    sessionStorage.setItem('nexora_auth_token', result.token);
    sessionStorage.setItem('nexora_logged_member', JSON.stringify(result.member));
    return result.member;
  }

  function logout() {
    sessionStorage.removeItem('nexora_auth_token');
    sessionStorage.removeItem('nexora_logged_member');
  }

  window.NexoraAuth = { login, logout };
})();
