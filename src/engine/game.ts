// Pure, framework-free game logic. Every function returns new state and never
// mutates its input; randomness comes only from seeded RNGs, so a seed fully
// determines a game.
import type { LangCode, Language, Tier } from '../data/languages.ts'
import { sentencesForLevel, type SentenceLevel } from '../data/sentences.ts'
import { VOICES_BY_LANG } from '../data/voices.ts'
import { mulberry32, randInt, shuffle, type Rng } from './rng.ts'

export const ROUNDS = 10
export const LIVES = 3
export const OPTION_COUNT = 4
export const BASE_POINTS = 100
/** Extra points per consecutive correct answer already on the streak. */
export const STREAK_BONUS = 25
/** The bonus stops growing after this many consecutive hits. */
export const MAX_STREAK_BONUS_STEPS = 5
export const SLOW_RATE = 0.6
/** Fewest languages a game may draw from once the player's known ones are excluded. */
export const MIN_POOL = 12

export type Difficulty = 'easy' | 'normal' | 'hard'

/** Which tiers the *answer* may be drawn from at each difficulty. */
export const DIFFICULTY_TIERS: Record<Difficulty, readonly Tier[]> = {
  easy: [1],
  normal: [1, 2],
  hard: [1, 2, 3],
}

/**
 * Tiers the answer is actually drawn from: the difficulty's own, or — when the
 * pool has none of those left (the player knows them all) — the nearest tier
 * that still has a language, preferring the easier one on a tie.
 */
export function answerTiers(pool: readonly Language[], difficulty: Difficulty): readonly Tier[] {
  const tiers = DIFFICULTY_TIERS[difficulty]
  if (pool.some((l) => tiers.includes(l.tier))) return tiers
  const distance = (t: Tier) => Math.min(...tiers.map((a) => Math.abs(a - t)))
  const present = [...new Set(pool.map((l) => l.tier))].sort((a, b) => distance(a) - distance(b) || a - b)
  return present.slice(0, 1)
}

/** Which sentence level is spoken at each difficulty. */
export const DIFFICULTY_LEVEL: Record<Difficulty, SentenceLevel> = {
  easy: 1,
  normal: 2,
  hard: 3,
}

export function levelForDifficulty(difficulty: Difficulty): SentenceLevel {
  return DIFFICULTY_LEVEL[difficulty]
}

export type Options = [Language, Language, Language, Language]

export interface RoundSpec {
  language: Language
  sentenceId: string
  /** Index into `VOICES_BY_LANG[language.code]`. */
  voiceIndex: number
  options: Options
  correctIndex: number
}

export interface RoundResult {
  roundNumber: number
  code: LangCode
  sentenceId: string
  voiceIndex: number
  /** null when the round was skipped (e.g. the clip failed to load). */
  guessCode: LangCode | null
  correct: boolean
  skipped: boolean
  points: number
}

export type Phase = 'round' | 'reveal' | 'over'

export interface GameState {
  seed: number
  difficulty: Difficulty
  pool: Language[]
  phase: Phase
  /** 1-based number of the round currently being played or revealed. */
  roundNumber: number
  round: RoundSpec
  score: number
  streak: number
  bestStreak: number
  lives: number
  history: RoundResult[]
  lastResult: RoundResult | null
  /** Clip keys heard in earlier games, oldest first; read-only memory for `buildRound`. */
  heard: readonly string[]
}

/** Identifies one recorded clip; the unit of "never hear the same thing twice". */
export function clipKey(code: LangCode, voiceIndex: number, sentenceId: string): string {
  return `${code}|${voiceIndex}|${sentenceId}`
}

/** What a new round should steer clear of. Every list is a preference, never a hard rule. */
export interface Avoid {
  /** Answer languages already used this game. */
  codes?: readonly LangCode[]
  /** Clip keys (see `clipKey`) already played this game. */
  clips?: readonly string[]
  /** Clip keys heard in earlier games, oldest first (persisted by the app). */
  heard?: readonly string[]
}

