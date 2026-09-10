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
