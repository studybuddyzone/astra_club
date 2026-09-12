// api/data.js  ->  GET/POST/DELETE /api/data?collection=events (etc.)
// One shared endpoint for all club data collections. Reading is open to
// everyone (so the site stays public/useful for guests too). Adding,
// editing or deleting requires a valid token from /api/login belonging to
// an officer role (until the full roles list arrives -- see note below).

const { db } = require('../lib/firebaseAdmin');
const { verifyToken } = require('../lib/authToken');
const { hasAnyPermission, hasPermission, normalizeRole } = require('../lib/permissions');

// Keeps the same Firestore location the site already used, so existing
// cloud data (if any) is not orphaned.
const APP_ID = 'astra-club-app';

const ALL_COLLECTIONS = ['events', 'finances', 'announcements', 'tasks', 'suggestions', 'budgets', 'inventory', 'records'];

// Anyone can add/upvote a suggestion; the rest need an officer login with the
// right permission (see lib/permissions.js for the full role->permission map).
const OFFICER_ONLY_COLLECTIONS = ['events', 'finances', 'announcements', 'tasks', 'budgets', 'inventory', 'records'];

// A write to a collection is allowed if the caller's role holds ANY one of
// the listed permissions. president/vice-president hold '*' and always pass.
// 'records' is handled separately below (it's shared by every role
// workspace, so the rule is "own role's records only", not a fixed list).
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

// 'records' is the generic per-role notes/log collection used by every
// role-workspace.html page (§ "activate remaining roles"). Anyone with a
// real officer role can log a record, but only tagged under their OWN
// role — unless they hold the wildcard (President/VP), who can write (and
// are the only ones who can delete) any role's records.
function canEditRecords(payload, req, isDelete) {
  if (hasPermission(payload.role, '*')) return true;
  if (isDelete) return false; // only leadership can delete another's log entry
  const targetRole = req.body && req.body.data && req.body.data.role;
  return !!targetRole && normalizeRole(targetRole) === normalizeRole(payload.role);
}

function canEdit(req, collectionName, isDelete) {
  if (!OFFICER_ONLY_COLLECTIONS.includes(collectionName)) return true; // public write
  const payload = verifyToken(getToken(req));
  if (!payload) return false;
  if (collectionName === 'records') return canEditRecords(payload, req, isDelete);
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
      if (!canEdit(req, collectionName, false)) {
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
      if (!canEdit(req, collectionName, true)) {
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
