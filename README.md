# StreamHive

Watch 2 to 6 Twitch channels at once in a single grid — one screen, sane audio, no setup required on the streamers' side. Built on the official Twitch Embed API for video and chat.

<!-- TODO: screenshot/GIF of the grid in action, once the honeycomb-identity UI lands on dev -->

## Features at a glance

- **2–6 channel grid** with add/remove, automatic layout, and clear offline detection per panel
- **Two audio modes:** Selection (one channel audible, focus-follows-audio layout) and Both/All (every channel audible, independent volume per panel) — each viewer can save which one starts a new session
- **Dedicated chat bar** — one tab per channel, all pre-loaded so switching tabs never reloads chat, following the active audio channel by default with manual override
- **Native Twitch actions per panel** — channel link, follow, donate — without leaving the grid
- **Twitch OAuth login**, with anonymous read-only viewing available without an account
- **Saved layout templates** tied to a lightweight account, plus an "Online now" menu (followed live channels + trending live channels)

> [!NOTE]
> A third audio mode, SmartVoiceSwitch (automatic voice-activity switching and duplicate-audio cancellation), is an exploratory research idea, not a shipped feature — see the [wiki's roadmap](../../wiki/Roadmap) for its honest status.

## Stack

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** Postgres, hosted free on [Neon](https://neon.tech)
- **Hosting:** Backend on Render's free web service tier, frontend on a static host (Vercel/Netlify)

Full architecture, data model, and reasoning behind these choices are kept in local planning notes outside this repository (not part of what's cloned from GitHub). The [wiki](../../wiki) has an architecture overview at a product level.

## Status

The core viewing experience works end to end against real Twitch channels: a 2–6 channel video grid with add/remove, both audio modes (Selection with focus-follows-audio layout, Both/All with per-panel volume), online/offline detection via a backend Helix poll, a chat bar with one always-mounted tab per channel (chat follows the active audio channel until manually overridden), and native per-panel actions (follow, donate, channel link). Twitch OAuth login is wired into the app shell and gates the follow action; anonymous read-only viewing works without login.

Account features (Phase 2) are also live: saving/loading/deleting named grid templates from the top bar (login-gated, with channel validation on load — renamed or banned channels render a "channel not found" panel), and an "Online now" menu with two sections — channels the logged-in user follows that are live right now, and the current top live channels on Twitch by viewer count — each with one-click add-to-grid. Following requires the `user:read:follows` OAuth scope; users who logged in before that scope was added are re-prompted to log in. Twitch tokens are refreshed server-side on expiry; nothing from the Twitch API is ever persisted. A small preferences panel lets a viewer set their own defaults (starting audio mode, chat bar open/closed, light/dark theme), stored locally per browser.

## Setup

Requires a Twitch app (Confidential client type) registered in the [Twitch Developer Console](https://dev.twitch.tv/console), with `http://localhost:3000/auth/twitch/callback` as a registered redirect URI, and a Postgres database (this project uses [Neon](https://neon.tech)'s free tier).

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

Sessions are in-memory on the backend for now (they just map a session cookie to a `users.id`), so everyone has to re-login on every backend restart. Users and templates themselves are persisted in Postgres.

## Learn more

The [wiki](../../wiki) covers the product side in more depth: the problem StreamHive solves, the audio modes explained for an end user, an architecture overview, and the roadmap. This README stays focused on setup and current status.

## Branch workflow

- `dev` — all development happens here.
- `main` — stable branch, merged from `dev` manually, only when a milestone is ready.
- `docs` — owns documentation-only changes (wiki, README, contributing guidelines, PR templates).

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`).
