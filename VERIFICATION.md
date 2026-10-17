# Verification evidence — wave 2

Observed on 2026-10-17, branch `feat/guess-the-language-v1`, host with 1.85 GB RAM + 4 GB
swap, Node v22.23.0, edge-tts 7.3.1 (`.venv/bin/edge-tts`). Every output below was copied
from a real run in this session. Nothing was pushed; all commits are local. No Vite dev
server was run.

## Summary

| Item | Value |
| --- | --- |
| Sentences | **8**: level 1 = **2**, level 2 = **3**, level 3 = **3**, each in all 40 languages (320 texts) |
| Voices per language | **2** (index 0 female, index 1 male) for all 40 languages = 80 voices |
| Locales missing a gender | **none** |
| Voices dropped during generation | **none** |
| Clip count | **640** (= 40 locales × 2 voices × 8 sentences), same 640 in `dist/audio` |
| `public/audio` size | **24M** (`du -sh`), 23,145,419 bytes (`du -sb`) |
| Smallest / largest clip | 15,840 / 73,008 bytes (all > 1 KB) |
| Clip format | 640 / 640 `MPEG ADTS, layer III, v2, 48 kbps, 24 kHz, Monaural` |
| `manifest.json` entries | 640 (`locale, voiceIndex, voice, sentenceId, bytes, sha256`) |
| `sha256(public/audio/manifest.json)` | `23fc837d8b39825aa9bb79ca72d14da4c3cb9443d520df2472a7e07cfc02001b` |
| Unit tests | **57 passed** (4 files: game 36, rng 7, sentences 10, storage 4) |
| E2E tests | **8 passed**, zero page errors and zero console errors (Chromium 1228 headless shell, see limitations) |

## Recon check (brief's claims)

Checked against `.venv/bin/edge-tts --list-voices` (322 voices), matching each roster
entry by the locale family of its default voice (`no-NO` → `nb-NO`):

- All 40 families have ≥ 2 voices, and every one has both a female and a male voice. **Confirmed.**
- Voices per family: `{2: 30, 3: 5, 4: 1, 5: 1, 6: 1, 8: 1, 17: 1}`. 30 have exactly 2;
  es-ES, pt-BR, ko-KR, nl-NL and zh-TW have 3; it-IT has 4; fr-FR 5; de-DE 6; zh-CN 8;
  en-US 17. **Confirmed**, matching the brief.
- `no-NO` has no voice of its own; its family is `nb-NO`. **Confirmed.**

## Sentences (Task 1)

| id | level | English source (words) |
| --- | --- | --- |
| `l1-children-asleep-dog-awake` | 1 | The children are asleep, but the dog is still awake. (10) |
| `l1-rained-all-night-river-rose` | 1 | It rained all night, and the river rose. (8) |
| `l2-neighbour-kept-our-ladder` | 2 | Our neighbour still has not returned the ladder that he borrowed last spring. (13) |
| `l2-left-umbrella-got-soaked` | 2 | Because I had left my umbrella at home, I got soaked on the way back. (15) |
| `l2-grandfather-whistles-mending-fence` | 2 | Whenever my grandfather mends the old wooden fence, he whistles the same quiet tune. (14) |
| `l3-heron-motionless-in-reeds` | 3 | The heron stood motionless among the reeds, as if someone had carved it out of driftwood. (16) |
| `l3-cellar-damp-wool-rusty-hinges` | 3 | The abandoned cellar smelled of damp wool and rusty hinges that nobody had bothered to oil for decades. (18) |
| `l3-blacksmith-crooked-ploughshares` | 3 | Although the grumpy blacksmith complained constantly, the villagers secretly admired how patiently he straightened their crooked ploughshares. (17) |

The validator (`scripts/validate_sentences.mts`) runs all seven checks from the brief:
missing language, wrong script, English leakage, duplicates, blocklist, length bands and
level integrity. It also checks id/level shape and the 2/3/3 count. Its blocklist covers
the brief's words in every roster script, plus common translations of each (e.g. `kahvi`,
`кофе`, `커피`, `telefon*`, `телевиз*`). Latin, Cyrillic and Greek terms match whole words
or prefixes; terms in other scripts match as substrings.

