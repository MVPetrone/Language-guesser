# Motion — the linguistic instrument

**Principles.** Weight, not bounce: everything settles on `--ease-settle`. The single
overshoot is ScorePop's 1.12 spring, which is reserved for scoring. UI moves last 120–380 ms
(`--dur-1`…`--dur-3`); only the ambient layer is slow (`--dur-5` multiples, ≥ 8 s).
Input is never gated: nothing waits for an animation, and no exit animation delays an
unmount. Transform and opacity only, never `height`, never `box-shadow` on a surface.
Reduced motion means things stop moving but still render, as described per component below.

**Tokens used** (all from `src/styles/tokens.css`, none hardcoded): `--ease-settle`,
`--dur-1/2/3/4/5`, `--stagger` (callers' `Reveal delay`), `--caliber-500`, `--fog-400`,
`--signal-glow`, `--r-pill`, `--z-ambient`. JS reads them through `tokens.ts`, so the
reduced-motion block that zeroes every `--dur-*` reaches canvas and rAF code as well.

**The WebAudio trap.** WaveformLive never creates an `AudioContext`, never calls
`createMediaElementSource`, never touches the `<audio>` element. The game's audio is
autoplay-gated, and routing that element through WebAudio has silenced the whole game here
before. The bars play a deterministic, speech-shaped envelope (`envelope.ts`) instead:
syllables at ~4.6 Hz with word gaps and phrase pauses that every bar shares, so they rise
and fall together like a voice rather than an equaliser. Each bar's share comes from three
incommensurate sines plus a walk seeded by its index. It attacks over `--dur-1` and
releases over `--dur-3`.

**Mounting** (`import { … } from './motion'`):
- `AmbientField intensity={0.5}`: mount once, first, outside any transformed wrapper.
  It is `position: fixed` at `--z-ambient` (0), so the content wrapper needs
  `position: relative; z-index: var(--z-content)`. Its canvas never takes clicks or focus.
  It caps DPR at 2 and draws at most 30 fps. It pauses when the tab is hidden or the
  canvas is off screen, and under reduced motion it draws one still frame.
- `WaveformLive playing={audio.isPlaying} bars={24} height={48}` goes next to the play
  button. It is cyan, a readout of the voice, so the amber stays on the play button;
  set `--waveform-color` on an ancestor to change it. Reduced motion: a still speech
  pose while playing, the rest pose otherwise.
- `ScorePop value={score}` wraps the digits, e.g.
  `<ScorePop value={score}><span data-testid="score">{score}</span></ScorePop>`.
  The children are never remounted. It does not move on first mount and changes
  instantly under reduced motion.
- `Reveal delay={i * 40} y={12}` (40 = `--stagger`) renders a `div` wrapper. For list
  items, wrap the item's contents, not the `li`. Options enter bottom-to-top, so give
  the last option delay 0. Reduced motion renders a plain `div`. The name clashes with
  `components/Reveal.tsx`, so import it as `{ Reveal as RevealIn }`.
- `ScreenTransition screenKey={screen}` wraps the screen switch. A new key remounts
  the subtree with a fade over `--dur-2` and an 8 px settle over `--dur-3`. For the
  duration of the animation the wrapper is transformed, so keep `position: fixed`
  elements (AmbientField, toasts) outside it.

Tests: `npx vitest run --root src/motion` (the repo config only collects `tests/engine`).
