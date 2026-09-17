# Astra Backend Setup (Vercel + Firebase Admin SDK)

## 1. Where these files go
Copy this into your existing GitHub repo (the one already connected to Vercel), keeping the same folder names:

```
your-repo/
├── astra_updated.html      <- already in your repo, replace with the updated version
├── api/
│   ├── login.js
│   └── data.js
├── lib/
│   ├── firebaseAdmin.js
│   └── authToken.js
└── package.json             <- your existing file, just add the dependency below
```

## 2. Add the dependency
Open your repo's existing `package.json` and add `firebase-admin` to `"dependencies"`
(see `package.json.snippet.json` for the exact line). If you don't have a
`package.json` yet, run this in your repo folder:

```
npm init -y
npm install firebase-admin
```

## 3. Environment Variables (Vercel Dashboard -> Project -> Settings -> Environment Variables)
You already generated these — just make sure both are added, for Production, Preview, and Development:

- `FIREBASE_SERVICE_ACCOUNT` — the full JSON from your Firebase Admin SDK key file (paste the whole `{...}`)
- `ADMIN_ACTION_SECRET` — any long random string you make up (used to sign officer login sessions)

**Never commit the service account JSON file to GitHub.** It only goes into the Vercel environment variable.

## 4. Push to GitHub
```
git add .
git commit -m "connect backend via Firebase Admin SDK"
git push
```
Vercel will auto-deploy. Your endpoints will be live at:
- `https://your-site.vercel.app/api/login`
- `https://your-site.vercel.app/api/data?collection=events` (and finances/announcements/tasks/suggestions)

## 5. What changed in astra_updated.html
- Removed all direct Firebase client SDK calls (no more `getFirestore`, `setDoc`, `onSnapshot` in the browser).
- The page now calls `/api/data` to read/write data, and `/api/login` to verify officer logins.
- Data refreshes automatically every 10 seconds, plus whenever the tab regains focus.

## 6. First login after this change
Until you add real members to a Firestore collection called `astra_members`,
login falls back to the one hardcoded account (`Anurag` / `Anurag7028@2026`,
role `president`) defined in `api/login.js`. Add real member documents to
`astra_members` in Firestore (each with `name`, `password`, `role`) and the
fallback will stop being used automatically.

## 7. Not yet covered (next step)
`event-maneger.html`, `budget-manager.html`, `announcement-manager.html`,
`task-manager.html`, and `management-manager.html` still read/write via
`localStorage` or the old client Firebase SDK. Once your official roles list
is ready, these should be updated the same way — I can do that next.

⚠️ **Known inconsistency:** `management-manager.html` has its own separate,
local-only login (hardcoded `Govind` / `Anurag` accounts in that file) that
is completely disconnected from `/api/login.js` and `astra_members` in
Firestore. Until this page is migrated, a member added in Firestore will
NOT be able to log into `management-manager.html`, and vice versa. Treat
`/api/login.js` + Firestore as the source of truth going forward.

## 8. Role-Based Access Control (RBAC) — added
- `lib/permissions.js` — the single, server-enforced role → permission map.
  Every write in `api/data.js` now checks this instead of a hardcoded
  president/VP-only list.
- `roles-data.js` — the client-side mirror (role metadata: icon, accent
  color, responsibilities, tags, and which workspace each role opens). Both
  `index.html` and every `*-workspace.html` page load this file. Keep it in
  sync with `lib/permissions.js` when you add/change roles.