**Correction to the brief: length bands cannot be applied to raw word counts across 40
languages.** I measured the same sentences in every language. A language's word count ÷
the English count (its verbosity ratio) ranges from **0.76 (Finnish)** to **1.42 (Urdu)**:
Thai, Vietnamese, Hindi and Urdu write ~1.3–1.4× as many words, Finnish, Turkish and
Korean ~0.8×. With raw bands, every faithful Urdu or Hindi level-3 translation fails
(27–31 words > 22), and Finnish level 3 falls short (11–15). The validator therefore:

1. holds the English source to the bands exactly (6–10 / 10–16 / 14–22);
2. computes each language's verbosity ratio over all 8 sentences. The ratio must lie in
   0.6–1.6. The observed range is 0.76–1.42;
3. requires every text's word count ÷ that ratio to sit inside its level's band;
4. counts Japanese, Chinese and Thai words with `Intl.Segmenter`, which these scripts
   need because they have no spaces. For Japanese, single-hiragana segments (particles
   and inflection endings) are not counted;
5. for level integrity, requires the mean words per level to be strictly increasing
   (L1 < L2 < L3) for *every* language. That is stronger than the brief's "L3 > L1 on average".

`node scripts/validate_sentences.mts --table` prints every raw and normalised count.

### What I had to correct while writing the pool

