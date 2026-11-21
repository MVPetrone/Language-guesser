import { afterEach, describe, expect, it } from 'vitest'
import { LANGUAGES, type LangCode, type Language } from '../../src/data/languages.ts'
import {
  DAILY_RESULTS_CAP,
  currentStreak,
  dailyGuess,
  dailyNext,
  dailyShareText,
  dailySkip,
  formatDateKey,
  initialDaily,
  isCorrectAnswer,
  londonDateKey,
  normaliseAnswer,
  previousDateKey,
  recordDailyResult,
  resolveLanguage,
  suggestLanguages,
  type DailyRecord,
  type DailyResult,
  type DailyState,
} from '../../src/engine/daily.ts'
import { BASE_POINTS, LIVES, ROUNDS, STREAK_BONUS } from '../../src/engine/game.ts'
import { loadDaily, saveDaily } from '../../src/storage.ts'

const lang = (code: LangCode): Language => LANGUAGES.find((l) => l.code === code) as Language

/** Plays a whole day, answering correctly when `hit(n)` says so; returns every state visited. */
function play(date: string, hit: (n: number) => boolean = () => true): DailyState[] {
  let s = initialDaily(date)
  const seen = [s]
  while (s.game.phase !== 'over') {
    const { language } = s.game.round
    s = dailyGuess(s, hit(s.game.roundNumber) ? language.name : 'zzz')
    seen.push(s)
    s = dailyNext(s)
    seen.push(s)
  }
  return seen
}

const roundsOf = (date: string) =>
  play(date)
    .filter((s) => s.game.phase === 'round')
    .map((s) => `${s.game.round.language.code}|${s.game.round.voiceIndex}|${s.game.round.sentenceId}`)

describe('daily dates', () => {
  it('keys the day in Europe/London, not UTC or local time', () => {
    // 23:30 UTC in summer is already tomorrow in London (BST, UTC+1).
    expect(londonDateKey(new Date('2026-07-01T23:30:00Z'))).toBe('2026-07-02')
    // In winter London is on UTC.
    expect(londonDateKey(new Date('2026-11-21T23:30:00Z'))).toBe('2026-11-21')
    expect(londonDateKey(new Date('2026-11-22T00:00:00Z'))).toBe('2026-11-22')
  })

  it('steps back across month and year boundaries', () => {
    expect(previousDateKey('2026-11-21')).toBe('2026-11-20')
    expect(previousDateKey('2026-03-01')).toBe('2026-02-28')
    expect(previousDateKey('2028-03-01')).toBe('2028-02-29')
    expect(previousDateKey('2027-01-01')).toBe('2026-12-31')
  })

  it('formats as DD/MM/YYYY', () => {
    expect(formatDateKey('2026-11-21')).toBe('21/11/2026')
  })
})

describe('daily determinism', () => {
  it('gives the same rounds for the same date', () => {
    expect(roundsOf('2026-11-21')).toEqual(roundsOf('2026-11-21'))
  })

  it('gives different rounds on the next date', () => {
    expect(roundsOf('2026-11-22')).not.toEqual(roundsOf('2026-11-21'))
  })

  it('plays 10 rounds of tier 1–2 languages, none repeated', () => {
    for (const date of ['2026-11-21', '2026-11-22', '2027-01-01', '2026-06-15']) {
      const rounds = roundsOf(date)
      expect(rounds).toHaveLength(ROUNDS)
      const codes = rounds.map((r) => r.split('|')[0] as LangCode)
      expect(new Set(codes).size).toBe(ROUNDS)
      for (const code of codes) expect([1, 2]).toContain(lang(code).tier)
      for (const r of rounds) expect(r).toMatch(/\|l2-/)
    }
  })

  it('scores typed answers like the normal game and costs a life on a miss', () => {
    const final = play('2026-11-21').at(-1) as DailyState
    // A perfect day: 100, 125, 150, 175, 200, then 225 × 5.
    const expected = Array.from({ length: ROUNDS }, (_, i) => BASE_POINTS + STREAK_BONUS * Math.min(i, 5)).reduce(
      (a, b) => a + b,
    )
    expect(final.game.score).toBe(expected)
    expect(final.game.lives).toBe(LIVES)

    const allWrong = play('2026-11-21', () => false).at(-1) as DailyState
    expect(allWrong.game.lives).toBe(0)
    expect(allWrong.game.history).toHaveLength(LIVES)
    expect(allWrong.game.score).toBe(0)
    expect(allWrong.typed).toEqual(['zzz', 'zzz', 'zzz'])
  })

  it('ignores blank guesses and skips without penalty', () => {
    const s = initialDaily('2026-11-21')
    expect(dailyGuess(s, '   ')).toBe(s)
    const skipped = dailySkip(s)
    expect(skipped.game.lives).toBe(LIVES)
    expect(skipped.game.lastResult?.skipped).toBe(true)
    expect(skipped.typed).toEqual([null])
  })
})

