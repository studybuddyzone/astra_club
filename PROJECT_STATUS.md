# Astra Club Management System — Project Status (Handoff Doc)

Last updated: this covers everything built across the conversation so far,
starting from the original "Nexora" Vercel + Firebase project you uploaded.
Give this file to a new Claude conversation along with the current project
zip, and say "continue from here" — it has everything needed to pick up
without re-explaining the whole history.

---

## 1. What this project is

A Firebase + Vercel serverless club management site. Static HTML/JS pages
(no build step, no framework) talk to a handful of `/api/*.js` serverless
functions, which talk to Firebase (Firestore for club data, Realtime
Database for member accounts/roles, Firebase Auth for login).

Originally called "Nexora" — **fully rebranded to "Astra"** partway
through (every file, variable, storage key, and Firestore path renamed).

## 2. Full file structure (as it should sit in your repo root)

```
index.html                     Main site — dashboard, events, finances,
                                announcements, tasks, suggestions,
                                Team & Roles grid, Gallery tab
role-workspace.html            Generic workspace template, used by 15 roles
                                via ?role=<id> query param
accountant-workspace.html      Accountant's Finance Center
joint-secretary-workspace.html Joint Secretary's ID creation + Report Center
photography-workspace.html     Photography's Cloudinary upload + gallery
roles-data.js                  Client-side role list + permission mirror
astra-auth.js                  Login helper (calls /api/session)
report-system.js               Shared "Send Report" modal, used everywhere
package.json.snippet.json      Only dependency: firebase-admin

api/
  data.js                      Generic CRUD for all Firestore collections
                                (events, finances, announcements, tasks,
                                suggestions, budgets, inventory, records,
                                reports)
  session.js                   POST — email+password login (see §5)
  create-member.js             GET (list)/POST (create) member IDs
  cloudinary-sign.js           POST — signed upload signature for photos
  gallery.js                   GET — public photo gallery list
  login.js                     OLD, unused by any page, harmless to keep

lib/
  firebaseAdmin.js             Firebase Admin SDK init (Firestore + Auth +
                                Realtime Database)
  permissions.js                Central role -> permission map (SERVER,
                                authoritative — see §4)
  authToken.js                  Signs/verifies the site's own session token
  cloudinary.js                 Cloudinary signing + Admin API list helper

README_SETUP.md                Full setup instructions, numbered §1-§13
                                (env vars, Firebase Console steps, exact
                                JSON to paste, etc.) — READ THIS FIRST for
                                any deployment question.

Untouched legacy files (still localStorage-based, not yet migrated):
  event-maneger.html, budget-manager.html, task-manager.html,
  announcement-manager.html, management-manager.html
```

## 3. Required environment variables (Vercel)

| Variable | Where to get it |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Firebase Console → Project Settings → Service Accounts → Generate new private key (paste the whole JSON) |
| `FIREBASE_DATABASE_URL` | Firebase Console → Realtime Database |
| `FIREBASE_WEB_API_KEY` | Firebase Console → Project Settings → General → Your apps |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary Dashboard → Settings → API Keys |
| `CLOUDINARY_API_KEY` | same |
| `CLOUDINARY_API_SECRET` | same |

## 4. RBAC — how permissions work

- **Server-authoritative**: `lib/permissions.js` — `ROLE_PERMISSIONS` object,
  keyed by normalized role id (`president`, `event-head`, `accountant`,
  `member`, etc). Every write in `api/data.js` checks this via
  `hasPermission(role, 'domain.action')` — never hardcoded role checks.
- Every role automatically gets `report.create` (merged in via
  `BASE_PERMISSIONS`), so the Daily Report system works everywhere.
- **Client mirror**: `roles-data.js` — `window.ASTRA_PERMISSIONS` +
  `window.ASTRA_ROLES` (the 20 official hierarchy roles + their icons,
  accent colors, responsibility text, and which workspace URL they open).
  This only controls what buttons/tabs *show* — the server is what
  actually enforces access.
- 21st "role", `member`, exists in `ROLE_PERMISSIONS` but is **not** in
  `ASTRA_ROLES` (it has no Team & Roles card / workspace of its own — see
  §7, this is intentional).

