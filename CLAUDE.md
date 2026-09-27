# Tenka — notes for Claude

**Read `docs/HANDOVER.md` first.** It has the full history, every design decision, the architecture, and what's next.

## The essentials

- **What it is:** Tenka is a Japanese samurai village builder (three.js, plain ES modules, **no build step**). It is growing a **first-person combat mode** that will replace the old top-down battles.
- **Live:** https://jolliusblecheimer.github.io/Game-3/ (GitHub Pages serves `main`).
  - The first-person sandbox is at `?fp=sandbox`.
  - Backups: `/v1/` `/v2/` `/v3/` `/v4/`.
- **The player** plays mostly on an **iPad**: sometimes touch, sometimes a keyboard with trackpad or mouse, and a **German QWERTZ** keyboard. Every feature must work with keyboard+mouse, keyboard+trackpad and keyboard+touchscreen.
- **Language:** the player writes short messages, often with typos. Answer in plain, simple English. Short summaries of what changed, what was tested and what's live.

## Rules when changing the game

1. **Every commit must stamp `version.json`** (`python tools/stamp.py`), otherwise iPads won't pick up the update.
   - In a fresh clone, run `sh tools/install-hooks.sh` once and the pre-commit hook does it for you.
   - End commit messages with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
2. **Never break saves.** The save key is `tenka.save.v1` in localStorage. Add a migration in `Game.load` (js/game/world.js) when a format changes.
3. **Before a big change, make a backup** folder `vN/` (see HANDOVER → Backups).
4. **Test in a browser before pushing:**
   - `python -m http.server 8777` from the repo root, then open `http://localhost:8777/` (`?fp=sandbox` for first person).
   - The debug handles are `window.tenka` and `window.tenkaFP`.
5. **Add a short README section per feature,** in plain English.
6. **Match the code style:**
   - Short plain-English comments that say *what it's for*.
   - `h()` for DOM elements (js/util.js).
   - Procedural low-poly models with `Mesher` (js/render/geo.js).
   - No new libraries and no build tools.
7. **The player's decisions stand** (see HANDOVER → Decisions). For example: no health bars, no combat texts, the current bow look, click = left/right combo, hold = heavy overhead, right = block.