describe('normalising and judging typed answers', () => {
  it('normalises case, accents, punctuation, whitespace and parentheticals', () => {
    expect(normaliseAnswer('  ESPAÑOL ')).toBe('espanol')
    expect(normaliseAnswer('Portuguese (Brazil)')).toBe('portuguese')
    expect(normaliseAnswer('tiếng   việt!')).toBe('tieng viet')
    expect(normaliseAnswer('Oʻzbekcha')).toBe('ozbekcha')
    expect(normaliseAnswer('Serbo-Croatian')).toBe('serbo croatian')
  })

  it('accepts the name and native name in any case, with or without accents', () => {
    const es = lang('es-ES')
    for (const t of ['Spanish', 'spanish', ' SPANISH ', 'Español', 'espanol', 'ESPANOL']) {
      expect(isCorrectAnswer(t, es), t).toBe(true)
    }
    expect(isCorrectAnswer('日本語', lang('ja-JP'))).toBe(true)
    expect(isCorrectAnswer('Français', lang('fr-FR'))).toBe(true)
  })

  it('accepts aliases', () => {
    expect(isCorrectAnswer('Castilian', lang('es-ES'))).toBe(true)
    expect(isCorrectAnswer('farsi', lang('fa-IR'))).toBe(true)
    expect(isCorrectAnswer('Mandarin', lang('zh-CN'))).toBe(true)
    expect(isCorrectAnswer('cantonese', lang('zh-HK'))).toBe(true)
    expect(isCorrectAnswer('Hindi', lang('hi-IN'))).toBe(true)
    expect(isCorrectAnswer('tagalog', lang('fil-PH'))).toBe(true)
  })

  it('accepts every way of writing Portuguese (Brazil)', () => {
    const pt = lang('pt-BR')
    for (const t of ['Portuguese (Brazil)', 'portuguese', 'Portuguese brazil', 'Brazilian Portuguese', 'português', 'portugues']) {
      expect(isCorrectAnswer(t, pt), t).toBe(true)
    }
  })

  it('rejects other languages, partial names and near misses', () => {
    expect(isCorrectAnswer('Portuguese', lang('es-ES'))).toBe(false)
    expect(isCorrectAnswer('span', lang('es-ES'))).toBe(false)
    expect(isCorrectAnswer('spanishh', lang('es-ES'))).toBe(false)
    expect(isCorrectAnswer('', lang('es-ES'))).toBe(false)
    expect(isCorrectAnswer('Mandarin (Taiwan)', lang('zh-CN'))).toBe(false)
    expect(isCorrectAnswer('Mandarin (Taiwan)', lang('zh-TW'))).toBe(true)
  })

  it('every roster language is accepted under its own display and native names', () => {
    for (const l of LANGUAGES) {
      expect(isCorrectAnswer(l.name, l), l.name).toBe(true)
      expect(isCorrectAnswer(l.nativeName, l), l.nativeName).toBe(true)
    }
  })

  it('resolves typed text to the language it names', () => {
    expect(resolveLanguage('farsi')?.code).toBe('fa-IR')
    expect(resolveLanguage('Mandarin (Taiwan)')?.code).toBe('zh-TW')
    expect(resolveLanguage('klingon')).toBeNull()
  })
})

describe('autocomplete', () => {
  it('finds by prefix of the display name', () => {
    expect(suggestLanguages('span')[0]?.name).toBe('Spanish')
  })

  it('ranks display-name matches above native-name and alias matches', () => {
    // "Shqip" (Albanian) and "Suomi" (Finnish) also start with s.
    const names = suggestLanguages('s').map((l) => l.name)
    expect(names.slice(0, 3)).toEqual(['Serbian', 'Sinhala', 'Slovak'])
  })

  it('finds by native name without accents', () => {
    expect(suggestLanguages('espanol').map((l) => l.code)).toContain('es-ES')
    expect(suggestLanguages('nihon').map((l) => l.code)).toContain('ja-JP')
  })

  it('finds by alias and inside parentheticals', () => {
    expect(suggestLanguages('farsi')[0]?.code).toBe('fa-IR')
    expect(suggestLanguages('brazil').map((l) => l.code)).toContain('pt-BR')
  })

  it('returns nothing for blank input and caps the list', () => {
    expect(suggestLanguages('  ')).toEqual([])
    expect(suggestLanguages('a').length).toBeLessThanOrEqual(8)
  })
})

