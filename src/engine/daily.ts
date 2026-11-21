// Daily Challenge: one fixed game per Europe/London calendar day, answered by
// typing the language's name. Rounds come from the normal engine (same
// buildRound / applyResult / nextRound, same seeded RNG); only the judging
// differs — free text instead of an option index. Pure and framework-free.
import { ALIASES } from '../data/aliases.ts'
import { LANGUAGES, type LangCode, type Language } from '../data/languages.ts'
import { ROUNDS, applyResult, guess, initialState, nextRound, pointsFor, shareGrid, type Difficulty, type GameState, type RoundResult } from './game.ts'
import { seedFromString } from './rng.ts'

/** Tiers 1 + 2 and level-2 sentences: typed recall is already hard. */
export const DAILY_DIFFICULTY: Difficulty = 'normal'
export const DAILY_TIME_ZONE = 'Europe/London'
/** Days of results kept in storage; older ones are dropped first. */
export const DAILY_RESULTS_CAP = 60
export const SUGGESTION_LIMIT = 8

// ---- dates ------------------------------------------------------------------

/** `YYYY-MM-DD` of `now` in Europe/London: the day everyone shares. */
export function londonDateKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: DAILY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** The calendar day before `key` (both `YYYY-MM-DD`). */
export function previousDateKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number]
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10)
}

/** `2026-11-21` → `21/11/2026`, for the card and the share text. */
export function formatDateKey(key: string): string {
  const [y, m, d] = key.split('-')
  return `${d}/${m}/${y}`
}

export function dailySeed(dateKey: string): number {
  return seedFromString(`daily-${dateKey}`)
}

// ---- game -------------------------------------------------------------------

export interface DailyState {
  date: string
  /** A normal-engine game; its options are generated but never shown. */
  game: GameState
  /** What the player typed each round, in order; null for a skipped round. */
  typed: readonly (string | null)[]
}

/**
 * The day's game. The pool is always the full roster and there is no
 * heard-clip memory, so the date alone determines every round.
 */
export function initialDaily(dateKey: string): DailyState {
  return { date: dateKey, game: initialState(dailySeed(dateKey), DAILY_DIFFICULTY, LANGUAGES, []), typed: [] }
}

export function scoreTyped(game: GameState, text: string): RoundResult {
  const { round, roundNumber } = game
  const correct = isCorrectAnswer(text, round.language)
  return {
    roundNumber,
    code: round.language.code,
    sentenceId: round.sentenceId,
    voiceIndex: round.voiceIndex,
    guessCode: resolveLanguage(text)?.code ?? null,
    correct,
    skipped: false,
    points: correct ? pointsFor(game.streak) : 0,
  }
}

export function dailyGuess(state: DailyState, text: string): DailyState {
  if (state.game.phase !== 'round' || normaliseAnswer(text) === '') return state
  return { ...state, game: applyResult(state.game, scoreTyped(state.game, text)), typed: [...state.typed, text] }
}

/** The clip failed to load: no penalty, same as the normal game's skip. */
export function dailySkip(state: DailyState): DailyState {
  if (state.game.phase !== 'round') return state
  return { ...state, game: guess(state.game, null), typed: [...state.typed, null] }
}

export function dailyNext(state: DailyState): DailyState {
  return { ...state, game: nextRound(state.game) }
}

export function correctCount(game: GameState): number {
  return game.history.filter((r) => r.correct).length
}

// ---- judging ----------------------------------------------------------------

/**
 * Canonical form of a typed answer: parentheticals dropped, accents and
 * modifier letters stripped, lower case, punctuation and runs of whitespace
 * collapsed to single spaces. "  Portuguese (Brazil)! " → "portuguese".
 */
export function normaliseAnswer(text: string): string {
  return fold(text.replace(/\([^)]*\)/g, ' '))
}

/** Like `normaliseAnswer` but keeps parenthetical words: "portuguese brazil". */
function normaliseFull(text: string): string {
  return fold(text)
}

function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\p{M}ʰ-˿]/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const accepted = new Map<LangCode, ReadonlySet<string>>(
  LANGUAGES.map((l) => [
    l.code,
    new Set(
      [normaliseAnswer(l.name), normaliseFull(l.name), normaliseAnswer(l.nativeName), ...(ALIASES[l.code] ?? []).map(normaliseAnswer)].filter(
        (s) => s !== '',
      ),
    ),
  ]),
)

/** Full display names ("mandarin taiwan"), which pin down one language exactly. */
const byFullName = new Map<string, Language>(LANGUAGES.map((l) => [normaliseFull(l.name), l]))

/** Every normalised form judged correct for `language`. */
export function acceptedAnswers(language: Language): ReadonlySet<string> {
  return accepted.get(language.code) ?? new Set()
}