- `accountant-workspace.html` — the first live role workspace ("Finance
  Center"): dashboard, transactions (search/filter/approve/delete), add
  income/expense forms, a budgets view, and CSV export/print reports. It
  reads/writes the same `finances` Firestore collection as the main
  dashboard, plus a new `budgets` collection.
- The **Team & Roles** tab on the main dashboard is generated from
  `roles-data.js` instead of static "Details coming soon." cards. Each card
  shows real responsibilities and a permission-aware button.
- `api/data.js` accepts `budgets`, `inventory`, and `records` as
  collections (see §10).

## 9. Real Firebase Auth + Realtime Database login — added

Login works with two independent checks, and **all of it happens on the
server** — the browser never loads any Firebase SDK or config file, it only
ever talks to your own `/api/session` endpoint.

### One-time setup (you do this in the Firebase Console)
1. **Authentication** → Sign-in method → enable **Email/Password**.
2. **Realtime Database** → Create database (if you don't have one yet) →
   note the URL, it looks like
   `https://YOUR-PROJECT-default-rtdb.firebaseio.com` or
   `...-default-rtdb.<region>.firebasedatabase.app`.
3. **Project Settings → General** → scroll to "Your apps" → if there's no
   web app yet, add one (you don't need to use its SDK snippet, just need
   the key) → copy the **Web API Key** shown there.
4. In your hosting environment (Vercel Project Settings → Environment
   Variables), add:
   - `FIREBASE_DATABASE_URL` = the Realtime Database URL from step 2
   - `FIREBASE_WEB_API_KEY` = the Web API Key from step 3
   (`FIREBASE_SERVICE_ACCOUNT` should already be set from the original setup.)
5. **Realtime Database → Rules**: set both `.read` and `.write` to `false`
   at the root. Only your backend (Admin SDK, which always bypasses rules)
   should ever touch `/members`.

That's it — there is no client-side config file to edit. `FIREBASE_WEB_API_KEY`
is only ever read inside `api/session.js`, on the server, via
`process.env.FIREBASE_WEB_API_KEY`.

> Note: a Firebase Web API Key is not a secret in the way a service-account
> key is — Google's own docs say it's safe even in client code, since it
> only identifies which project an Auth request is for. Keeping it
> server-side here isn't required for security, it's simply what you asked
> for: nothing Firebase-related loads in the browser, and your locked-down
> `.read`/`.write: false` rules remain the actual data-access boundary.

### Creating your own (first) account
Since there's no Joint Secretary yet to create your ID, create the very
first one by hand, once:
1. **Authentication → Users → Add user** — enter your email + a password.
2. Copy the **User UID** Firebase just generated for that user.
3. **Realtime Database → Data** — paste this under the root, replacing
   `PASTE_THE_UID_HERE` with the UID you copied:

```json
{
  "members": {
    "PASTE_THE_UID_HERE": {
      "name": "Your Name",
      "email": "you@astra.club",
      "role": "president",
      "department": null,
      "status": "active",
      "createdAt": 1734000000000
    }
  }
}
```

   `role` must be one of the normalized role IDs listed in
   `lib/permissions.js` (e.g. `president`, `vice-president`,
   `joint-secretary`, `accountant`, `photography`, etc.) — these are the
   same IDs used throughout `roles-data.js`.

4. Log in on the website with that email/password. You now have full
   (`*`) access, including the Joint Secretary's **Create ID** panel at
   `joint-secretary-workspace.html`, from which every other member's
   login should be created from now on — no more manual UID copying.

### How login works now (every page)
1. Browser posts `{ email, password }` to `POST /api/session` — nothing
   else, no Firebase code runs client-side.
2. **Verification 1 (password):** the server calls Firebase's Identity
   Toolkit REST API itself, using `FIREBASE_WEB_API_KEY`, to check the
   email/password pair — the same check `signInWithEmailAndPassword()`
   does internally, just run on the backend instead of the browser.
3. **Verification 2 (role):** once the password checks out, the server
   looks up `/members/{uid}` in the Realtime Database. No record there (or
   no `role` field) = **"Permission denied,"** even though the password
   was correct.
4. On success, `/api/session` issues the same signed session token the
   rest of the site (`/api/data`, `/api/create-member`) already expects,
   so nothing else had to change.

### Creating more member IDs
Open `joint-secretary-workspace.html` while logged in as Joint Secretary,
Secretary, President, or VP → **Create ID** → fill in name, email,
temporary password, and role. This calls `POST /api/create-member`, which
creates the Firebase Auth account AND the `/members/{uid}` role record
together, atomically, on the server.

`api/login.js` (the old name+password/Firestore check) is no longer used
by any page but is left in place rather than deleted, in case you have
external scripts still calling it.

## 10. Rebranded to "Astra" — and all remaining roles activated

Every visible "Nexora" was renamed to **"Astra"** — page titles, headers,
comments, session-storage keys (`astra_auth_token`, `astra_logged_member`,
`astra_theme`), and the shared JS globals (`window.ASTRA_ROLES`,
`window.ASTRA_PERMISSIONS`, `window.AstraAuth`). The login helper file is
now `astra-auth.js` (renamed from `nexora-auth.js`).

⚠️ **One consequence you should know about:** the Firestore path used by
`api/data.js` changed from `artifacts/nexora-club-app/...` to
`artifacts/astra-club-app/...`. If you had already saved real events,
finances, tasks, etc. under the old path, that data still exists in
Firestore but the site will no longer read from it — it's reading a fresh,
empty path now under the new name. If that matters to you, tell me and I
can either point the code back at the old path name or write a one-time
migration script to copy the documents across.

### Every role now has a working workspace
Previously only Accountant and Joint Secretary had a real workspace behind
their "Team & Roles" card. **Every remaining role is now activated** —
this is the workflow layer you asked for; deeper, bespoke features per
role (Kanban boards, content calendars, incident escalation, etc.) are
still on the roadmap, but each role can now genuinely log in and use
something real:

- **Photography** → `photography-workspace.html` — the new Cloudinary
  gallery (see §11 below).
- **Every other role** (Deputy President, Vice Deputy President, Secretary,
  Event Head, Event Manager, Store Manager, Marketing Head, Social Media
  Head, Technical Head, Cultural Head, Discipline Head, Student
  Coordinator, both Representatives, Strategy & Planning Head, Creativity
  Head) → a shared **`role-workspace.html?role=<id>`** template, which
  gives each of them:
  - **Overview** — their responsibilities + live task/record counts
  - **Tasks** — reads/writes the same shared `tasks` collection the
    original Task Manager uses, filtered to `assignedRole` matching that
    role
  - **Records** — a new generic `records` collection for notes, minutes,
    incident reports, campaign updates, whatever that role needs to log.
    Each record is tagged with the creator's role; only President/VP can
    see across every role's records or delete someone else's entry.
  - **Inventory** (Store Manager only) — a simple item/quantity/min-stock
    list against the `inventory` collection.

  Nobody needs a new account type for this — the same login, the same
  `/members/{uid}` role, the same permission matrix in
  `lib/permissions.js` already decide what each person can open.

## 11. Photo Gallery — Cloudinary — added

Uploading and the public gallery are both live; you just need to drop in
your Cloudinary keys.

### Setup
1. Cloudinary Dashboard → Settings → **API Keys** → copy:
   - Cloud name
   - API Key
   - API Secret
2. Add three environment variables in Vercel:
   - `CLOUDINARY_CLOUD_NAME`
   - `CLOUDINARY_API_KEY`
   - `CLOUDINARY_API_SECRET` (never put this in any client-side file)

That's it — no Cloudinary upload preset needs configuring, because uploads
are **signed** server-side (see `api/cloudinary-sign.js`), not unsigned.

### How it works
- **Photography workspace** (`photography-workspace.html`, gated by the
  `media.manage` permission): pick one or more photos, optional
  event/caption, hit upload. The browser first asks
  `POST /api/cloudinary-sign` for a one-time signature (your API secret
  never leaves the server), then uploads the file straight to Cloudinary
  using that signature. Every photo lands in the `astra-gallery` folder in
  your Cloudinary account.
- **Public gallery**: both the main site's new **Gallery** tab and the
  Photography workspace call `GET /api/gallery`, which lists everything in
  `astra-gallery` via Cloudinary's Admin API (server-side only — visitors
  never see your API secret). No login needed to *view* the gallery, only
  to *upload* to it.
- If the three env vars aren't set yet, the Gallery tab shows an empty
  state instead of erroring, and the workspace shows a banner telling you
  what's missing.

## 12. Team members under Heads (max 5 each) — added

When creating an ID from the Joint Secretary's **Create ID** panel, there
are two new fields:
- **Contact Number** — stored on the member record.
- **Reports To (Head)** — pick which Head/role this person is a team
  member under (e.g. Event Head). Leave it as "None" for office-bearers
  who aren't part of anyone's team. The dropdown shows a live `x/5` count
  per head and disables any head that's already full — **the backend also
  enforces the cap of 5**, so it can't be bypassed by calling the API
  directly.

Once assigned, that person automatically shows up — name, contact number,
email — in a new **Team** tab inside that Head's own `role-workspace.html`.
A Head only ever sees their own team this way; only Secretary, Joint
Secretary, and President/VP can see the full member list across every
role (via `members.view` / `*`).

> Performance note: team lookups query `/members` filtered by `reportsTo`.
> For a large member list, add an index in Realtime Database → Rules:
> `{ "rules": { "members": { ".indexOn": ["reportsTo"] } } }` — not
> required to work, just keeps queries fast as the roster grows.

## 13. Daily Work Report System + Joint Secretary Report Center — added

Every role now has a **Send Report** button (top-right of their
workspace), and Joint Secretary has a full **Central Report Center**.

### How it works
- `report-system.js` — one shared modal/form used by every workspace
  (`role-workspace.html`, `accountant-workspace.html`,
  `photography-workspace.html`, `joint-secretary-workspace.html`). Fields:
  date, priority, work title/description, tasks completed/pending,
  achievements, issues, related event, next-day plan. Name/role/department/
  timestamp are filled in automatically from the logged-in session.
- Reports save to the shared `reports` Firestore collection via the same
  `/api/data` endpoint everything else uses. **Everyone has
  `report.create`** now (added as a base permission every role gets
  automatically — see `lib/permissions.js`), and can edit their own report
  after submitting; only Joint Secretary/President/VP (`report.review` /
  `report.approve` / `*`) can edit or review someone else's.
- **Joint Secretary's Report Center** (now the default tab when they log
  in): dashboard cards (Today / Pending / Approved / Needs Revision /
  Total), a live "Today's Work" summary, search + filters (status, role,
  date), and a table (cards on mobile) with **View → Approve / Reject /
  Request Revision**. Comments are asked for on Reject/Revision.
