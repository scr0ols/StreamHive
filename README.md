# StreamHive

Watch 2 to 5 Twitch channels at once in a single grid, using the official Twitch Embed API for video and chat. No setup required on the streamers' side. Three audio modes (Selection, Both/All, and an exploratory SmartVoiceSwitch), plus layout templates saved to a lightweight account via Twitch OAuth login.

## Stack

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** Postgres, hosted free on [Neon](https://neon.tech)
- **Hosting:** Backend on Render's free web service tier, frontend on a static host (Vercel/Netlify)

Full architecture, data model, and reasoning behind these choices are kept in local planning notes outside this repository (not part of what's cloned from GitHub).

## Status

Twitch OAuth login and Postgres-backed layout templates (save, list, edit,
delete) work end to end, but only through a throwaway test page, there's no
product UI yet. The grid UI itself is next.

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

Sessions are in-memory on the backend for now (they just map a session
cookie to a `users.id`), so everyone has to re-login on every backend
restart. Users and templates themselves are persisted in Postgres.

## Branch workflow

- `dev` — all development happens here.
- `main` — stable branch, merged from `dev` manually, only when a milestone is ready.
- `docs` — owns documentation-only changes (wiki, README, contributing guidelines, PR templates).

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`).
