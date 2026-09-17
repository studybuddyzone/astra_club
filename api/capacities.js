// api/capacities.js  ->  GET (list all) / POST (set one) /api/capacities
// GET is public — the registration form shows "X/Y slots" per head, and
// visitors have no login yet. Only setting a capacity is restricted.

const { rtdb } = require('../lib/firebaseAdmin');
const { verifyToken } = require('../lib/authToken');
const { hasPermission } = require('../lib/permissions');
const { getAllCapacities, DEFAULT_CAPACITY } = require('../lib/capacity');

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return (req.body && req.body.token) || null;
}

module.exports = async (req, res) => {
  if (!rtdb) { res.status(500).json({ error: 'Realtime Database is not configured.' }); return; }

  if (req.method === 'GET') {
    const capacities = await getAllCapacities(rtdb);
    res.status(200).json({ capacities, default: DEFAULT_CAPACITY });
    return;
  }

  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const caller = verifyToken(getToken(req));
  if (!caller || !(hasPermission(caller.role, 'capacity.manage') || hasPermission(caller.role, '*'))) {
    res.status(403).json({ error: 'You are not authorized to change head capacities.' });
    return;
  }

  const { roleId, capacity } = req.body || {};
  const num = Number(capacity);
  if (!roleId || !Number.isInteger(num) || num < 0 || num > 100) {
    res.status(400).json({ error: 'roleId and a capacity between 0 and 100 are required.' });
    return;
  }

  try {
    await rtdb.ref(`capacities/${roleId}`).set(num);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Set capacity error:', err);
    res.status(500).json({ error: 'Could not update capacity.' });
  }
};
