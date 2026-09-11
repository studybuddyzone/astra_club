// api/data.js  ->  GET/POST/DELETE /api/data?collection=events (etc.)
// One shared endpoint for all club data collections. Reading is open to
// everyone (so the site stays public/useful for guests too). Adding,
// editing or deleting requires a valid token from /api/login belonging to
// an officer role (until the full roles list arrives -- see note below).

const { db } = require('../lib/firebaseAdmin');
const { verifyToken } = require('../lib/authToken');
const { hasAnyPermission } = require('../lib/permissions');

// Keeps the same Firestore location the site already used, so existing
// cloud data (if any) is not orphaned.
const APP_ID = 'nexora-club-app';

const ALL_COLLECTIONS = ['events', 'finances', 'announcements', 'tasks', 'suggestions', 'budgets', 'inventory'];

// Anyone can add/upvote a suggestion; the rest need an officer login with the
// right permission (see lib/permissions.js for the full role->permission map).
const OFFICER_ONLY_COLLECTIONS = ['events', 'finances', 'announcements', 'tasks', 'budgets', 'inventory'];

// A write to a collection is allowed if the caller's role holds ANY one of
// the listed permissions. president/vice-president hold '*' and always pass.
const COLLECTION_WRITE_PERMISSIONS = {
  events: ['event.create', 'event.edit', 'event.edit-operations'],
  finances: ['finance.create', 'finance.edit', 'finance.approve'],
  announcements: ['announcement.create', 'announcement.edit'],
  tasks: ['task.edit', 'task.assign'],
  budgets: ['finance.edit', 'budget.view'],
  inventory: ['inventory.create', 'inventory.edit', 'inventory.issue', 'inventory.return']
};

function collectionRef(name) {
  return db
    .collection('artifacts').doc(APP_ID)
    .collection('public').doc('data')
    .collection(name);
}

function getToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return (req.body && req.body.token) || null;
}

function canEdit(req, collectionName) {
  if (!OFFICER_ONLY_COLLECTIONS.includes(collectionName)) return true; // public write
  const payload = verifyToken(getToken(req));
  if (!payload) return false;
  const required = COLLECTION_WRITE_PERMISSIONS[collectionName] || [];
  return hasAnyPermission(payload.role, required);
}

module.exports = async (req, res) => {
  const collectionName = req.query.collection;
  if (!ALL_COLLECTIONS.includes(collectionName)) {
    res.status(400).json({ error: 'Unknown or disallowed collection.' });
    return;
  }

  try {
    if (req.method === 'GET') {
      const snapshot = await collectionRef(collectionName).get();
      const items = {};
      snapshot.forEach(docSnap => { items[docSnap.id] = docSnap.data(); });
      res.status(200).json(items);
      return;
    }

    if (req.method === 'POST') {
      if (!canEdit(req, collectionName)) {
        res.status(403).json({ error: 'You are not authorized to edit this section.' });
        return;
      }
      const { id, data } = req.body || {};
      if (!id || !data) {
        res.status(400).json({ error: 'Both id and data are required.' });
        return;
      }
      await collectionRef(collectionName).doc(id).set(data);
      res.status(200).json({ success: true });
      return;
    }

    if (req.method === 'DELETE') {
      if (!canEdit(req, collectionName)) {
        res.status(403).json({ error: 'You are not authorized to delete this item.' });
        return;
      }
      const { id } = req.body || {};
      if (!id) {
        res.status(400).json({ error: 'id is required.' });
        return;
      }
      await collectionRef(collectionName).doc(id).delete();
      res.status(200).json({ success: true });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error(`Data API error (${collectionName}):`, err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
};
