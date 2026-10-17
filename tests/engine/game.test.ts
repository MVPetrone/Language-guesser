import { describe, expect, it } from 'vitest'
import { LANGUAGES, type Language } from '../../src/data/languages.ts'
import { PHRASE_IDS } from '../../src/data/phrases.ts'
import {
  BASE_POINTS,
  DIFFICULTY_TIERS,
  LIVES,
  OPTION_COUNT,
  ROUNDS,
  STREAK_BONUS,
  applyResult,
  buildRound,
  guess,
  initialState,
  isOver,
  nextRound,
  scoreGuess,
  shareGrid,
  type Difficulty,
  type GameState,
} from '../../src/engine/game.ts'
import { mulberry32 } from '../../src/engine/rng.ts'

const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard']

const wrongIndex = (s: GameState) => (s.round.correctIndex + 1) % OPTION_COUNT

/** Answer the current round (hit or miss) and advance past the reveal. */
function play(s: GameState, hit: boolean): GameState {
  return nextRound(guess(s, hit ? s.round.correctIndex : wrongIndex(s)))
}

describe('buildRound', () => {
  it('always returns 4 unique options containing the answer exactly once', () => {
    for (const difficulty of DIFFICULTIES) {
      const rng = mulberry32(1234)
      for (let i = 0; i < 2000; i++) {
        const r = buildRound(rng, LANGUAGES, difficulty)
        expect(r.options).toHaveLength(OPTION_COUNT)
        expect(new Set(r.options.map((l) => l.code)).size).toBe(OPTION_COUNT)
        expect(r.options[r.correctIndex]).toBe(r.language)
        expect(r.options.filter((l) => l.code === r.language.code)).toHaveLength(1)
        expect(PHRASE_IDS).toContain(r.phraseId)
      }
    }
  })

  it('never puts the answer in the distractor set', () => {
    const rng = mulberry32(99)
    for (let i = 0; i < 2000; i++) {
      const r = buildRound(rng, LANGUAGES, 'hard')
      const distractors = r.options.filter((_, idx) => idx !== r.correctIndex)
      expect(distractors.map((l) => l.code)).not.toContain(r.language.code)
    }
  })

  it('draws distractors from the same tier as the answer', () => {
    const rng = mulberry32(5)
    for (let i = 0; i < 1000; i++) {
      const r = buildRound(rng, LANGUAGES, 'hard')
      for (const opt of r.options) expect(opt.tier).toBe(r.language.tier)
    }
  })

  it('only picks answers from the tiers allowed by the difficulty', () => {
    for (const difficulty of DIFFICULTIES) {
      const rng = mulberry32(77)
      for (let i = 0; i < 500; i++) {
        const r = buildRound(rng, LANGUAGES, difficulty)
        expect(DIFFICULTY_TIERS[difficulty]).toContain(r.language.tier)
      }
    }
  })

  it('places the answer uniformly across positions (no positional bias)', () => {
    const draws = 20_000
    const counts = [0, 0, 0, 0]
    for (let seed = 0; seed < draws; seed++) {
      const r = buildRound(mulberry32(seed), LANGUAGES, 'hard')
      counts[r.correctIndex] = (counts[r.correctIndex] ?? 0) + 1
    }
    const expected = draws / OPTION_COUNT
    // Chi-square with 3 degrees of freedom; 16.27 is the p = 0.001 critical value.
    const chi2 = counts.reduce((acc, c) => acc + (c - expected) ** 2 / expected, 0)
    expect(chi2).toBeLessThan(16.27)
    for (const c of counts) expect(Math.abs(c - expected) / expected).toBeLessThan(0.05)
  })

  it('falls back to other tiers when the answer tier is too small', () => {
    const tiny: Language[] = [
      ...LANGUAGES.filter((l) => l.tier === 1).slice(0, 1),
      ...LANGUAGES.filter((l) => l.tier === 2).slice(0, 3),
    ]
    const r = buildRound(mulberry32(1), tiny, 'easy')
    expect(new Set(r.options.map((l) => l.code)).size).toBe(OPTION_COUNT)
    expect(r.options[r.correctIndex]?.tier).toBe(1)
  })

  it('avoids previously used answers when possible', () => {
    const tier1 = LANGUAGES.filter((l) => l.tier === 1)
    const avoid = tier1.slice(1).map((l) => l.code)
    for (let seed = 0; seed < 50; seed++) {
      const r = buildRound(mulberry32(seed), LANGUAGES, 'easy', avoid)
      expect(r.language.code).toBe(tier1[0]?.code)
    }
  })
})

