// roles-data.js
// Shared, client-side role metadata for the Team & Roles grid and for every
// workspace page's permission gating. Keep NEXORA_PERMISSIONS in sync with
// lib/permissions.js (server-enforced copy) — this client copy only decides
// what to SHOW, the server always decides what is actually ALLOWED.

window.NEXORA_PERMISSIONS = {
  'president': ['*'],
  'vice-president': ['*'],
  'deputy-president': ['event.view','event.edit','task.view','task.edit','announcement.view','finance.view','finance.approve','team.view','report.view'],
  'vice-deputy-president': ['event.view','task.view','announcement.view','finance.view','team.view'],
  'secretary': ['announcement.view','announcement.create','announcement.edit','meeting.manage','document.manage','task.view','members.view'],
  'joint-secretary': ['announcement.view','meeting.manage','task.view','members.view','members.create'],
  'accountant': ['finance.view','finance.create','finance.edit','finance.request-approval','budget.view','receipt.manage','report.create'],
  'event-head': ['event.view','event.create','event.edit','task.assign','task.view','team.view','budget.view'],
  'event-manager': ['event.view','event.edit-operations','task.view','task.edit','checklist.manage'],
  'store-manager': ['inventory.view','inventory.create','inventory.issue','inventory.return','inventory.edit'],
  'marketing-head': ['campaign.manage','event.view','task.view'],
  'social-media-head': ['content.manage','announcement.view','event.view'],
  'photography': ['media.manage','event.view'],
  'technical-head': ['technical.manage','task.view','event.view'],
  'cultural-head': ['cultural.manage','event.view','task.view'],
  'discipline-head': ['discipline.manage','incident.view','event.view'],
  'student-coordinator': ['communication.manage','event.view'],
  'girls-representative': ['feedback.manage'],
  'boys-representative': ['feedback.manage'],
  'strategy-planning-head': ['strategy.manage','report.view','event.view'],
  'creativity-head': ['creative.manage','task.view'],
  'member': ['suggestion.create']
};

window.normalizeRole = function normalizeRole(role) {
  return String(role || '').trim().toLowerCase().replace(/_/g, '-').replace(/\s+/g, '-');
};

window.hasPermission = function hasPermission(role, permission) {
  const perms = window.NEXORA_PERMISSIONS[window.normalizeRole(role)] || [];
  return perms.includes('*') || perms.includes(permission);
};