## 5. Login flow (all server-side, no Firebase SDK in the browser)

1. Browser POSTs `{ email, password }` to `/api/session`.
2. Server verifies the password itself, via Firebase's Identity Toolkit
   REST API (`FIREBASE_WEB_API_KEY`) — **verification 1**.
3. Server looks up `/members/{uid}` in the Realtime Database —
   **verification 2**. No role there = "Permission denied", even if the
   password was correct.
4. On success, issues the site's own signed token (`lib/authToken.js`),
   stored in `sessionStorage` as `astra_auth_token` /
   `astra_logged_member`. Every subsequent write sends this as
   `Authorization: Bearer <token>`.

`api/login.js` is the old name+password/Firestore-only check — no longer
called by any page, kept only so nothing 404s if something external still
points at it.

## 6. Creating accounts (Joint Secretary's workspace)

Two separate flows, both create a real Firebase Auth user + a
`/members/{uid}` Realtime Database record in one atomic step
(`POST /api/create-member`):

- **"Create ID"** — for the 20 official hierarchy roles (President,
  Secretary, Event Head, etc). Full role dropdown. Optional "Reports To"
  if this office-bearer is also someone's team member.
- **"Create Assistant ID"** — role is hard-fixed to `assistant`, which
  holds **zero permissions of its own** (only the universal
  `report.create`). This is deliberate: no matter which Head an assistant
  reports to, their login can never open that Head's workspace — there's
  no permission left to accidentally share. Fields: name, email, mobile
  number, temporary password, and a **required** "Under Which Head?"
  dropdown. Assistants get their own dashboard — see §7.5 below — not a
  seat in the Head's workspace.

Both enforce **max 5 people per head** — server-side in
`api/create-member.js` (queries `/members` by `reportsTo`), not just in
the UI, so it can't be bypassed by calling the API directly.

`GET /api/create-member` lists members: full list for
Secretary/Joint Secretary/President/VP (`members.view` / `*`); everyone
else only gets their own team (`reportsTo === their role`).

### 7.5 Assistant Dashboard (`assistant-workspace.html`)

A dedicated, minimal dashboard — separate from `role-workspace.html`,
gated to `role === 'assistant'`. Shows:
- Header: which Head they report to (from `member.reportsTo`, now
  returned by `/api/session` at login)
- Stats: Open / Completed / Overdue task counts
- **My Tasks**: only tasks where `task.assignedToUid` matches their own
  uid — not role-wide tasks, not anyone else's
- Send Report button (same shared `report-system.js`)

A Head assigns a task to a specific assistant via a new "Assign To"
dropdown in their own "Add Task" modal (`role-workspace.html`), populated
from their Team tab data. Leaving it blank keeps the task role-wide
(visible only to the Head); picking someone makes it show up in that
assistant's own dashboard too.

Backend allows an assistant to update the *status* of a task assigned to
them (`api/data.js`'s `canEditTasks`: normal `task.edit`/`task.assign`
permission, OR `task.assignedToUid === caller.uid`) without granting them
any broader task permission.

## 7. Every role's workspace — what's real right now

| Role | Workspace | What works |
|---|---|---|
| President, VP | Main dashboard (`index.html`) | Full access via wildcard `*` |
| Accountant | `accountant-workspace.html` | Dashboard, transactions (search/filter/approve/delete), Add Income/Expense, budgets view, CSV export, Send Report |
| Joint Secretary | `joint-secretary-workspace.html` | Create ID, Create Member ID, member list, **Central Report Center** (see §8), Send Report |
| Photography | `photography-workspace.html` | Cloudinary photo upload (signed), gallery grid, Send Report |
| All other 15 roles (Deputy President, Vice Deputy President, Secretary, Event Head, Event Manager, Store Manager, Marketing Head, Social Media Head, Technical Head, Cultural Head, Discipline Head, Student Coordinator, both Representatives, Strategy & Planning Head, Creativity Head) | `role-workspace.html?role=<id>` (shared template) | Overview, Tasks (shared `tasks` collection, filtered by role), Records (generic log, own-role-only unless wildcard), Team tab (shows their up-to-5 members with phone numbers), Send Report. Store Manager additionally gets an Inventory tab. |
| `member` (general/team members) | **none** — by design, see below | Just an account; no dashboard of their own yet |

