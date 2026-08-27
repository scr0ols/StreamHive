# StreamHive

Watch 1 to 6 Twitch channels at once in a single grid, using the official Twitch Embed API for video and chat. No setup required on the streamers' side. Three audio modes (Selection, Both/All, and an exploratory SmartVoiceSwitch), plus layout templates saved to a lightweight account via Twitch OAuth login.

**Live app:** [stream-hive-ten.vercel.app](https://stream-hive-ten.vercel.app) — the backend runs on Render's free tier, so the first request after a period of inactivity can take up to a minute to wake up.

## Stack

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** Postgres, hosted free on [Neon](https://neon.tech)
- **Hosting:** Backend on Render's free web service tier, frontend on a static host (Vercel/Netlify)

Full architecture, data model, and reasoning behind these choices are kept in local planning notes outside this repository (not part of what's cloned from GitHub).

## Status

The core viewing experience works end to end against real Twitch channels:
a 1–6 channel video grid with add/remove, both audio modes (Selection with
focus-follows-audio layout, Both/All with per-panel volume), online/offline
detection via a backend Helix poll, a chat bar with one always-mounted tab
per channel (chat follows the active audio channel until manually
overridden), and native per-panel actions (follow, donate, channel link).
Twitch OAuth login is wired into the app shell and gates the follow action;
anonymous read-only viewing works without login.

Account features (Phase 2): saving/loading/deleting named grid templates
from the top bar (login-gated, with channel validation on load — renamed or
banned channels render a "channel not found" panel), and an "Online now"
menu with two sections — channels the logged-in user follows that are live
right now, and the current top live channels on Twitch by viewer count —
each with one-click add-to-grid (following requires the `user:read:follows`
OAuth scope; users who logged in before the scope change are re-prompted to
log in). Twitch tokens are refreshed server-side on expiry; nothing from
the Twitch API is ever persisted.

## Setup

Requires a Twitch app (Confidential client type) registered in the
[Twitch Developer Console](https://dev.twitch.tv/console), with
`http://localhost:3000/auth/twitch/callback` as a registered redirect URI,
and a Postgres database (this project uses [Neon](https://neon.tech)'s free
tier).

**Backend** (`backend/`):

1. Create a `.env` file (never committed) with:
   ```
   PORT=3000
   FRONTEND_URL=http://localhost:5173
   TWITCH_CLIENT_ID=<your client id>
   TWITCH_CLIENT_SECRET=<your client secret>
   TWITCH_REDIRECT_URI=http://localhost:3000/auth/twitch/callback
   DATABASE_URL=<your Postgres connection string>
   TOKEN_ENCRYPTION_KEY=<64-char hex string, 32 bytes, for AES-256-GCM>
   ```
   Generate `TOKEN_ENCRYPTION_KEY` with `openssl rand -hex 32`. The backend
   refuses to start without it. Keep it stable: changing it makes every stored
   token undecryptable and forces all users to log in again.
2. Run `schema.sql` against that database to create the `users`, `templates`, and `sessions` tables.
3. `npm install`
4. `npm run dev`

For a deployed backend, also set `NODE_ENV=production` (the backend only marks
the session cookie `Secure` outside local dev) and point `TWITCH_REDIRECT_URI`
at the *frontend's* callback URL, e.g.
`https://<your-frontend>/auth/twitch/callback`, so the callback reaches the
backend through the proxy described below. That URL also has to be registered
under OAuth Redirect URLs in the Twitch console.

**Frontend** (`frontend/`):

1. `npm install`
2. `npm run dev`, then open `http://localhost:5173`

No `.env` needed for local dev — it defaults to `http://localhost:3000`.

A deployed build needs no backend URL either, and `VITE_BACKEND_URL` should be
left unset: `vercel.json` proxies `/api/*` and `/auth/*` to the backend, so the
frontend calls them as relative paths on its own origin. That keeps the session
cookie first-party. Hosting the two on separate domains instead makes it a
third-party cookie, which browsers drop — the login then completes without ever
signing you in. Update the `destination` URLs in `vercel.json` if the backend
moves.

Setting `VITE_BACKEND_URL` overrides the proxy and calls the backend directly;
it exists for local dev and non-proxied hosts. Vite only exposes `VITE_`-prefixed
vars to client code and bakes them in at build time, so it has to be set wherever
the frontend is built, not just at runtime.

Sessions map a session cookie to a `users.id` and are persisted in Postgres
(see `schema.sql`), so they survive a backend restart or redeploy.

## Branch workflow

- `dev` — all development happens here.
- `main` — stable branch, merged from `dev` manually, only when a milestone is ready.
- `docs` — owns documentation-only changes (wiki, README, contributing guidelines, PR templates).

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`).