// Role directory for the Team & Roles grid.
// workspace.type: 'functional' (real dashboard exists), 'legacy' (works via
// an existing manager page), or 'info' (responsibilities only, workspace not
// built yet — never label these as functional, per project rules).
window.NEXORA_ROLES = [
  { id: 'president', name: 'President', group: 'Leadership', icon: 'fa-crown', accent: 'indigo',
    summary: 'Overall club direction — oversees every department, event, finances, tasks and approvals.',
    tags: ['Overview', 'Approvals', 'Team'],
    permission: 'team.view', workspace: { type: 'legacy', url: 'index.html', label: 'Full Dashboard Access' } },
  { id: 'vice-president', name: 'Vice President', group: 'Leadership', icon: 'fa-star', accent: 'indigo',
    summary: 'Coordinates departments and event progress, and shares approval authority with the President.',
    tags: ['Coordination', 'Approvals'],
    permission: 'team.view', workspace: { type: 'legacy', url: 'index.html', label: 'Full Dashboard Access' } },
  { id: 'deputy-president', name: 'Deputy President', group: 'Leadership', icon: 'fa-shield-halved', accent: 'indigo',
    summary: 'Follows up on departments, monitors tasks and events, and reports progress to leadership.',
    tags: ['Monitoring', 'Escalation'],
    permission: 'team.view', workspace: { type: 'info' } },
  { id: 'vice-deputy-president', name: 'Vice Deputy President', group: 'Leadership', icon: 'fa-shield', accent: 'indigo',
    summary: 'Assists the Deputy President with department follow-up and team coordination.',
    tags: ['Coordination'],
    permission: 'team.view', workspace: { type: 'info' } },
  { id: 'secretary', name: 'Secretary', group: 'Administration', icon: 'fa-pen-to-square', accent: 'sky',
    summary: 'Maintains official records, meeting minutes, notices and follow-ups on decisions.',
    tags: ['Records', 'Minutes', 'Notices'],
    permission: 'document.manage', workspace: { type: 'info' } },
  { id: 'joint-secretary', name: 'Joint Secretary', group: 'Administration', icon: 'fa-file-signature', accent: 'sky',
    summary: 'Assists the Secretary with meeting scheduling, attendance and administrative records. Also creates and manages member login IDs.',
    tags: ['Scheduling', 'Attendance', 'ID Creation'],
    permission: 'members.create', workspace: { type: 'functional', url: 'joint-secretary-workspace.html', label: 'Open ID & Records Workspace' } },
  { id: 'accountant', name: 'Accountant', group: 'Finance', icon: 'fa-calculator', accent: 'emerald',
    summary: 'Maintains financial records — income, expenses, budgets, receipts and payments — and flags budget concerns.',
    tags: ['Income', 'Expenses', 'Budgets', 'Receipts'],
    permission: 'finance.view', workspace: { type: 'functional', url: 'accountant-workspace.html', label: 'Open Accountant Workspace' } },
  { id: 'event-head', name: 'Event Head', group: 'Events', icon: 'fa-star-of-life', accent: 'amber',
    summary: 'Plans events, builds timelines, assigns responsibilities and coordinates across departments.',
    tags: ['Planning', 'Timelines', 'Coordination'],
    permission: 'event.create', workspace: { type: 'info' } },
  { id: 'event-manager', name: 'Event Manager', group: 'Events', icon: 'fa-calendar-check', accent: 'amber',
    summary: 'Executes event operations — checklists, logistics and on-ground task tracking.',
    tags: ['Checklists', 'Logistics'],
    permission: 'event.edit-operations', workspace: { type: 'info' } },
  { id: 'store-manager', name: 'Store Manager', group: 'Operations', icon: 'fa-boxes-stacked', accent: 'rose',
    summary: 'Tracks inventory, stock in/out, suppliers and event equipment allocation.',
    tags: ['Inventory', 'Stock', 'Allocation'],
    permission: 'inventory.view', workspace: { type: 'info' } },
  { id: 'marketing-head', name: 'Marketing Head', group: 'Outreach', icon: 'fa-bullseye', accent: 'violet',
    summary: 'Runs promotion campaigns, the promotion calendar and partnerships for club events.',
    tags: ['Campaigns', 'Promotion'],
    permission: 'campaign.manage', workspace: { type: 'info' } },
  { id: 'social-media-head', name: 'Social Media Head', group: 'Outreach', icon: 'fa-hashtag', accent: 'violet',
    summary: 'Owns the content calendar, posts, stories and engagement tracking across platforms.',
    tags: ['Content', 'Calendar'],
    permission: 'content.manage', workspace: { type: 'info' } },
  { id: 'photography', name: 'Photography', group: 'Outreach', icon: 'fa-camera', accent: 'violet',
    summary: 'Handles event photography assignments, shot lists, the photo archive and delivery.',
    tags: ['Shoots', 'Archive'],
    permission: 'media.manage', workspace: { type: 'info' } },
  { id: 'technical-head', name: 'Technical Head', group: 'Technical', icon: 'fa-microchip', accent: 'cyan',
    summary: 'Manages website/technical tasks, digital tools and event technical requirements.',
    tags: ['Website', 'Equipment'],
    permission: 'technical.manage', workspace: { type: 'info' } },
  { id: 'cultural-head', name: 'Cultural Head', group: 'Programs', icon: 'fa-masks-theater', accent: 'orange',
    summary: 'Organizes performers, auditions, rehearsals and the performance schedule.',
    tags: ['Performers', 'Schedule'],
    permission: 'cultural.manage', workspace: { type: 'info' } },
  { id: 'discipline-head', name: 'Discipline Head', group: 'Operations', icon: 'fa-user-shield', accent: 'rose',
    summary: 'Oversees event discipline, crowd management and incident reporting to leadership.',
    tags: ['Discipline', 'Incidents'],
    permission: 'discipline.manage', workspace: { type: 'info' } },
  { id: 'student-coordinator', name: 'Student Coordinator', group: 'Outreach', icon: 'fa-people-group', accent: 'violet',
    summary: 'Keeps students informed of deadlines and opportunities, and collects participation.',
    tags: ['Communication', 'Feedback'],
    permission: 'communication.manage', workspace: { type: 'info' } },
  { id: 'girls-representative', name: "Girls' Representative", group: 'Representation', icon: 'fa-comments', accent: 'pink',
    summary: 'Collects feedback, suggestions and concerns, escalating them to leadership as needed.',
    tags: ['Feedback', 'Escalation'],
    permission: 'feedback.manage', workspace: { type: 'info' } },
  { id: 'boys-representative', name: "Boys' Representative", group: 'Representation', icon: 'fa-comments', accent: 'pink',
    summary: 'Collects feedback, suggestions and concerns, escalating them to leadership as needed.',
    tags: ['Feedback', 'Escalation'],
    permission: 'feedback.manage', workspace: { type: 'info' } },
  { id: 'strategy-planning-head', name: 'Strategy & Planning Head', group: 'Leadership', icon: 'fa-diagram-project', accent: 'indigo',
    summary: 'Builds strategic plans, timelines and priorities, and reviews event performance.',
    tags: ['Roadmap', 'Review'],
    permission: 'strategy.manage', workspace: { type: 'info' } },
  { id: 'creativity-head', name: 'Creativity Head', group: 'Programs', icon: 'fa-palette', accent: 'orange',
    summary: 'Runs creative/design requests, campaign concepts and brand asset approvals.',
    tags: ['Design', 'Approvals'],
    permission: 'creative.manage', workspace: { type: 'info' } }
];

window.NEXORA_ACCENTS = {
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-950/60', text: 'text-indigo-600 dark:text-indigo-400', chip: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400' },
  sky: { bg: 'bg-sky-100 dark:bg-sky-950/60', text: 'text-sky-600 dark:text-sky-400', chip: 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-950/60', text: 'text-emerald-600 dark:text-emerald-400', chip: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-950/60', text: 'text-amber-600 dark:text-amber-400', chip: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400' },
  rose: { bg: 'bg-rose-100 dark:bg-rose-950/60', text: 'text-rose-600 dark:text-rose-400', chip: 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400' },
  violet: { bg: 'bg-violet-100 dark:bg-violet-950/60', text: 'text-violet-600 dark:text-violet-400', chip: 'bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400' },
  cyan: { bg: 'bg-cyan-100 dark:bg-cyan-950/60', text: 'text-cyan-600 dark:text-cyan-400', chip: 'bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-400' },
  orange: { bg: 'bg-orange-100 dark:bg-orange-950/60', text: 'text-orange-600 dark:text-orange-400', chip: 'bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400' },
  pink: { bg: 'bg-pink-100 dark:bg-pink-950/60', text: 'text-pink-600 dark:text-pink-400', chip: 'bg-pink-50 dark:bg-pink-950/40 text-pink-700 dark:text-pink-400' }
};
