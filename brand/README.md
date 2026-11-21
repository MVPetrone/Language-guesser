# Lingo Guess — identity

**The aperture ear.** Three concentric rings in calibration cyan (the machine listening)
are cut by one horizontal slice. Through that slice runs a voice in signal amber: a
flat line that swells into a six-peak burst. The peaks are calibrated to an invisible circle
concentric with the aperture. Ripples, lens, speaker cone, ear, location ping: one glyph.
Ring weights grade 4/6/8 from rim to centre (sound fading outward). The slice clearance
equals the ring gap (5/128). The waveform is exactly point-symmetric about the centre,
so the mark is optically centred by construction.

## Colour (from `src/styles/tokens.css`, never raw values elsewhere)
| Hex | Token | Role in the identity |
|---|---|---|
| `#06080C` | `--ink-950` | Background of icons, OG card, favicon disc; rings in `mark-light` |
| `#EDF1F7` | `--fog-100` | Wordmark |
| `#57E3C9` | `--caliber-500` | The rings: structure, the instrument |
| `#FFB020` | `--signal-500` | The waveform: the only amber element |
| `#E09400` | `--signal-600` | Waveform on white (`mark-light`) |

## Type (`public/fonts/`)
- **Space Grotesk 700**: wordmark and display (`SpaceGrotesk-700-latin.woff2`), tracking −0.03em.
- **Inter 400/600**: UI and body (`Inter-400-latin.woff2`, `Inter-600-latin.woff2`).
- **JetBrains Mono 400/500**: telemetry only, uppercase, +0.09em (`JetBrainsMono-*-latin.woff2`).

## Clearspace and minimum size
1 unit = the height of the aperture. Keep **0.5 unit clear on all sides**; the lockup
files already include it. Minimum sizes: **16 px** favicon (`favicon.svg`/`mark-small`),
**24 px** in UI (use `mark-small` below 32 px), **96 px** for marketing (full `mark`).

## Do / don't
- Do use the two-tone mark on ink; use `mark-light` on white, `mark-mono` for one-colour print.
- Never gradient the mark, or blend amber and cyan.
- Never place it on amber (or any saturated accent).
- Never outline, stroke-expand or add effects to it.
- Never rotate, skew or re-proportion it. The slice is always horizontal.
- Never re-space, re-type or recolour the wordmark; it is outlines, not live text.

## Files
| File | Use |
|---|---|
| `mark.svg` | Master, two-tone, transparent (`public/brand/mark.svg` is the runtime copy) |
| `mark-mono.svg` | One colour, `currentColor`: tint via CSS, prints black as `<img>` |
| `mark-small.svg` | 16-px grid: one ring, one-cycle wave, pixel-aligned slice |
| `mark-light.svg` | For white/light backgrounds and print |
| `wordmark.svg` | Outlined Space Grotesk 700, `currentColor` defaulting to fog-100 |
| `lockup-horizontal.svg` | 720×160, mark + wordmark, clearspace included (`public/brand/` copy) |
| `lockup-stacked.svg` | 480×400, mark over two-line wordmark |
| `og.html` | Source of `public/og.png` (1200×630) and `public/og-square.png` (1200×1200) |
| `preview.html` / `preview.png` | The contact sheet |
| `tools/` | Build scripts (zero deps): `build.mjs` regenerates everything derived |

`public/` also holds `favicon.svg`, `icons/*.png` (192, 512, maskable 512, mono 512,
apple-touch 180), `og*.png` and `site.webmanifest`.

## Regenerating
`node brand/tools/build.mjs` re-outlines the wordmark (WOFF2 + `gvar` at wght 700;
kerning and tracking measured from Chromium's own layout), re-composes the lockups from
`mark.svg`, refreshes `public/brand/`, and renders every PNG through
`scripts/render-asset.mjs`. The `mark*.svg` files are hand-authored sources. Edit those,
never the derived files. `node brand/tools/verify.mjs` checks every output.
