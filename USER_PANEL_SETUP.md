# User panel (FAST build) - now runs on the load balancer API

## What changed
* **Only Firebase Auth stays on the phone** (register, email login, Google login, password reset). `js/core/firebase.js` no longer contains Firestore or Storage at all.
* New `js/core/api.js`: after Firebase login it calls `POST /auth/login` (server verifies the token, creates the profile, checks IP / device / state) and keeps a **1-hour session token**. Every call sends `X-Site-Key` + `Authorization` + `X-Device-FP`. When the hour ends it logs in again silently.
* `js/core/live.js`: realtime listeners replaced by polling (balance `/user/sync` 10 s, history 30 s, matches 15 s; pauses when the tab is hidden).
* Deposit, gift code, join + slot, withdraw, settings, notifications, rank, rules, home, wallet, history, Coin Battle, Bomb & Gems and the whole chat now use `/wallet/*`, `/matches/*`, `/user/*`, `/leaderboard`, `/public/*`, `/history/*`, `/game/*`, `/chat/*`.
* New `js/core/geo.js`: state payment ban UI (hides `[data-payment]`, shows the safety message, asks the user to choose his state once).
* Removed: monthly history delete on the phone, `chat-firebase.js` (old chat Firebase project), the direct Firestore code everywhere.

## Setup (5 steps)
1. `js/core/app-config.js` -> `LB_URL` (your load balancer URL) and `SITE_KEY`.
2. Telegram bot -> `/adddomain your-panel-domain.com` -> copy the **site key** into `SITE_KEY`. (https only. The domain must be registered, otherwise every call is `403 domain_not_verified`.)
3. Firebase Console -> Authentication -> Settings -> **Authorized domains**: add the panel domain (needed for Google login).
4. `python3 tools/build.py` (after EVERY edit) and deploy the folder as a static site (Vercel etc.). Local test: `python3 serve.py`.
5. When the new version is live for everybody: lock Firestore with `firebase/firestore.rules.locked` (DB-1, DB-2, DB-3). Until you do this, anybody can still talk to Firestore directly and skip the server checks.

## Good to know
* Free Render servers sleep: the first request after a pause can take 30-60 s (the app waits up to 70 s and shows the normal loading state).
* Polling costs Firestore reads. Rough idea per active user: about 60-100 reads/minute with chat open, much less in the background. Tune the intervals in `live.js` / `chat.js` (`5000 / 40000`) if the bill matters.
* Not tested in a real browser yet - the API layer was tested end-to-end (real load balancer + real server code + fake database). Click through every screen once after deploying.
