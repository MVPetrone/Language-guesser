/**
 * WaveformLive's synthetic voice. The game's audio path is autoplay-gated, so
 * the waveform never touches WebAudio or the <audio> element (see MOTION.md):
 * it plays a deterministic, speech-shaped envelope instead. Everything here is
 * a pure function of time in seconds, so it is unit-tested and frame-exact.
 */
import { clamp01, hash, noise, smoothstep } from './random.ts'
import type { Easing } from './tokens.ts'

const TAU = Math.PI * 2

/** Mean syllable rate of conversational speech, Hz. */
const SYLLABLE_HZ = 4.6
/** Share of syllable slots left silent: the gaps between words. */
const WORD_GAP = 0.16
/** How long a syllable onset takes to ripple from the centre bars to the edges, s. */
const RIPPLE_S = 0.09

const SEED = {
  rate: 0x5101,
  stress: 0x5102,
  gap: 0x5103,
  phrase: 0x5104,
  flutter: 0x5105,
  rest: 0x5106,
  pose: 0x5107,
  phase: 0x5110,
  walk: 0x5200,
} as const

/** One syllable over u in [0, 1): quick attack (peak near u = 0.28), slower decay, 0 at both ends. */
function syllable(u: number): number {
  const s = Math.sin(Math.PI * Math.pow(u, 0.55))
  return s * s
}

/**
 * Loudness of the synthetic voice at t: syllable pulses on a wandering ~4.6 Hz
 * clock, stressed and unstressed, grouped into words by silent slots and into
 * phrases by slow breath pauses. 0 (near-silence) to 1.
 */
export function speechEnergy(t: number): number {
  // The clock wanders by up to half a syllable but never runs backwards, and
  // every syllable starts and ends at zero, so per-syllable choices never jump.
  const phase = SYLLABLE_HZ * t + 0.9 * (noise(t * 0.8, SEED.rate) - 0.5)
  const k = Math.floor(phase)
  const pulse = syllable(phase - k)
  const stress = 0.45 + 0.55 * hash(k, SEED.stress)
  const voiced = hash(k, SEED.gap) < WORD_GAP ? 0.06 : 1
  const phrase = smoothstep(0.18, 0.4, noise(t * 0.45, SEED.phrase))
  const flutter = 0.86 + 0.14 * noise(t * 17, SEED.flutter)
  return clamp01(pulse * stress * voiced * phrase * flutter)
}

/** Distance of bar i from the middle of n bars: 0 at the centre, 1 at either edge. */
function offset(i: number, n: number): number {
  const centre = (n - 1) / 2
  return centre > 0 ? Math.abs(i - centre) / centre : 0
}

/** Resting pose of bar i of n: low, gently arched, slightly irregular. Static. */
export function restLevel(i: number, n: number): number {
  return 0.07 + 0.06 * Math.cos((offset(i, n) * Math.PI) / 2) + 0.035 * hash(i, SEED.rest)
}

/**
 * Bar i of n at t with the voice fully up, in [rest, 1]. The shared energy
 * makes every bar rise and fall together, syllable by syllable, which is what
 * reads as speech rather than an equaliser. Each bar's share comes from three
 * incommensurate sines plus a slow random walk seeded by its index.
 */
export function voicedLevel(i: number, n: number, t: number): number {
  const o = offset(i, n)
  const energy = speechEnergy(t - o * RIPPLE_S)
  const envelope = 0.4 + 0.6 * Math.cos((o * Math.PI) / 2)
  const timbre =
    0.6 +
    0.15 * Math.sin(TAU * 1.37 * t + TAU * hash(i, SEED.phase)) +
    0.1 * Math.sin(TAU * 2.93 * t + TAU * hash(i, SEED.phase + 1)) +
    0.08 * Math.sin(TAU * 0.61 * t + TAU * hash(i, SEED.phase + 2)) +
    0.34 * (noise(t * 1.6, SEED.walk + i) - 0.5)
  const rest = restLevel(i, n)
  return rest + (1 - rest) * clamp01(1.25 * energy * envelope * timbre)
}

/** The still pose shown while playing under reduced motion: speech-shaped, not moving. */
export function voicedPose(i: number, n: number): number {
  const rest = restLevel(i, n)
  const shape =
    (0.35 + 0.65 * Math.cos((offset(i, n) * Math.PI) / 2)) * (0.55 + 0.45 * hash(i, SEED.pose))
  return rest + (1 - rest) * 0.72 * shape
}

/** What bar i shows at t: its rest pose blended toward the voice by `gain` (0 to 1). */
export function barScale(i: number, n: number, t: number, gain: number): number {
  const rest = restLevel(i, n)
  if (gain <= 0) return rest
  return rest + (voicedLevel(i, n, t) - rest) * clamp01(gain)
}

/** A gain ramp from `from` to `to`, starting at `start` and lasting `duration` (both ms). */
export interface Ramp {
  from: number
  to: number
  start: number
  duration: number
}

/** The ramp's value at `now` (ms). A zero duration (reduced motion) lands on `to` at once. */
export function rampAt(ramp: Ramp, now: number, ease: Easing): number {
  if (!(ramp.duration > 0)) return ramp.to
  const x = clamp01((now - ramp.start) / ramp.duration)
  return ramp.from + (ramp.to - ramp.from) * ease(x)
}
