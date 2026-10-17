import { describe, expect, it } from 'vitest'
import type { LangCode } from '../../src/data/languages.ts'
import { SENTENCES, sentenceById, sentencesForLevel, type Sentence } from '../../src/data/sentences.ts'
import { blockedTerms, countWords, validateSentences } from '../../scripts/validate_sentences.mts'

/** A deep copy of the real pool with one text replaced. */
function withText(id: string, code: LangCode, text: string): Sentence[] {
  return SENTENCES.map((s) => (s.id === id ? { ...s, text: { ...s.text, [code]: text } } : s))
}

const L1 = 'l1-children-asleep-dog-awake'

describe('sentence pool', () => {
  it('passes every validation check', () => {
    expect(validateSentences(SENTENCES).errors).toEqual([])
  })

  it('has 2 / 3 / 3 sentences per level with stable slug ids', () => {
    expect(sentencesForLevel(1)).toHaveLength(2)
    expect(sentencesForLevel(2)).toHaveLength(3)
    expect(sentencesForLevel(3)).toHaveLength(3)
    for (const s of SENTENCES) expect(sentenceById(s.id)).toBe(s)
    expect(() => sentenceById('hello')).toThrow()
  })
})

describe('validateSentences catches', () => {
  it('a missing language', () => {
    const broken = SENTENCES.map((s) => {
      if (s.id !== L1) return s
      const text: Partial<Record<LangCode, string>> = { ...s.text }
      delete text['sw-KE']
      return { ...s, text } as Sentence
    })
    expect(validateSentences(broken).errors).toContain(`${L1} [sw-KE]: missing`)
  })

  it('the wrong script, in both directions', () => {
    const latinInRussian = validateSentences(withText(L1, 'ru-RU', 'Дети уже спят, но dog ещё не спит.')).errors
    expect(latinInRussian.some((e) => e.startsWith(`${L1} [ru-RU]: letters outside Cyrillic`))).toBe(true)
    const cyrillicInPolish = validateSentences(withText(L1, 'pl-PL', 'Dzieci już śpią, ale собака wciąż nie śpi.')).errors
    expect(cyrillicInPolish.some((e) => e.startsWith(`${L1} [pl-PL]: letters outside Latin`))).toBe(true)
    const hanInKorean = validateSentences(withText(L1, 'ko-KR', '아이들은 벌써 잠들었지만 犬는 아직 깨어 있어요.')).errors
    expect(hanInKorean.some((e) => e.startsWith(`${L1} [ko-KR]: letters outside Hangul`))).toBe(true)
  })

  it('copy-pasted English', () => {
    const english = SENTENCES[0]?.english ?? ''
    const errors = validateSentences(withText(L1, 'nl-NL', english)).errors
    expect(errors).toContain(`${L1} [nl-NL]: equals the English gloss`)
  })

  it('a duplicate text within one language', () => {
    const other = SENTENCES[1]?.text['fi-FI'] ?? ''
    const errors = validateSentences(withText(L1, 'fi-FI', other)).errors
    expect(errors.some((e) => e.startsWith('[fi-FI]:') && e.includes('same text'))).toBe(true)
  })

  it('blocklisted internationalisms in any script', () => {
    expect(blockedTerms('Ich trinke einen Kaffee.')).toContain('kaffee')
    expect(blockedTerms("Siamo arrivati all'hotel.")).toContain('hotel*')
    expect(blockedTerms('Hej, hur mår du?')).toContain('hej')
    expect(blockedTerms('أريد القهوة')).toContain('قهوة')
    expect(blockedTerms('我想喝咖啡')).toContain('咖啡')
    expect(blockedTerms('커피를 마셨어요')).toContain('커피')
    expect(blockedTerms('Он смотрит телевизор.')).toContain('телевиз*')
    // Whole-word matching: "ok" inside another word is not a hit.
    expect(blockedTerms('Kokeen jälkeen')).toEqual([])
    const errors = validateSentences(withText(L1, 'es-ES', 'Los niños duermen, pero el perro toma café.')).errors
    expect(errors.some((e) => e.startsWith(`${L1} [es-ES]: blocklisted`))).toBe(true)
  })

  it('a text outside its length band', () => {
    const errors = validateSentences(withText(L1, 'de-DE', 'Kinder schlafen.')).errors
    expect(errors.some((e) => e.startsWith(`${L1} [de-DE]:`) && e.includes('band is 6–10'))).toBe(true)
  })

  it('levels whose lengths do not increase', () => {
    const short = ['Il cane dorme.', 'Il gatto mangia.', 'La nonna canta.']
    const broken = SENTENCES.map((s) =>
      s.level === 3 ? { ...s, text: { ...s.text, 'it-IT': short.pop() ?? '' } } : s,
    )
    const errors = validateSentences(broken).errors
    expect(errors.some((e) => e.startsWith('[it-IT]: mean words per level not increasing'))).toBe(true)
  })
})

describe('countWords', () => {
  it('counts spaced scripts by whitespace and unspaced ones by segmentation', () => {
    expect(countWords('en-US', 'The children are asleep, but the dog is still awake.')).toBe(10)
    expect(countWords('zh-CN', '孩子们已经睡了')).toBeGreaterThan(1)
    // Single-hiragana particles (は, が) are not counted as words in Japanese.
    expect(countWords('ja-JP', '犬は寝た')).toBeLessThan(
      [...new Intl.Segmenter('ja', { granularity: 'word' }).segment('犬は寝た')].filter((s) => s.isWordLike).length,
    )
  })
})