interface Clip {
  language: Language
  sentenceId: string
  voiceIndex: number
}

/**
 * Picks the clip for a round. Candidates are every (language, sentence, voice)
 * of the level; they are narrowed by the strictest filter that still leaves
 * something, so running out of fresh clips degrades gracefully and never
 * throws. In order of preference:
 *   1. a clip never heard before (not this game, not in `heard`), from a
 *      language not yet answered this game — or, failing that, from any
 *      language;
 *   2. once every clip has been heard: the same, but only the most recent
 *      half of `heard` counts, then a quarter, …, so the clips heard longest
 *      ago come back first;
 *   3. anything in the level pool.
 * A clip already played this game is only possible in step 3. The language is
 * drawn first (uniform over languages that have a candidate), then one of its
 * clips, so a few heard clips do not skew which languages come up.
 */
function pickClip(rng: Rng, eligible: readonly Language[], level: SentenceLevel, avoid: Avoid): Clip {
  const sentences = sentencesForLevel(level)
  const all: Clip[] = eligible.flatMap((language) =>
    sentences.flatMap((s) =>
      VOICES_BY_LANG[language.code].map((_, voiceIndex) => ({ language, sentenceId: s.id, voiceIndex })),
    ),
  )
  if (all.length === 0) throw new Error(`No clips for sentence level ${level}`)

  const usedCodes = new Set(avoid.codes)
  const played = new Set(avoid.clips)
  const heard = avoid.heard ?? []
  const key = (c: Clip) => clipKey(c.language.code, c.voiceIndex, c.sentenceId)
  const freshLanguage = (c: Clip) => !usedCodes.has(c.language.code)
  const notPlayed = (c: Clip) => !played.has(key(c))

  // Recent-memory windows: all of `heard`, the newest half, quarter, …, none.
  const windows: ReadonlySet<string>[] = []
  for (let n = heard.length; n > 0; n = Math.floor(n / 2)) windows.push(new Set(heard.slice(-n)))
  windows.push(new Set())

  const preferences: ((c: Clip) => boolean)[] = windows.flatMap((recent) => [
    (c: Clip) => freshLanguage(c) && notPlayed(c) && !recent.has(key(c)),
    (c: Clip) => notPlayed(c) && !recent.has(key(c)),
  ])
  let candidates = all
  for (const keep of preferences) {
    const cs = all.filter(keep)
    if (cs.length > 0) {
      candidates = cs
      break
    }
  }

  const languages = [...new Set(candidates.map((c) => c.language))]
  const language = languages[randInt(rng, languages.length)] as Language
  const mine = candidates.filter((c) => c.language === language)
  return mine[randInt(rng, mine.length)] as Clip
}

/**
 * Builds one round. The answer comes from the tiers allowed by `difficulty`
 * (see `answerTiers` for the fallback when those are empty) and speaks a sentence of that difficulty's level in one of its voices;
 * distractors come from the answer's own tier so they are plausibly
 * confusable (falling back to other tiers only if that tier is too small).
 * `avoid` steers away from answers and clips already used this game.
 */
export function buildRound(
  rng: Rng,
  pool: readonly Language[],
  difficulty: Difficulty,
  avoid: Avoid = {},
): RoundSpec {
  const tiers = answerTiers(pool, difficulty)
  const eligible = pool.filter((l) => tiers.includes(l.tier))
  if (eligible.length === 0) throw new Error('The language pool is empty')

  const { language, sentenceId, voiceIndex } = pickClip(rng, eligible, levelForDifficulty(difficulty), avoid)

  const others = pool.filter((l) => l.code !== language.code)
  const sameTier = shuffle(
    rng,
    others.filter((l) => l.tier === language.tier),
  )
  const otherTier = shuffle(
    rng,
    others.filter((l) => l.tier !== language.tier),
  )
  const distractors = [...sameTier, ...otherTier].slice(0, OPTION_COUNT - 1)
  if (distractors.length < OPTION_COUNT - 1) {
    throw new Error(`Pool needs at least ${OPTION_COUNT} languages`)
  }

  const options = shuffle(rng, [language, ...distractors]) as Options
  return { language, sentenceId, voiceIndex, options, correctIndex: options.indexOf(language) }
}