/**
 * Exact match after normalisation against the name, native name or an alias.
 * A full display name of a *different* language ("Mandarin (Taiwan)" when the
 * answer is Mandarin (Mainland)) is wrong even though its short form matches.
 */
export function isCorrectAnswer(text: string, language: Language): boolean {
  const exact = byFullName.get(normaliseFull(text))
  if (exact) return exact.code === language.code
  return acceptedAnswers(language).has(normaliseAnswer(text))
}

/** The language the text names, if any (for the reveal and the log). */
export function resolveLanguage(text: string): Language | null {
  const exact = byFullName.get(normaliseFull(text))
  if (exact) return exact
  const key = normaliseAnswer(text)
  if (key === '') return null
  return LANGUAGES.find((l) => acceptedAnswers(l).has(key)) ?? null
}

const searchTerms = new Map<LangCode, readonly string[]>(
  LANGUAGES.map((l) => [l.code, [l.name, l.nativeName, ...(ALIASES[l.code] ?? [])].map(normaliseFull)]),
)

/** 0 exact, 1 prefix, 2 prefix of a later word, 3 anywhere; null for no match. */
function matchRank(term: string, query: string): number | null {
  if (term === query) return 0
  if (term.startsWith(query)) return 1
  if (term.includes(` ${query}`)) return 2
  if (term.includes(query)) return 3
  return null
}

/**
 * Autocomplete: languages whose name, native name or an alias matches the
 * query (case- and accent-insensitive), best match first (a display-name
 * match before a native-name or alias one), then A–Z. Draws
 * from the whole roster so the list never hints at which tier is in play.
 */
export function suggestLanguages(query: string, limit = SUGGESTION_LIMIT): Language[] {
  const q = normaliseFull(query)
  if (q === '') return []
  const ranked: { language: Language; rank: number }[] = []
  for (const language of LANGUAGES) {
    // The display name (first term) wins a tie with a native name or alias.
    const ranks = (searchTerms.get(language.code) ?? [])
      .map((t, i) => {
        const r = matchRank(t, q)
        return r === null ? null : r * 2 + (i === 0 ? 0 : 1)
      })
      .filter((r) => r !== null)
    if (ranks.length > 0) ranked.push({ language, rank: Math.min(...ranks) })
  }
  ranked.sort((a, b) => a.rank - b.rank || a.language.name.localeCompare(b.language.name, 'en'))
  return ranked.slice(0, limit).map((r) => r.language)
}

// ---- record & streaks ---------------------------------------------------------

export interface DailyResult {
  score: number
  correct: number
  total: number
  /** Emoji grid for sharing; absent in records written without one. */
  grid?: string
}

export interface DailyRecord {
  /** Most recent completed day, `YYYY-MM-DD`. */
  lastDate: string
  /** Consecutive completed days ending on `lastDate`. */
  streak: number
  /** Longest streak ever. */
  best: number
  results: Record<string, DailyResult>
}

export function resultOf(game: GameState): DailyResult {
  return { score: game.score, correct: correctCount(game), total: ROUNDS, grid: shareGrid(game.history) }
}

/**
 * Folds a completed day into the record. The streak grows only when the
 * previous completed day was yesterday; any gap restarts it at 1. A day that
 * is already recorded is left alone, so finishing twice never counts twice.
 */
export function recordDailyResult(record: DailyRecord | null, date: string, result: DailyResult): DailyRecord {
  if (record?.results[date]) return record
  const streak = record && record.lastDate === previousDateKey(date) ? record.streak + 1 : 1
  const kept = Object.keys(record?.results ?? {})
    .concat(date)
    .sort()
    .slice(-DAILY_RESULTS_CAP)
  const all: Record<string, DailyResult> = { ...record?.results, [date]: result }
  return {
    lastDate: record && record.lastDate > date ? record.lastDate : date,
    streak,
    best: Math.max(record?.best ?? 0, streak),
    results: Object.fromEntries(kept.map((d) => [d, all[d] as DailyResult])),
  }
}

/** The streak as of `today`: still alive if the last completed day is today or yesterday. */
export function currentStreak(record: DailyRecord | null, today: string): number {
  if (!record) return 0
  return record.lastDate === today || record.lastDate === previousDateKey(today) ? record.streak : 0
}

export function dailyShareText(date: string, result: DailyResult, streak: number, url: string): string {
  const head = `Lingo Guess Daily ${formatDateKey(date)} — ${result.correct}/${result.total}`
  return [
    streak > 0 ? `${head} 🔥 ${streak}-day streak` : head,
    ...(result.grid ? [result.grid] : []),
    url,
  ].join('\n')
}