describe('daily streaks', () => {
  const r: DailyResult = { score: 500, correct: 5, total: 10 }

  it('starts at 1 and grows on consecutive days', () => {
    let rec = recordDailyResult(null, '2026-11-19', r)
    expect(rec).toMatchObject({ lastDate: '2026-11-19', streak: 1, best: 1 })
    rec = recordDailyResult(rec, '2026-11-20', r)
    rec = recordDailyResult(rec, '2026-11-21', r)
    expect(rec).toMatchObject({ lastDate: '2026-11-21', streak: 3, best: 3 })
  })

  it('resets to 1 after a gap but keeps the best', () => {
    let rec = recordDailyResult(null, '2026-11-18', r)
    rec = recordDailyResult(rec, '2026-11-19', r)
    rec = recordDailyResult(rec, '2026-11-21', r)
    expect(rec).toMatchObject({ lastDate: '2026-11-21', streak: 1, best: 2 })
  })

  it('crosses month boundaries', () => {
    const rec = recordDailyResult(recordDailyResult(null, '2026-11-30', r), '2026-12-01', r)
    expect(rec.streak).toBe(2)
  })

  it('never counts the same day twice', () => {
    const rec = recordDailyResult(null, '2026-11-21', r)
    expect(recordDailyResult(rec, '2026-11-21', { ...r, score: 900 })).toBe(rec)
  })

  it('the live streak survives until the end of the next day', () => {
    const rec: DailyRecord = { lastDate: '2026-11-20', streak: 4, best: 4, results: {} }
    expect(currentStreak(rec, '2026-11-20')).toBe(4)
    expect(currentStreak(rec, '2026-11-21')).toBe(4)
    expect(currentStreak(rec, '2026-11-22')).toBe(0)
    expect(currentStreak(null, '2026-11-22')).toBe(0)
  })

  it('caps the stored results to the newest days', () => {
    let rec: DailyRecord | null = null
    let day = '2026-12-31'
    const days: string[] = []
    for (let i = 0; i < DAILY_RESULTS_CAP + 10; i++) {
      days.unshift(day)
      day = previousDateKey(day)
    }
    for (const d of days) rec = recordDailyResult(rec, d, r)
    const kept = Object.keys(rec?.results ?? {})
    expect(kept).toHaveLength(DAILY_RESULTS_CAP)
    expect(kept.at(-1)).toBe('2026-12-31')
    expect(rec?.streak).toBe(DAILY_RESULTS_CAP + 10)
  })

  it('builds the share text', () => {
    expect(dailyShareText('2026-11-21', { score: 700, correct: 7, total: 10 }, 3, 'https://x/?daily=1')).toBe(
      'Lingo Guess Daily 21/11/2026 — 7/10 🔥 3-day streak\nhttps://x/?daily=1',
    )
  })
})

describe('daily storage', () => {
  function fakeStorage(store: Map<string, string> | 'throws') {
    const deny = () => {
      throw new DOMException('denied', 'SecurityError')
    }
    const localStorage =
      store === 'throws'
        ? { getItem: deny, setItem: deny }
        : { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) }
    Object.defineProperty(globalThis, 'window', { value: { localStorage }, configurable: true })
  }

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('round-trips under lingo.daily.v1', () => {
    const store = new Map<string, string>()
    fakeStorage(store)
    const rec = recordDailyResult(null, '2026-11-21', { score: 1, correct: 1, total: 10, grid: '🟩' })
    saveDaily(rec)
    expect(store.has('lingo.daily.v1')).toBe(true)
    expect(loadDaily()).toEqual(rec)
  })

  it('drops corrupt values and survives storage errors', () => {
    fakeStorage(new Map([['lingo.daily.v1', '{nope']]))
    expect(loadDaily()).toBeNull()
    fakeStorage(new Map([['lingo.daily.v1', '{"lastDate":"x","streak":1,"best":1,"results":{}}']]))
    expect(loadDaily()).toBeNull()
    fakeStorage(
      new Map([
        [
          'lingo.daily.v1',
          '{"lastDate":"2026-11-21","streak":2,"best":3,"results":{"2026-11-21":{"score":5,"correct":1,"total":10},"bad":{},"2026-11-20":{"score":"x"}}}',
        ],
      ]),
    )
    expect(loadDaily()).toEqual({
      lastDate: '2026-11-21',
      streak: 2,
      best: 3,
      results: { '2026-11-21': { score: 5, correct: 1, total: 10 } },
    })
    fakeStorage('throws')
    expect(loadDaily()).toBeNull()
    expect(() => saveDaily({ lastDate: '2026-11-21', streak: 1, best: 1, results: {} })).not.toThrow()
  })
})