/** Per-round RNG derived from the game seed, so no mutable RNG lives in state. */
export function roundRng(seed: number, roundNumber: number): Rng {
  return mulberry32((seed + Math.imul(roundNumber, 0x9e3779b9)) >>> 0)
}

export function initialState(
  seed: number,
  difficulty: Difficulty,
  pool: readonly Language[],
  heard: readonly string[] = [],
): GameState {
  return {
    seed,
    difficulty,
    pool: pool.slice(),
    phase: 'round',
    roundNumber: 1,
    round: buildRound(roundRng(seed, 1), pool, difficulty, { heard }),
    score: 0,
    streak: 0,
    bestStreak: 0,
    lives: LIVES,
    history: [],
    lastResult: null,
    heard: heard.slice(),
  }
}

/** Points a correct answer is worth given the streak *before* this answer. */
export function pointsFor(streakBefore: number): number {
  return BASE_POINTS + STREAK_BONUS * Math.min(streakBefore, MAX_STREAK_BONUS_STEPS)
}

/**
 * Evaluates a guess against the current round without changing state.
 * `guessIndex === null` means the round was skipped.
 */
export function scoreGuess(state: GameState, guessIndex: number | null): RoundResult {
  const { round, roundNumber } = state
  const base = {
    roundNumber,
    code: round.language.code,
    sentenceId: round.sentenceId,
    voiceIndex: round.voiceIndex,
  }
  if (guessIndex === null) {
    return { ...base, guessCode: null, correct: false, skipped: true, points: 0 }
  }
  const guess = round.options[guessIndex]
  if (!guess) throw new RangeError(`guessIndex out of range: ${guessIndex}`)
  const correct = guessIndex === round.correctIndex
  return {
    ...base,
    guessCode: guess.code,
    correct,
    skipped: false,
    points: correct ? pointsFor(state.streak) : 0,
  }
}

/**
 * Folds a round result into the totals and moves to the reveal phase. The
 * final round is still revealed; `nextRound` then moves to 'over'. A miss
 * costs exactly one life and resets the streak; a skip changes neither.
 */
export function applyResult(state: GameState, result: RoundResult): GameState {
  if (state.phase !== 'round') return state
  const streak = result.correct ? state.streak + 1 : result.skipped ? state.streak : 0
  const next: GameState = {
    ...state,
    score: Math.max(0, state.score + result.points),
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    lives: result.correct || result.skipped ? state.lives : Math.max(0, state.lives - 1),
    history: [...state.history, result],
    lastResult: result,
    phase: 'reveal',
  }
  return next
}

/** Convenience: score and apply in one step. */
export function guess(state: GameState, guessIndex: number | null): GameState {
  if (state.phase !== 'round') return state
  return applyResult(state, scoreGuess(state, guessIndex))
}

export function isOver(state: GameState): boolean {
  return state.lives <= 0 || state.history.length >= ROUNDS
}

/** Leaves the reveal: either starts the next round or ends the game. */
export function nextRound(state: GameState): GameState {
  if (state.phase !== 'reveal') return state
  if (isOver(state)) return { ...state, phase: 'over' }
  const roundNumber = state.roundNumber + 1
  const avoid: Avoid = {
    codes: state.history.map((r) => r.code),
    clips: state.history.map((r) => clipKey(r.code, r.voiceIndex, r.sentenceId)),
    heard: state.heard,
  }
  return {
    ...state,
    phase: 'round',
    roundNumber,
    round: buildRound(roundRng(state.seed, roundNumber), state.pool, state.difficulty, avoid),
    lastResult: null,
  }
}

/** Emoji grid for sharing: 🟩 hit, 🟥 miss, ⬜ skipped. */
export function shareGrid(history: readonly RoundResult[]): string {
  return history.map((r) => (r.correct ? '🟩' : r.skipped ? '⬜' : '🟥')).join('')
}