Team & Roles cards on the main site (`index.html`) are generated from
`roles-data.js` and show: Open Workspace (if authorized) / Access
Restricted (logged in, wrong role) / Role Information (not applicable
anymore — every role above is now "functional").

## 8. Daily Report System + Report Center

- `report-system.js` → `AstraReports.open(roleId, roleName, department)`
  opens a shared modal (date, priority, title, description, tasks done/
  pending, achievements, issues, related event, next-day plan). Every
  workspace has a "Send Report" button wired to this.
- Saves to the shared `reports` Firestore collection via `/api/data`.
  Author can edit their own report; only `report.review`/`report.approve`
  holders (Joint Secretary, President, VP) can edit/review anyone's.
- **Joint Secretary's Report Center** (default tab on login): stat cards
  (Today/Pending/Approved/Needs Revision/Total), live "Today's Work"
  feed, search + filters (status/role/date), table (cards on mobile),
  View → Approve/Reject/Request Revision (with optional comment).
- **"PDF"**: opens a new tab with a clean, officially-formatted printable
  report (club header, member/role/date table, all sections, approval
  line, generated timestamp) and auto-triggers the browser Print dialog —
  "Save as PDF" there produces a real PDF with zero extra dependencies.
  Works for a single report or multiple checked ones at once ("Print
  Selected").
- Statuses: `Submitted / Approved / Needs Revision / Rejected` (simpler
  than the originally-requested Draft/Received/Under Review/Archived —
  can be expanded later if needed).

## 9. Photo Gallery (Cloudinary)

- Uploads are **signed server-side** (`api/cloudinary-sign.js` uses
  `CLOUDINARY_API_SECRET`, never sent to the browser) — Photography
  workspace uploads straight to Cloudinary using that signature.
- `api/gallery.js` (public, no login needed) lists everything in the
  `astra-gallery` Cloudinary folder via the Admin API.
- Public **Gallery** tab on the main site + inside the Photography
  workspace both call this endpoint.
- No Firestore collection needed for gallery — Cloudinary holds the
  images + captions/tags itself.

## 10. Known limitations / explicitly deferred (not built yet)

These were requested in the most recent master-prompt but intentionally
NOT built yet, to keep scope realistic per phase:

- Homepage leadership photo carousel (auto-scroll) + dedicated "View All
  Members" page with profile photos
- Gallery albums (draft/review/publish workflow), masonry layout,
  lightbox with zoom/next/previous
- Global search across members/events/tasks/reports/etc.
- Centralized notifications system with unread counts
- Audit log (`auditLogs` collection) tracking login/approve/reject/etc.
- Deep event-centric data model (one Event object linking budget, tasks,
  inventory, photography, marketing, etc. — currently these are
  independent collections connected only loosely by free-text fields)
- True binary PDF generation (currently: browser print-to-PDF, see §8)
- Migrating the 5 legacy manager HTML pages off localStorage onto the
  same Firebase/RBAC architecture as everything else
- `member` role has no workspace of its own yet (they're created so they
  appear under a Head's Team tab, but can't log in to see anything
  personalized themselves — worth asking whether they need one). Note:
  the newer `assistant` role (see §7.5) supersedes `member` for the
  "team member under a Head" use case and does have its own dashboard;
  `member` is still available but likely redundant now.

## 11. Known one-time migration note

The Firestore path changed from `artifacts/nexora-club-app/...` to
`artifacts/astra-club-app/...` during the rebrand. If real data existed
under the old path before the rename, it's still in Firestore but the
site no longer reads it. Ask if this needs migrating.

## 12. Where to look for anything else

`README_SETUP.md` in the project root has the full numbered setup log
(§1 through §13) with exact steps, JSON snippets, and reasoning for every
decision made along the way — treat it as the detailed changelog behind
this summary.