- **PDF**: rather than add a heavy PDF-generation dependency, "Download
  PDF" opens a clean, officially-formatted print view (club header, report
  ID, member/role/date table, all sections, reviewer/approval line, footer
  with a generated timestamp) in a new tab and triggers the browser's
  Print dialog — choosing "Save as PDF" there produces a proper PDF with
  zero extra setup. **Print Selected** does the same for multiple
  checked reports at once (each report gets its own page).

### What's intentionally simpler than the full spec, for now
- Statuses are `Submitted / Approved / Needs Revision / Rejected` (no
  separate Draft/Received/Under Review/Archived states yet).
- No true binary PDF library (e.g. `pdfkit`) — the print-to-PDF flow above
  covers "professional PDF" without adding a new dependency; say the word
  if you'd rather have server-generated PDF files instead.
- Reports aren't yet cross-linked to specific `taskId`/`eventId` records
  beyond the free-text "Event Related" field.

These are the next logical additions on top of what's built — the
end-to-end flow (submit → central inbox → review → approve/reject →
printable record) is fully working today.

## 14. Assistant role — fixed the "team member" design flaw

Earlier, team members created under a Head used a generic `member` role
plus `reportsTo`. You correctly flagged that this was the wrong model —
what was actually needed was a role that can **never** open a Head's own
workspace, no matter which Head they're placed under, plus a dashboard of
their own.

