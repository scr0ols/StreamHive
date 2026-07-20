# StreamHive

Watch 2 to 5 Twitch channels at once in a single grid, using the official Twitch Embed API for video and chat. No setup required on the streamers' side. Three audio modes (Selection, Both/All, and an exploratory SmartVoiceSwitch), plus layout templates saved to a lightweight account via Twitch OAuth login.

**Live app:** [stream-hive-ten.vercel.app](https://stream-hive-ten.vercel.app) — the backend runs on Render's free tier, so the first request after a period of inactivity can take up to a minute to wake up.

## Stack

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** Postgres, hosted free on [Neon](https://neon.tech)
- **Hosting:** Backend on Render's free web service tier, frontend on a static host (Vercel/Netlify)

Full architecture, data model, and reasoning behind these choices are kept in local planning notes outside this repository (not part of what's cloned from GitHub).

## Status

The core viewing experience works end to end against real Twitch channels:
a 2–5 channel video grid with add/remove, both audio modes (Selection with
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
   ```
2. `npm install`
3. `npm run dev`

**Frontend** (`frontend/`):

1. `npm install`
2. `npm run dev`, then open `http://localhost:5173`

No `.env` needed for local dev — it defaults to `http://localhost:3000`. For
a deployed build, set `VITE_BACKEND_URL` to the deployed backend's URL
(Vite only exposes `VITE_`-prefixed vars to client code, and only bakes them
in at build time, so this has to be set wherever the frontend is built, not
just at runtime).

Sessions are in-memory on the backend for now (they just map a session
cookie to a `users.id`), so everyone has to re-login on every backend
restart. Users and templates themselves are persisted in Postgres.

## Branch workflow

- `dev` — all development happens here.
- `main` — stable branch, merged from `dev` manually, only when a milestone is ready.
- `docs` — owns documentation-only changes (wiki, README, contributing guidelines, PR templates).

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`).
