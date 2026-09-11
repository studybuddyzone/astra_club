# Nexora Backend Setup (Vercel + Firebase Admin SDK)

## 1. Where these files go
Copy this into your existing GitHub repo (the one already connected to Vercel), keeping the same folder names:

```
your-repo/
├── nexora_updated.html      <- already in your repo, replace with the updated version
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

## 5. What changed in nexora_updated.html
- Removed all direct Firebase client SDK calls (no more `getFirestore`, `setDoc`, `onSnapshot` in the browser).
- The page now calls `/api/data` to read/write data, and `/api/login` to verify officer logins.
- Data refreshes automatically every 10 seconds, plus whenever the tab regains focus.

## 6. First login after this change
Until you add real members to a Firestore collection called `nexora_members`,
login falls back to the one hardcoded account (`Anurag` / `Anurag7028@2026`,
role `president`) defined in `api/login.js`. Add real member documents to
`nexora_members` in Firestore (each with `name`, `password`, `role`) and the
fallback will stop being used automatically.

## 7. Not yet covered (next step)
`event-maneger.html`, `budget-manager.html`, `announcement-manager.html`,
`task-manager.html`, and `management-manager.html` still read/write via
`localStorage` or the old client Firebase SDK. Once your official roles list
is ready, these should be updated the same way — I can do that next.

⚠️ **Known inconsistency:** `management-manager.html` has its own separate,
local-only login (hardcoded `Govind` / `Anurag` accounts in that file) that
is completely disconnected from `/api/login.js` and `nexora_members` in
Firestore. Until this page is migrated, a member added in Firestore will
NOT be able to log into `management-manager.html`, and vice versa. Treat
`/api/login.js` + Firestore as the source of truth going forward.

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
      "email": "you@nexora.club",
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
  dashboard, plus a new `budgets` collection (read-only here; still needs a
  Budget Manager UI to populate it — `budget-manager.html` is currently an
  empty file).
- The **Team & Roles** tab on the main dashboard is now generated from
  `roles-data.js` instead of static "Details coming soon." cards. Each card
  shows real responsibilities and a permission-aware button: "Open
  Workspace" (Accountant), "Full Dashboard Access" (President/VP, via the
  existing dashboard), "Access Restricted" (logged in, wrong role), or
  "Role Information" (workspace not built yet — every other role, next in
  the roadmap).
- `api/data.js` now also accepts `budgets` and `inventory` as collections,
  ready for the Budget/Store Manager phases.