- The first draft of the second level-1 sentence ("It rained all night, so the river is
  very high", 10 words) normalised above 10 in 12 languages. I replaced it in all 40
  languages with "It rained all night, and the river rose".
- Individual translations that still fell outside a band after normalisation were
  rephrased, keeping the meaning:
  - L2 ladder: de.
  - L2 umbrella: tr, cy, ja.
  - L2 grandfather: ru, uk, sk, id, sw, zh-CN, he, ms.
  - L3 heron: de, ru, cy, hi, it, af, sv, zh-CN.
  - L3 blacksmith: pt, th, vi, fil, ko.
  - L1 children: ja, hu.
  - L1 river: hi.
- I avoided easily recognised loans where a native word exists: Filipino `ngunit` over
  `pero`, `inaayos` over `kinukumpuni`; Tamil `சீழ்க்கை` over the English loan `விசில்`.
  Two remain: Welsh `ymbarél` and `ffens`, and Greek `ομπρέλα`, because they are the
  normal words. None of them is on the blocklist.
- Arabic is Modern Standard Arabic. The old `ar-EG` phrases were Egyptian colloquial;
  MSA spelling is standardised and the ar-EG voices read it.
- The first version of the validator's own "level integrity" unit test was too weak:
  shortening one L3 text did not move the mean enough. The test now shortens all three.

## Voices (Task 2)

`src/data/voices.ts`: per family, the lowest id of each gender in plain code-unit order,
female first. I used code-unit order rather than `localeCompare` because the latter sorts
the dialect voice `zh-CN-liaoning-XiaobeiNeural` before `zh-CN-XiaoxiaoNeural`.
`node scripts/validate_voices.mts` re-derives the picks from the live voice list. It fails
on an unknown id, the wrong family, or any deviation from the rule.

```
$ node scripts/validate_voices.mts | tail -3
languages=40 voices=80 edge-tts voices listed=322
locales without both genders: none
all voice checks passed
exit=0
```

Worth knowing: **the rule picks `en-US-AnaNeural` for English female, a child voice**
(edge-tts lists it as category "Cartoon, Conversation", personality "Cute"). I followed
the rule as decided. For en-US male it picks `en-US-AndrewMultilingualNeural`, and for
ko-KR male `ko-KR-HyunsuMultilingualNeural`; both are multilingual voices.

## Audio generation (Task 6)

The 120 old clips (`hello`/`weather`/`coffee` × 40) and the old manifest were deleted
first (`rm -rf public/audio`). Then `node scripts/generate_audio.mts`, run sequentially
with a 500 ms delay between calls (raised from 400 ms) and the existing 3-attempt backoff
(1 s, 2 s):

| Run | Output | Exit |
| --- | --- | --- |
| 1 (≈34.5 min, 20:48:26 → ≈21:23 UTC) | `generated=636 skipped=0 manifest=632 expected=640` | 1 |
| 2 | `generated=2 skipped=636 manifest=632 expected=640` | 1 |
| 3 | `generated=1 skipped=638 manifest=632 expected=640` | 1 |
| 4 | `generated=0 skipped=639 manifest=632 expected=640` | 1 |
| 5 | `generated=1 skipped=639 manifest=640 expected=640` | 0 |
| 6 (idempotency check) | `generated=0 skipped=640 manifest=640 expected=640`, manifest sha256 unchanged | 0 |

- In run 1, 22 attempts failed with `edge_tts.exceptions.NoAudioReceived`. 18 of them were
  retried: ar-EG-SalmaNeural 4, cs-CZ-AntoninNeural 2, sk-SK-LukasNeural 2,
  tr-TR-AhmetNeural 10. Four `tr-TR-AhmetNeural` clips (voice 1) exhausted all 3
  attempts. The script excludes a voice with any failed clip from the manifest, which is
  why runs 1–4 report 632.
- I checked whether the text was the cause before deciding to drop the voice. In 5 direct
  `edge-tts` calls with `tr-TR-AhmetNeural` (output discarded), the full blacksmith
  sentence **succeeded** (52,416 bytes), while the trivial `Bugün hava çok güzel.` and
  three fragments failed. So the failure is intermittent on the service side, not tied to
  the text. Because the voice demonstrably works, I re-ran the idempotent script instead of
  dropping it. Runs 2–5 filled the gaps, and the last one (`tr-TR/1/l3-blacksmith-
  crooked-ploughshares`) succeeded in run 5.
- **Final: no voice dropped, both genders for all 40 locales, 640 clips.**

```
$ find public/audio -name "*.mp3" | wc -l
640
$ find public/audio -name "*.mp3" -size -1025c | wc -l
0
$ find public/audio -name "*.mp3" -print0 | xargs -0 file | sed "s/^[^:]*: *//" | sort | uniq -c
    640 MPEG ADTS, layer III, v2,  48 kbps, 24 kHz, Monaural
$ for l in public/audio/*/; do find $l -name '*.mp3' | wc -l; done | sort | uniq -c
     40 16
$ du -sh public/audio; du -sb public/audio
24M	public/audio
23145419	public/audio
$ sha256sum public/audio/manifest.json
23fc837d8b39825aa9bb79ca72d14da4c3cb9443d520df2472a7e07cfc02001b  public/audio/manifest.json
```

The script also fails the run if any `.mp3` under `public/audio` is not in the current
pool, so leftover clips from an old layout cannot inflate the count. No strays were
reported.

## Gates

Before this run, `dist/`, `test-results/` and `node_modules/.tmp/*.tsbuildinfo` were deleted.

### types — `npx tsc -b` → exit 0, no diagnostics

```
$ npx tsc -b
exit=0
$ npx tsc -p tsconfig.app.json --noEmit
exit=0
$ npx tsc -p tsconfig.node.json --noEmit
exit=0
$ npx tsc -p tsconfig.e2e.json --noEmit
exit=0
```

(Plain `npx tsc --noEmit` checks zero files here; the root tsconfig is a solution file.)

### lint — `npx oxlint` → no output, exit 0

### unit — `npx vitest run` → 57 passed

```
 Test Files  4 passed (4)
      Tests  57 passed (57)
exit=0
```

Per file (`--reporter=verbose`): game 36, rng 7, sentences 10, storage 4.

The original 28 tests (game 21 + rng 7) are all still present. **Three were changed
deliberately, none deleted or weakened:**

- "always returns 4 unique options…": it asserted `PHRASE_IDS` contains `phraseId`; it
  now asserts the sentence id exists.
- "avoids previously used answers when possible": the 4th argument of `buildRound` is now
  `{ codes }` instead of a bare array (the `avoid` parameter became an object).
- "the same seed produces an identical round sequence twice": it compared `phraseId`; it
  now compares `sentenceId` and `voiceIndex`.

New engine tests (15):

- level per difficulty, with every level sentence appearing;
- voice index in range, with both voices used;
- no repeated clip within a game, even when answer languages must repeat
  (4 languages, 16 clips, 10 rounds, 200 seeds);
- an unplayed clip of a used language is preferred over a played clip;
- exhaustion falls back to the whole level pool without throwing;
- fixed-seed determinism of language, sentence and voice;
- the result records sentence and voice;
- an empty memory changes nothing;
- a heard clip is avoided;
- no repeated clip across 15 replays until all 150 normal clips have been heard;
- after exhaustion, repeats come from the oldest half of the memory;
- known languages are never the answer or a distractor;
- a pool of exactly `MIN_POOL` plays at every difficulty;
- a difficulty keeps its own tiers while any remain;
- nearest-tier fallback, with the sentence level still following the difficulty.

New sentence tests (10): the real pool passes; 2/3/3 levels; and one test per validator
check proving it catches a bad input (missing language, wrong script both ways, copied
English, duplicate, blocklist in several scripts with no false positive on `Kokeen`,
length band, level integrity, word counting). Storage tests (4): round-trip with the cap;
dedupe and cap in `appendHeard`; corrupt values ignored; throwing or missing
`localStorage` degrades to an empty memory without throwing.

**Mutation checks.** Making the engine treat every clip as unplayed (`notPlayed` always
true) made 4 tests fail: "never repeats a clip within a game…", "prefers an unplayed
clip…", "never repeats a clip across replays…" and "…brings back the clips heard longest
ago". Restoring the file brought back 57/57. In e2e, removing the 404 allowance from the
missing-clip test made it fail on
`console: Failed to load resource: the server responded with a status of 404 (Not Found)`.
That proves console errors are actually tracked. The file was restored afterwards.

### sentences — `node scripts/validate_sentences.mts` → exit 0

```
sentences=8 (L1=2 L2=3 L3=3) languages=40 texts=320
all sentence checks passed
exit=0
```

### build — `npm run build` → `dist/index.html` exists

```
dist/index.html                   0.51 kB │ gzip:   0.31 kB
dist/assets/index-B2AIshiH.css    8.49 kB │ gzip:   2.30 kB
dist/assets/index-Zv81gjX7.js   293.94 kB │ gzip: 102.08 kB
✓ built in 325ms
exit=0
-rw-r--r-- 1 root root 519 Oct 17 21:27 dist/index.html
```

The JS bundle grew from 249.38 kB to 293.94 kB, mostly from the 320 sentence texts.

### clips — 640 on disk == 40 × 2 × 8; clip format 640/640 MPEG layer III (outputs above)

### runtime — static `dist/` + Playwright → 8 passed, zero page and console errors

`dist/` is served by `scripts/serve-dist.mjs` (plain `node:http`, under `/Language-guesser/`),
which Playwright's `webServer` starts.

```
$ PW_CHROMIUM_PATH=/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell npx playwright test
Running 8 tests using 1 worker
  ✓  1 [chromium] › tests/e2e/smoke.spec.ts:25:1 › start, answer 3 rounds, reach the end screen with no page errors (2.3s)
  ✓  2 [chromium] › tests/e2e/smoke.spec.ts:65:1 › bundled mp3 decodes in this browser (242ms)
  ✓  3 [chromium] › tests/e2e/smoke.spec.ts:83:1 › a missing clip is surfaced and the round can be skipped (633ms)
  ✓  4 [chromium] › tests/e2e/smoke.spec.ts:112:1 › perfect game: exact score, best score persisted, share copied (842ms)
  ✓  5 [chromium] › tests/e2e/smoke.spec.ts:147:1 › works with localStorage disabled and no clipboard API (781ms)
  ✓  6 [chromium] › tests/e2e/smoke.spec.ts:191:1 › known languages: searchable picker, asked once, excluded from every option (1.3s)
  ✓  7 [chromium] › tests/e2e/smoke.spec.ts:222:1 › pool guard: Start is blocked below the minimum and unblocked again (2.3s)
  ✓  8 [chromium] › tests/e2e/smoke.spec.ts:251:1 › a replay does not repeat any clip from the previous game (1.2s)
  8 passed (11.3s)
exit=0
```

Every test fails on any `pageerror` or any console `error` message. The one exception is
test 3, which serves 404s on purpose and allows only that browser message.

- Test 1 passes the first-visit picker, clicks Start, answers 3 rounds (`1/10`…`3/10`),
  plays on to the end screen, and asserts every `.mp3` response was 200/206 with no
  audio-error alert.
- Test 2 fetches and decodes `audio/fr-FR/0/l1-children-asleep-dog-awake.mp3`.
- Test 6 searches `espanol` (accent-insensitive: 1 match), excludes 6 languages, checks
  the picker is not shown after a reload, and asserts that none of the 6 appears among
  the options of any round of a full game.
- Test 7 leaves 11 languages: Start is disabled and the message names the minimum of 12.
  Cancel keeps that state; unticking one re-enables Start.
- Test 8 plays two games back to back. No clip URL of game 2 was requested in game 1,
  every URL matches `/audio/<locale>/<0|1>/l2-….mp3`, and `gtl:heard` holds one key per
  round.

## Limitations — what was NOT verified

- **Playwright's pinned browser is not installed.** `@playwright/test` 1.64.1 wants
  `chromium_headless_shell-1248`; only build 1228 is cached. Without `PW_CHROMIUM_PATH`
  the run fails (observed this session:
  `browserType.launch: Executable doesn't exist at …/chromium_headless_shell-1248/…`).
- **Nobody listened to the 640 clips.** Format, size (> 1 KB) and one browser decode are
  verified. Pronunciation is not: rare words, the multilingual voices, the
  `en-US-AnaNeural` child voice, and whether each voice reads its text without skipping.
- **Translations were not checked by native speakers.** The validator proves structure
  (script, coverage, no copied English, no blocklisted words, proportional length). It
  cannot prove a translation is correct or idiomatic. Rounds are never scored on
  translation accuracy.
- **Only Chromium was tested.** Safari/iOS autoplay, Firefox and real phones were not.
- **Intermediate commits are not runtime-green.** From the engine commit (`dc6d412`) the
  app requests clips at `audio/<code>/<voice>/<sentence>.mp3`, which only exist from the
  audio commit (`00eda55`). Each commit type-checks and passes unit tests. Only `HEAD`
  was run end to end.

## Deviations from the brief (deliberate)

- **`phrases.ts` was deleted in the engine commit, not the sentence-pool commit.**
  Deleting it in commit 1 would have broken `game.ts`, `Reveal`, `Round` and the
  generator until commit 3. For the same reason, the `generate_audio.mts` rework (its
  last consumer) landed in the engine commit; the audio commit holds the regenerated
  clips and manifest.
- **Length bands are normalised per language** (see "Sentences" above). Level integrity is
  checked per language and as strictly increasing L1 < L2 < L3.
- **`buildRound`'s `avoid` is an object** `{ codes, clips, heard }`. The engine prefers, in
  order:
  1. a never-heard clip of a language not yet answered this game;
  2. a never-heard clip of any language;
  3. the same two, counting only the newest half, quarter, … of the memory as heard,
     so the oldest-heard clips return first;
  4. the whole level pool.

  A first version ranked "fresh answer language" above "never-heard clip". In simulation
  it repeated a clip before the easy pool was used up in 33 of 300 seeds, so I swapped
  the order. With the swap, 0 of 300 seeds repeat early.
- **A `?seed=` game ignores the heard memory**, so the seed (plus the player's pool)
  alone determines the game, as the brief requires. Plays are still recorded.
- **With localStorage disabled, the memory still spans replays within the same page
  session** (it lives in React state). Across reloads it degrades to within-game
  avoidance only. The known-languages picker is then shown on each visit; skipping works.
- `tsconfig.node.json` adds the `DOM` lib so `tests/engine/storage.test.ts` can
  type-check `src/storage.ts`.
- The manifest also records each clip's `voice` id, in addition to the required fields.
- Added files beyond the brief: `scripts/validate_voices.mts`,
  `tests/engine/sentences.test.ts`, `tests/engine/storage.test.ts`. Start-screen copy
  now says difficulty also sets sentence length and rarity.
