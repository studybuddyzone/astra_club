// lib/capacity.js
// Per-head assistant capacity used to be a hardcoded "5" scattered across
// api/create-member.js, api/register-assistant.js, and api/registrations.js.
// It now lives in the Realtime Database at /capacities/{roleId} (a plain
// number), settable by the Joint Secretary from their dashboard. Any role
// with no entry there falls back to DEFAULT_CAPACITY.

const DEFAULT_CAPACITY = 5;

async function getCapacity(rtdb, roleId) {
  try {
    const snap = await rtdb.ref(`capacities/${roleId}`).once('value');
    const val = snap.val();
    return (typeof val === 'number' && val >= 0) ? val : DEFAULT_CAPACITY;
  } catch (err) {
    return DEFAULT_CAPACITY;
  }
}

async function getAllCapacities(rtdb) {
  try {
    const snap = await rtdb.ref('capacities').once('value');
    return snap.val() || {};
  } catch (err) {
    return {};
  }
}

module.exports = { DEFAULT_CAPACITY, getCapacity, getAllCapacities };
