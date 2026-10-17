# Verification evidence

Observed on 2026-10-17, branch `feat/guess-the-language-v1`, host with 1.85 GB RAM,
Node v22.23.0, npm 10.9.8. Every output below was copied from a real run in this
session. Nothing here was pushed; all commits are local.

## Summary

| Item | Value |
| --- | --- |
| Final roster size | **40** (no languages removed) |
| Clip count | **120** (= 40 × 3) |
| `public/audio` size | **2.4M** (`du -sh`), 2,099,454 bytes (`du -sb`) |
| Smallest / largest clip | 11,232 / 23,328 bytes (all > 1 KB) |
| `manifest.json` entries | 120 |
| `sha256(public/audio/manifest.json)` | `90eb735f0c2caaf7c0ddbd1d8525f4e84fc50d8b6cc66b1ee18061d5a6c58407` |
| Unit tests | 28 passed (2 files) |
| E2E tests | 5 passed (Chromium 1228 headless shell, see limitations) |

## Roster changes

- **Voice id changed: `no-NO`.** edge-tts 7.3.1 has *no* `no-NO-*` voice. The locale code
  stays `no-NO` in the roster; its voice is **`nb-NO-PernilleNeural`** (Norwegian Bokmål),
  which still speaks Norwegian. Audio lives at `public/audio/no-NO/`.
- `fil-PH`, `sw-KE`, `cy-GB` all have real voices (`fil-PH-BlessicaNeural`,
  `sw-KE-ZuriNeural`, `cy-GB-NiaNeural`). No change needed.
- All 40 `voice` ids checked against `.venv/bin/edge-tts --list-voices`: 40/40 present.
- **Languages dropped: none.**

## Audio generation log (Task 4)

- Run 1: `node scripts/generate_audio.mts` → `generated=119 skipped=0 manifest=117`, exit 1.
  `cs-CZ/weather` failed all 3 attempts with `edge_tts.exceptions.NoAudioReceived`.
  (Run 1 logged 8 `NoAudioReceived` errors in total: `da-DK/weather`, `cs-CZ/hello` and `cs-CZ/coffee` succeeded on a retry.)
- Run 2 (same command; the script is idempotent): `generated=1 skipped=119 manifest=120`,
  exit 0. `cs-CZ/weather` succeeded after one retry. Czech was kept because it did not
  "still fail".
- Run 3 (determinism check): `generated=0 skipped=120 manifest=120`. Manifest sha256 was
  identical before and after (`90eb735f…58407`).
- `file` on samples:
  ```
  public/audio/cs-CZ/weather.mp3: MPEG ADTS, layer III, v2,  48 kbps, 24 kHz, Monaural
  public/audio/ja-JP/hello.mp3:   MPEG ADTS, layer III, v2,  48 kbps, 24 kHz, Monaural
  public/audio/cy-GB/coffee.mp3:  MPEG ADTS, layer III, v2,  48 kbps, 24 kHz, Monaural
  public/audio/no-NO/hello.mp3:   MPEG ADTS, layer III, v2,  48 kbps, 24 kHz, Monaural
  public/audio/zh-TW/coffee.mp3:  MPEG ADTS, layer III, v2,  48 kbps, 24 kHz, Monaural
  ```
- `find public/audio -name '*.mp3' -size -1025c | wc -l` → `0`

## Gates

Before the final gate run, `dist/`, `test-results/` and the tsbuildinfo caches were deleted.

### 1. `npx tsc --noEmit` → exit 0, **but this checks nothing**

```
$ npx tsc --noEmit
exit=0
$ npx tsc --noEmit --listFilesOnly | wc -l
0
```

The root `tsconfig.json` is a solution file (`"files": []` plus project references), so
plain `tsc --noEmit` type-checks zero files. The real type checks are below, all exit 0
with no diagnostics:

```
$ npx tsc -b                              exit=0
$ npx tsc -p tsconfig.app.json --noEmit   exit=0   (src/, noUncheckedIndexedAccess on)
$ npx tsc -p tsconfig.node.json --noEmit  exit=0   (vite.config.ts, scripts/, tests/engine/)
$ npx tsc -p tsconfig.e2e.json --noEmit   exit=0   (playwright.config.ts, tests/e2e/)
```

### 2. `npx vitest run` → 28 passed

```
 RUN  v5.0.5 /root/guess-the-language

 Test Files  2 passed (2)
      Tests  28 passed (28)
exit=0
```

Mutation check: changing `state.lives - 1` to `state.lives - 2` in `src/engine/game.ts`
made 2 tests fail ("a miss decrements lives exactly once", "ends at 0 lives"). After
reverting with `git checkout`, 28/28 passed again.

Covered: answer never among distractors and 4 unique options (2,000 draws × 3
difficulties); distractors share the answer's tier; uniform answer position (20,000
seeded draws, χ² < 16.27 and each position within 5% of expected); lives −1 per miss only,
none on hit, none on a repeat guess during the reveal; streak bonus accumulates and resets
on a miss; game ends at 0 lives and separately at `ROUNDS`; same seed gives an identical
round sequence twice; score never negative (200 random games); plus rng/seed/shuffle tests.

