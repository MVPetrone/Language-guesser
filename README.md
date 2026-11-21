# Lingo Guess

Hear one sentence, name the language. A listening game across 72 languages —
10 rounds, 3 lives, four difficulty tiers. Live at **[lingoguess.com](https://lingoguess.com)**.

## Modes

- **Classic** — four difficulties (easy to expert), multiple-choice answers.
- **Daily Challenge** — one deterministic challenge per Europe/London day (10 rounds,
  3 lives, typed answers with an autocomplete dropdown). Everyone gets the same rounds,
  so scores are comparable. Reachable at `?daily=1`.

## Stack

- React 19 + TypeScript + Vite (SPA, no router — screen state lives in `src/engine/game.ts`)
- Vite base is `/` — the site is served from the domain root
- PHP 8 + SQLite admin/CRM and first-party analytics collector in `server/admin`
- Deployed with Hostinger Git deploy from the `deploy/lingoguess` branch

## Commands

```bash
npm run dev      # vite dev server
npm run build    # tsc -b && vite build  (base: /)
npm run test     # vitest unit tests (src/engine, src/motion)
npm run e2e      # playwright, runs against dist/ via scripts/serve-dist.mjs
npm run lint     # oxlint
npm run audio    # regenerate the sentence audio bank
```

## Layout

| Path | What |
| --- | --- |
| `src/engine/` | Pure game logic: RNG, round building, scoring, storage |
| `src/components/` | Screens: start, round, reveal, end, HUD, guess grid |
| `src/data/` | Languages, sentences, voices |
| `src/motion/` | Ambient field, transitions, waveform (has its own docs in `MOTION.md`) |
| `brand/` | Identity: marks, wordmark, lockups, motion plates. `node brand/tools/build.mjs` regenerates every derived asset |
| `server/admin/` | PHP 8 + SQLite admin panel, CRM and analytics API (`/admin`) |
| `scripts/` | Deploy, dist server, screenshot and asset-render helpers |
| `VERIFICATION.md` | Observed build/test/e2e results |

## Brand assets

Every SVG/PNG in `public/brand`, `public/icons` and `public/og*.png` is generated —
edit `brand/*.svg` or `brand/tools/*.mjs`, then run:

```bash
node brand/tools/build.mjs
```

## Deploy

```bash
./scripts/deploy-lingoguess.sh          # build, commit, push deploy/lingoguess
./scripts/deploy-lingoguess.sh --ship   # ...and trigger the Hostinger Git deploy
```
