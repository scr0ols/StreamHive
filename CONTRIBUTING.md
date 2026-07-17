# Contributing to StreamHive

Thank you for taking the time to contribute! Please read these guidelines before opening an issue or pull request.

> [!IMPORTANT]
> This project has a [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

---

## Ways to contribute

- **Bug reports** — open an issue describing what happened, what you expected, and your environment (browser, OS)
- **Feature requests** — open an issue describing the use case before writing code, so the approach can be discussed first
- **Code changes** — bug fixes, performance improvements, approved features

---

## Before opening a pull request

> [!WARNING]
> Target the **`dev`** branch. Do **not** target `main` — it is the stable branch, merged from `dev` manually, only when a milestone is ready. Pull requests against `main` will not be merged.

- One change per PR — keep scope focused
- For significant changes, open an issue first to discuss the approach before investing time in the implementation

---

## Commit message convention

Use a semantic prefix:

| Prefix | When to use |
|---|---|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `perf:` | Performance improvement |
| `refactor:` | Code change with no behaviour change |
| `docs:` | Documentation only |
| `test:` | Adding or fixing tests |
| `chore:` | Build, config, or tooling changes |

> [!NOTE]
> Example: `feat: add SmartVoiceSwitch audio mode`

---

## Setting up locally

**Requirements:** Node.js (LTS), Git

```bash
git clone https://github.com/scr0ols/StreamHive.git
cd StreamHive
git checkout dev
```

> [!NOTE]
> Full install/run instructions aren't available yet — the project isn't runnable end to end until the frontend and backend scaffolds land (Phase 0). Check the [Setup](README.md#setup) section of the README for current status.

---

## Code style

- Follow the conventions already present in the file you're editing
- No commented-out code, no leftover debug prints
- Keep changes scoped — don't refactor unrelated code in the same PR

---

## Questions

> [!TIP]
> Open an issue if you're unsure about anything before starting work.