### 3. `npm run build` → `dist/index.html` exists

```
dist/index.html                   0.51 kB │ gzip:  0.31 kB
dist/assets/index-D0dHHdR2.css    6.91 kB │ gzip:  2.04 kB
dist/assets/index-CFNuqyle.js   249.38 kB │ gzip: 80.91 kB
✓ built in 221ms
exit=0
-rw-r--r-- 1 root root 519 Oct 17 19:53 dist/index.html
```

### 4. `ls public/audio/**/*.mp3 | wc -l` → 120 (= 40 × 3)

```
120
```

### 5. Playwright against static `dist/` → 5 passed, zero uncaught page errors

`dist/` is served by `scripts/serve-dist.mjs` (plain `node:http`, under `/Language-guesser/`),
started by Playwright's `webServer`. No Vite dev server was run.

```
$ PW_CHROMIUM_PATH=/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell npx playwright test
Running 5 tests using 1 worker
  ✓  1 [chromium] › tests/e2e/smoke.spec.ts:13:1 › start, answer 3 rounds, reach the end screen with no page errors (942ms)
  ✓  2 [chromium] › tests/e2e/smoke.spec.ts:52:1 › bundled mp3 decodes in this browser (174ms)
  ✓  3 [chromium] › tests/e2e/smoke.spec.ts:70:1 › a missing clip is surfaced and the round can be skipped (368ms)
  ✓  4 [chromium] › tests/e2e/smoke.spec.ts:97:1 › perfect game: exact score, best score persisted, share copied (765ms)
  ✓  5 [chromium] › tests/e2e/smoke.spec.ts:129:1 › works with localStorage disabled and no clipboard API (745ms)
  5 passed (4.1s)
exit=0
```

Each test fails if any `pageerror` fired. Test 1 clicks Start, answers 3 rounds (asserting
`1/10`, `2/10`, `3/10`), and checks that the counter reads `4/10` or the end screen is up.
It then plays on to the end screen and asserts every `.mp3` response was HTTP 200/206 and
no audio-error alert appeared.

Lint: `npx oxlint` → no output, exit 0.

## Deploy (Task 8)

```
$ gh api -X POST repos/MVPetrone/Language-guesser/pages -f build_type=workflow
{"message":"Resource not accessible by personal access token", ... "status":"403"}
gh: Resource not accessible by personal access token (HTTP 403)
```

This was expected: the token lacks the Pages permission. Enable Pages manually
(Settings → Pages → Source: GitHub Actions). The workflow has not run, because nothing
was pushed.

## Limitations — what was NOT verified

- **Playwright's pinned browser is not installed.** `@playwright/test` 1.64.1 wants
  `chromium_headless_shell-1248`, but only build **1228** (Chrome for Testing
  149.0.7827.55) is cached. Without `PW_CHROMIUM_PATH`, `npx playwright test` fails:
  `browserType.launch: Executable doesn't exist at …/chromium_headless_shell-1248/…`.
  I did not run `npx playwright install`: it downloads into `~/.cache`, which is outside
  the repo. `playwright.config.ts` reads the optional `PW_CHROMIUM_PATH` env var.
- **Audible playback is not asserted.** Test 2 proves a bundled MP3 fetches (200, > 1 KB)
  and decodes via `decodeAudioData` to > 0.5 s in headless Chromium. In a manual
  screenshot the play button showed its "playing" state after Start, which means the
  `playing` event fired. No test asserts that, and nobody listened to the output.
- **Only Chromium was tested.** Not tested: Safari/iOS autoplay rules, Firefox,
  real mobile devices. The `useAudio` hook reuses one `<audio>` element for Safari's sake,
  and shows "Tap ▶" if autoplay is refused, but neither behaviour was observed on those
  browsers.
- **The GitHub Actions workflow has not been executed.** I did not check the action
  versions (`checkout@v5`, `setup-node@v5`, `configure-pages@v5`,
  `upload-pages-artifact@v4`, `deploy-pages@v4`) against GitHub.
- **Translations have not been checked by native speakers.** They are best-effort, and
  rounds are never scored on them.

## Deviations from the brief (deliberate)

- `applyResult(state, result)` takes the `RoundResult` returned by
  `scoreGuess(state, guessIndex)` as a second argument instead of `applyResult(state)`.
  A separate `nextRound(state)` leaves the reveal and builds the next round. `guess()` is
  a shortcut for scoring and applying in one call.
- A skipped round (clip failed to load) scores 0, counts toward the 10 rounds, and leaves
  lives and streak alone.
- Added `tsconfig.e2e.json` (DOM + node types for Playwright) as a third project
  reference. `vite.config.ts` now imports `defineConfig` from `vitest/config`, and
  `base: '/Language-guesser/'` is unchanged.
- Removed the scaffold's demo files (`src/App.css`, `src/index.css`, `src/assets/*`,
  `public/icons.svg`).
- Extra files not in the brief's layout: `src/hooks/useHotkeys.ts`, `src/share.ts`,
  `src/storage.ts`, `scripts/serve-dist.mjs`, `playwright.config.ts`.
