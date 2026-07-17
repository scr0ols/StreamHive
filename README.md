# StreamHive

Watch 2 to 5 Twitch channels at once in a single grid, using the official Twitch Embed API for video and chat. No setup required on the streamers' side. Three audio modes (Selection, Both/All, and an exploratory SmartVoiceSwitch), plus layout templates saved to a lightweight account via Twitch OAuth login.

## Stack

- **Frontend:** React (Vite)
- **Backend:** Node.js + Express
- **Database:** Postgres, hosted free on [Neon](https://neon.tech)
- **Hosting:** Backend on Render's free web service tier, frontend on a static host (Vercel/Netlify)

Full architecture, data model, and reasoning behind these choices are kept in local planning notes outside this repository (not part of what's cloned from GitHub).

## Status

Early planning complete, implementation starting.

## Setup

Not yet runnable end to end. This section will be filled in as the backend and frontend scaffolds land (Phase 0 of the implementation plan).

## Branch workflow

- `dev` — all development happens here.
- `main` — stable branch, merged from `dev` manually, only when a milestone is ready.
- `docs` — owns documentation-only changes (wiki, README, contributing guidelines, PR templates).

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `perf:`, `test:`).