describe('scoring', () => {
  it('a hit awards base points and does not cost a life', () => {
    const s0 = initialState(1, 'normal', LANGUAGES)
    const s1 = guess(s0, s0.round.correctIndex)
    expect(s1.score).toBe(BASE_POINTS)
    expect(s1.lives).toBe(LIVES)
    expect(s1.streak).toBe(1)
    expect(s1.lastResult?.correct).toBe(true)
  })

  it('a miss decrements lives exactly once', () => {
    const s0 = initialState(2, 'normal', LANGUAGES)
    const s1 = guess(s0, wrongIndex(s0))
    expect(s1.lives).toBe(LIVES - 1)
    expect(s1.score).toBe(0)
    // Guessing again during the reveal must not cost another life.
    const s2 = guess(s1, wrongIndex(s1))
    expect(s2.lives).toBe(LIVES - 1)
    expect(s2.history).toHaveLength(1)
  })

  it('applyResult is ignored outside the round phase', () => {
    const s0 = initialState(2, 'normal', LANGUAGES)
    const result = scoreGuess(s0, wrongIndex(s0))
    const s1 = applyResult(s0, result)
    expect(applyResult(s1, result)).toBe(s1)
  })

  it('scoreGuess does not change state', () => {
    const s0 = initialState(3, 'normal', LANGUAGES)
    const snapshot = JSON.stringify(s0)
    scoreGuess(s0, 0)
    expect(JSON.stringify(s0)).toBe(snapshot)
  })

  it('rejects an out-of-range guess', () => {
    const s0 = initialState(3, 'normal', LANGUAGES)
    expect(() => scoreGuess(s0, 4)).toThrow(RangeError)
  })

  it('streak bonus accumulates on consecutive hits', () => {
    let s = initialState(4, 'normal', LANGUAGES)
    const gains: number[] = []
    for (let i = 0; i < 3; i++) {
      const before = s.score
      s = guess(s, s.round.correctIndex)
      gains.push(s.score - before)
      s = nextRound(s)
    }
    expect(gains).toEqual([BASE_POINTS, BASE_POINTS + STREAK_BONUS, BASE_POINTS + 2 * STREAK_BONUS])
    expect(s.streak).toBe(3)
    expect(s.bestStreak).toBe(3)
  })

  it('streak bonus resets on a miss', () => {
    let s = initialState(5, 'normal', LANGUAGES)
    s = play(s, true)
    s = play(s, true)
    s = play(s, false)
    expect(s.streak).toBe(0)
    expect(s.bestStreak).toBe(2)
    const before = s.score
    s = guess(s, s.round.correctIndex)
    expect(s.score - before).toBe(BASE_POINTS)
  })

  it('a skipped round changes neither lives nor streak and scores 0', () => {
    let s = initialState(6, 'normal', LANGUAGES)
    s = play(s, true)
    s = guess(s, null)
    expect(s.lives).toBe(LIVES)
    expect(s.streak).toBe(1)
    expect(s.lastResult).toMatchObject({ skipped: true, correct: false, points: 0, guessCode: null })
  })

  it('score is never negative', () => {
    for (let seed = 0; seed < 200; seed++) {
      const rng = mulberry32(seed)
      let s = initialState(seed, 'hard', LANGUAGES)
      while (s.phase !== 'over') {
        const choice = rng()
        s = guess(s, choice < 0.1 ? null : Math.floor(rng() * OPTION_COUNT))
        expect(s.score).toBeGreaterThanOrEqual(0)
        expect(s.lives).toBeGreaterThanOrEqual(0)
        s = nextRound(s)
      }
    }
  })
})

describe('game over', () => {
  it('ends at 0 lives', () => {
    let s = initialState(7, 'normal', LANGUAGES)
    for (let i = 0; i < LIVES; i++) {
      expect(isOver(s)).toBe(false)
      s = guess(s, wrongIndex(s))
      if (i < LIVES - 1) s = nextRound(s)
    }
    expect(s.lives).toBe(0)
    expect(isOver(s)).toBe(true)
    expect(s.phase).toBe('reveal')
    s = nextRound(s)
    expect(s.phase).toBe('over')
    expect(s.history).toHaveLength(LIVES)
  })

  it('ends after ROUNDS rounds when lives remain', () => {
    let s = initialState(8, 'normal', LANGUAGES)
    for (let i = 0; i < ROUNDS; i++) {
      expect(s.phase).toBe('round')
      expect(s.roundNumber).toBe(i + 1)
      s = play(s, true)
    }
    expect(s.phase).toBe('over')
    expect(isOver(s)).toBe(true)
    expect(s.history).toHaveLength(ROUNDS)
    expect(s.lives).toBe(LIVES)
  })

  it('does not repeat an answer within a game', () => {
    let s = initialState(9, 'hard', LANGUAGES)
    while (s.phase !== 'over') s = play(s, true)
    const codes = s.history.map((r) => r.code)
    expect(new Set(codes).size).toBe(codes.length)
  })
})

describe('determinism', () => {
  it('the same seed produces an identical round sequence twice', () => {
    const run = (seed: number) => {
      let s = initialState(seed, 'hard', LANGUAGES)
      const rounds = []
      while (s.phase !== 'over') {
        rounds.push({
          code: s.round.language.code,
          phraseId: s.round.phraseId,
          options: s.round.options.map((l) => l.code),
          correctIndex: s.round.correctIndex,
        })
        s = play(s, s.roundNumber % 3 !== 0)
      }
      return rounds
    }
    for (const seed of [0, 1, 42, 0xdeadbeef]) {
      const a = run(seed)
      expect(a.length).toBeGreaterThan(0)
      expect(run(seed)).toEqual(a)
    }
    expect(run(1)).not.toEqual(run(2))
  })
})

describe('shareGrid', () => {
  it('maps hits, misses and skips to emoji', () => {
    let s = initialState(10, 'normal', LANGUAGES)
    s = play(s, true)
    s = play(s, false)
    s = nextRound(guess(s, null))
    expect(shareGrid(s.history)).toBe('🟩🟥⬜')
  })
})