- **New role: `assistant`** — holds **zero permissions** in
  `lib/permissions.js` (only the universal `report.create` from
  `BASE_PERMISSIONS`). Because `role-workspace.html`'s access check is
  `your own role === this role, OR you hold the specific permission this
  role needs`, an assistant can never pass either check for any Head's
  workspace — there is no permission left to accidentally share.
- **"Create ID" vs "Create Member ID" vs "Create Assistant ID"**: Joint
  Secretary's workspace now has "Create ID" (any of the 20 office-bearer
  roles, full dropdown) and "Create Assistant ID" (role fixed to
  `assistant`, no dropdown at all — impossible to mis-pick a Head's role
  by accident). Same 5-per-head cap as before, enforced server-side.
- **New `assistant-workspace.html`** — its own dedicated dashboard
  (parallel to Joint Secretary's), gated to `role === 'assistant'`. Shows
  only tasks assigned **specifically to them** (by uid, not by role), with
  status updates, plus their own Send Report button. Header shows which
  Head they report to (`reportsTo`, now returned by `/api/session` at
  login).
- **Per-person task assignment**: a Head's "Add Task" modal in
  `role-workspace.html` now has an "Assign To" dropdown listing their own
  team (populated from the same Team tab data). Leave it blank for a
  role-wide task (visible only in the Head's own Tasks tab, as before);
  pick a specific assistant and the task also shows up in that assistant's
  own dashboard.
- **Backend**: `api/data.js`'s `tasks` collection now allows a write if
  either the normal `task.edit`/`task.assign` permission is held (Heads),
  **or** the task's `assignedToUid` matches the caller's own uid (an
  assistant updating their own assigned task's status — nothing else).

## 15. Leadership "Post" strip + mobile sidebar — added

### Joint Secretary's new "Post" panel
A new **Post** tab in `joint-secretary-workspace.html` (permission:
`post.manage`, held by Joint Secretary + the President/VP wildcard): pick
a photo, enter Name and Post/Designation, hit Upload. This uses the same
signed-Cloudinary-upload pattern as the Photography workspace, but into a
separate `astra-leadership` folder (kept apart from the general
`astra-gallery` photos) via `api/cloudinary-sign.js`'s new `purpose: 'post'`
mode. `api/posts.js` (public, no login) lists everything in that folder
for display.

### Homepage auto-scrolling strip
The main Dashboard tab in `index.html` now shows every "Post" as a
circular photo + name + designation in a continuously auto-scrolling
horizontal strip (pure CSS animation, no library) — pauses on hover, and
is simply hidden if no posts exist yet or Cloudinary isn't configured.

### Mobile sidebar
The sidebar used to sit full-width **above** the page content on phones,
so anyone on mobile had to scroll past the entire nav list first. It's now
a proper collapsible drawer: a hamburger button appears next to Staff
Login on small screens, and picking any tab automatically closes the
drawer so you land straight on the content. Desktop/laptop layout
(sidebar always visible alongside content) is unchanged.

### Honest note on "mobile + laptop friendly"
This pass fixed the biggest structural mobile issue (the sidebar) and the
new leadership strip is responsive by construction. I did not do a
pixel-by-pixel audit of every existing tab/table on every screen size —
if you spot a specific page/element that looks broken on your phone or
laptop, tell me which one and I'll fix that spot directly rather than
guessing at a full re-audit.

## 16. Self-service Assistant Registration + approval queue — added

Anyone can now apply to become an Assistant themselves — no more typing
every applicant's details into "Create Assistant ID" by hand.

### How it works
1. **`register-assistant.html`** (public, linked from the Team & Roles tab
   as "Register as Assistant"): name, email, mobile, password, which Head
   they'll work under, and a ₹100 registration fee — Cash or Online. If
   Online, they upload a payment screenshot (signed Cloudinary upload,
   `purpose: 'receipt'` in `api/cloudinary-sign.js` — this is the one
   upload purpose that's public/unauthenticated, since the applicant has
   no account yet).
2. **`POST /api/register-assistant`** creates the real Firebase Auth
   account right away (so their chosen password is set), but writes
   **nothing** to `/members/{uid}` yet. Since `/api/session`'s
   verification 2 always checks `/members/{uid}` for a role, this means
   the account genuinely cannot log into anything until approved — no
   separate "disabled" flag needed, the absence of a member record does
   the job. A pending `registrations/{uid}` record is written instead
   (name, email, phone, reportsTo, payment method, receipt URL, status:
   `pending`).
3. **Joint Secretary's new "Registrations" tab**: a badge shows the
   pending count on the sidebar, and a toast fires once per session on
   login if anything's waiting. Pending/Approved/Rejected filters, each
   entry shows the payment receipt thumbnail (click to view full size) or
   a "cash — confirm before approving" note.
4. **Approve** (`POST /api/registrations`, `action: 'approve'`) does the
   final, authoritative 5-per-head capacity check (someone else may have
   filled the last slot since this person applied) and, if there's room,
   writes `/members/{uid}` with `role: 'assistant'` — this is the exact
   same shape `api/create-member.js` already writes, so everything else
   (Assistant Dashboard, Team tabs, permissions) works identically to a
   manually-created assistant. **Reject** deletes the Firebase Auth
   account again, freeing the email up for a future re-application.

### What's intentionally not built here
- No automated payment verification — a human (Joint Secretary) still
  eyeballs the receipt screenshot or confirms cash was actually received
  before hitting Approve. True payment-gateway integration would be a
  separate, larger piece of work.
- No email notifications to the applicant when approved/rejected — they
  find out by trying to log in. Worth adding if you want it.

## 17. Delete ID + delete photos — added

### Deleting a member/assistant ID
Joint Secretary's Members table now has a trash icon per row
(`DELETE /api/create-member`, `members.create` permission). Deleting
removes:
- The **Firebase Auth** account (`auth.deleteUser`)
- The **`/members/{uid}`** Realtime Database record
- The matching **`/registrations/{uid}`** record, if they came through
  self-registration (best-effort — fine if it doesn't exist)

Member/assistant accounts never had a Firestore document to begin with —
only Auth + Realtime Database hold their data — so this removes every
place the account actually lives. Their email becomes free to
re-register or be re-created with immediately.

### Deleting photos
- **Photography workspace**: hover any gallery photo → trash icon appears
  → deletes it from Cloudinary (and therefore the public Gallery tab)
  immediately.
- **Joint Secretary's Post panel**: same pattern — hover a leadership
  photo → trash icon → deletes it from Cloudinary (and therefore the
  homepage auto-scroll strip) immediately.
- Both call the new `POST /api/media-delete` (`{ publicId, purpose }`),
  which uses Cloudinary's Admin API with the server-only API secret — the
  browser never touches the delete credentials.

### Homepage strip duplicate-photo fix
The auto-scroll strip used to always render every photo **twice** (to
make the infinite-loop animation seamless) — with only 1–2 posts uploaded
this looked like a duplicate-upload bug. It now only doubles the list
once there are 5+ posts (where the loop actually needs it); with fewer,
each photo shows exactly once, centered, with no scroll animation.
