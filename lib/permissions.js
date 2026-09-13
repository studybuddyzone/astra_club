// lib/permissions.js
// Single source of truth for role -> permission mapping, used by every API
// route. Do NOT scatter "if (role === 'accountant')" checks across files —
// always call hasPermission(role, 'domain.action') instead.
//
// IMPORTANT: keep ROLE_PERMISSIONS in sync with the client-side copy in
// roles-data.js (window.ASTRA_PERMISSIONS). This file is the one that is
// actually enforced; the client copy only drives UI (show/hide buttons).
//
// Every role gets 'report.create' (see BASE_PERMISSIONS) — the Daily
// Report system is available everywhere, per role. Joint Secretary is the
// only role (besides the President/VP wildcard) with report.review +
// report.approve, since they run the Central Report Center.

const BASE_PERMISSIONS = ['report.create'];

const ROLE_PERMISSIONS = {
  president: ['*'],
  'vice-president': ['*'],
  'deputy-president': [
    'event.view', 'event.edit', 'task.view', 'task.edit',
    'announcement.view', 'finance.view', 'finance.approve',
    'team.view', 'report.view'
  ],
  'vice-deputy-president': [
    'event.view', 'task.view', 'announcement.view', 'finance.view', 'team.view'
  ],
  secretary: [
    'announcement.view', 'announcement.create', 'announcement.edit',
    'meeting.manage', 'document.manage', 'task.view', 'members.view'
  ],
  'joint-secretary': [
    'announcement.view', 'meeting.manage', 'task.view',
    'members.view', 'members.create',
    'report.view', 'report.review', 'report.approve'
  ],
  accountant: [
    'finance.view', 'finance.create', 'finance.edit',
    'finance.request-approval', 'budget.view', 'receipt.manage', 'report.create'
  ],
  'event-head': [
    'event.view', 'event.create', 'event.edit',
    'task.assign', 'task.view', 'team.view', 'budget.view'
  ],
  'event-manager': [
    'event.view', 'event.edit-operations', 'task.view', 'task.edit', 'checklist.manage'
  ],
  'store-manager': [
    'inventory.view', 'inventory.create', 'inventory.issue',
    'inventory.return', 'inventory.edit'
  ],
  'marketing-head': ['campaign.manage', 'event.view', 'task.view'],
  'social-media-head': ['content.manage', 'announcement.view', 'event.view'],
  photography: ['media.manage', 'event.view'],
  'technical-head': ['technical.manage', 'task.view', 'event.view'],
  'cultural-head': ['cultural.manage', 'event.view', 'task.view'],
  'discipline-head': ['discipline.manage', 'incident.view', 'event.view'],
  'student-coordinator': ['communication.manage', 'event.view'],
  'girls-representative': ['feedback.manage'],
  'boys-representative': ['feedback.manage'],
  'strategy-planning-head': ['strategy.manage', 'report.view', 'event.view'],
  'creativity-head': ['creative.manage', 'task.view'],
  member: ['suggestion.create'],
  // Assistants work under exactly one Head (via reportsTo, see
  // api/create-member.js) but hold NO permissions from that Head's role —
  // this is deliberately empty (they still get report.create via
  // BASE_PERMISSIONS below) so an assistant's login can never open the
  // Head's own workspace, no matter who they report to.
  assistant: []
};

// Normalizes things like "Vice President" / "vice_president" / "Accountant "
// down to the canonical hyphenated role id used as the object keys above.
function normalizeRole(role) {
  return String(role || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/\s+/g, '-');
}

function getPermissions(role) {
  const specific = ROLE_PERMISSIONS[normalizeRole(role)] || [];
  if (specific.includes('*')) return specific;
  // Merge, de-duplicated, so every role has at least BASE_PERMISSIONS.
  return Array.from(new Set([...specific, ...BASE_PERMISSIONS]));
}

function hasPermission(role, permission) {
  const perms = getPermissions(role);
  return perms.includes('*') || perms.includes(permission);
}

// True if the role holds ANY permission in the given list.
function hasAnyPermission(role, permissionList) {
  return permissionList.some(p => hasPermission(role, p));
}

module.exports = { ROLE_PERMISSIONS, BASE_PERMISSIONS, normalizeRole, getPermissions, hasPermission, hasAnyPermission };
