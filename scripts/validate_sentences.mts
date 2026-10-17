// Validates src/data/sentences.ts. Exits non-zero on any problem.
// Run with: node scripts/validate_sentences.mts [--table]
//
// Checks: missing languages, wrong script, English leakage, duplicate texts,
// blocklisted internationalisms, length bands, and level integrity.
//
// Length bands. A "word" is a whitespace-separated token containing a letter
// or digit. Japanese, Chinese and Thai are written without spaces, so those
// are segmented with Intl.Segmenter (for Japanese, single-hiragana segments —
// particles and inflection endings — are not counted).
// Raw word counts are not comparable across languages: an Urdu or Thai
// translation of the same sentence has ~1.4× the words of English, a Finnish
// one ~0.75×. So each language gets a verbosity ratio r = (its total words) /
// (English total words) over all sentences, r must lie in VERBOSITY_RANGE, and
// every text's count / r must then sit inside its level's band. The English
// source itself is held to the bands with no normalisation.
import { pathToFileURL } from 'node:url'
import { LANGUAGES, type LangCode } from '../src/data/languages.ts'
import { SENTENCES, type Sentence, type SentenceLevel } from '../src/data/sentences.ts'

export const BANDS: Record<SentenceLevel, readonly [number, number]> = {
  1: [6, 10],
  2: [10, 16],
  3: [14, 22],
}
export const LEVEL_COUNTS: Record<SentenceLevel, number> = { 1: 2, 2: 3, 3: 3 }
export const VERBOSITY_RANGE = [0.6, 1.6] as const

type Script =
  | 'Latin'
  | 'Cyrillic'
  | 'Greek'
  | 'Arabic'
  | 'Hebrew'
  | 'Han'
  | 'Hiragana'
  | 'Katakana'
  | 'Hangul'
  | 'Devanagari'
  | 'Bengali'
  | 'Tamil'
  | 'Thai'

const SCRIPT_RE: Record<Script, RegExp> = {
  Latin: /\p{Script_Extensions=Latin}/u,
  Cyrillic: /\p{Script_Extensions=Cyrillic}/u,
  Greek: /\p{Script_Extensions=Greek}/u,
  Arabic: /\p{Script_Extensions=Arabic}/u,
  Hebrew: /\p{Script_Extensions=Hebrew}/u,
  Han: /\p{Script_Extensions=Han}/u,
  Hiragana: /\p{Script_Extensions=Hiragana}/u,
  Katakana: /\p{Script_Extensions=Katakana}/u,
  Hangul: /\p{Script_Extensions=Hangul}/u,
  Devanagari: /\p{Script_Extensions=Devanagari}/u,
  Bengali: /\p{Script_Extensions=Bengali}/u,
  Tamil: /\p{Script_Extensions=Tamil}/u,
  Thai: /\p{Script_Extensions=Thai}/u,
}

const LATIN: readonly Script[] = ['Latin']
export const EXPECTED_SCRIPTS: Record<LangCode, readonly Script[]> = {
  'ja-JP': ['Hiragana', 'Katakana', 'Han'],
  'zh-CN': ['Han'],
  'zh-TW': ['Han'],
  'ko-KR': ['Hangul'],
  'ar-EG': ['Arabic'],
  'he-IL': ['Hebrew'],
  'fa-IR': ['Arabic'],
  'ur-PK': ['Arabic'],
  'el-GR': ['Greek'],
  'ru-RU': ['Cyrillic'],
  'uk-UA': ['Cyrillic'],
  'bg-BG': ['Cyrillic'],
  'hi-IN': ['Devanagari'],
  'bn-BD': ['Bengali'],
  'ta-IN': ['Tamil'],
  'th-TH': ['Thai'],
  'en-US': LATIN,
  'es-ES': LATIN,
  'fr-FR': LATIN,
  'de-DE': LATIN,
  'it-IT': LATIN,
  'pt-BR': LATIN,
  'nl-NL': LATIN,
  'sv-SE': LATIN,
  'da-DK': LATIN,
  'no-NO': LATIN,
  'fi-FI': LATIN,
  'pl-PL': LATIN,
  'cs-CZ': LATIN,
  'sk-SK': LATIN,
  'hu-HU': LATIN,
  'ro-RO': LATIN,
  'tr-TR': LATIN,
  'vi-VN': LATIN,
  'id-ID': LATIN,
  'ms-MY': LATIN,
  'fil-PH': LATIN,
  'sw-KE': LATIN,
  'af-ZA': LATIN,
  'cy-GB': LATIN,
}

/**
 * Internationalisms that give a language away, with common spellings across
 * the roster's scripts. Latin/Cyrillic/Greek entries match whole words, or
 * word prefixes when they end in `*`. Entries in any other script match as
 * substrings, because those scripts attach particles and articles (القهوة,
 * 커피를) or do not separate words at all.
 */
export const BLOCKLIST: readonly string[] = [
  // coffee
  'coffee', 'café', 'cafe', 'caffè', 'caffe', 'cafea', 'kafe', 'kaffe', 'kaffee', 'koffie', 'coffi',
  'kahve', 'kahvi', 'kávé', 'káva', 'kava', 'kawa', 'kafa', 'kopi', 'kape', 'kahawa',
  'кофе', 'кафе', 'кава', 'καφές', 'καφέ', 'קפה', 'قهوة', 'قهوه', 'کافی', 'कॉफ़ी', 'कॉफी', 'কফি',
  'காபி', 'กาแฟ', 'cà phê', '咖啡', 'コーヒー', '커피',
  // hello
  'hello', 'hallo', 'helo', 'hullo', 'ciao', 'hola', 'hej', 'hei', 'olá', 'allô', 'алло', 'хелло',
  'ハロー', '헬로',
  // taxi
  'taxi', 'taxì', 'taksi', 'такси', 'таксі', 'ταξί', 'טקסי', 'تاكسي', 'تاکسی', 'ٹیکسی', 'टैक्सी',
  'ট্যাক্সি', 'டாக்சி', 'แท็กซี่', 'タクシー', '택시', 'teksi',
  // hotel
  'hotel*', 'hôtel*', 'otel*', 'отел*', 'хотел*', 'готел*', 'هتل', 'ہوٹل', 'होटल', 'হোটেল',
  'ஹோட்டல்', 'โฮเต็ล', 'ホテル', '호텔',
  // internet
  'internet*', 'интернет*', 'інтернет*', 'ίντερνετ', 'אינטרנט', 'إنترنت', 'انترنت', 'اینترنت',
  'انٹرنیٹ', 'इंटरनेट', 'ইন্টারনেট', 'இன்டர்நெட்', 'อินเทอร์เน็ต', 'インターネット', '인터넷',
  // computer
  'computer*', 'computador*', 'komputer*', 'kompyuter*', 'компьютер*', "комп'ютер*", 'компютър*',
  'κομπιούτερ', 'كمبيوتر', 'کامپیوتر', 'کمپیوٹر', 'कंप्यूटर', 'কম্পিউটার', 'கம்ப்யூட்டர்',
  'คอมพิวเตอร์', 'コンピューター', 'コンピュータ', '컴퓨터',
  // telephone
  'telephon*', 'telefon*', 'téléphon*', 'teléfon*', 'telefoon*', 'telèfon*', 'телефон*', 'τηλέφων*',
  'טלפון', 'تليفون', 'تلفن', 'ٹیلیفون', 'टेलीफोन', 'টেলিফোন', 'டெலிபோன்', 'テレフォン', '텔레폰',
  // pizza
  'pizza*', 'pizz*', 'пицц*', 'піц*', 'пица*', 'πίτσα', 'פיצה', 'بيتزا', 'پیتزا', 'پیزا', 'पिज़्ज़ा',
  'पिज्जा', 'পিৎজা', 'পিজা', 'பீட்சா', 'พิซซ่า', '披萨', '比薩', 'ピザ', '피자',
  // OK
  'ok', 'okay', 'okey', 'oké', 'окей', 'окэй', 'οκέι', 'אוקיי', 'أوكي', 'اوکی', 'ओके', 'ওকে', 'ஓகே',
  'โอเค', 'オーケー', '오케이',
  // radio
  'radio*', 'rádio*', 'rádió*', 'радио*', 'радіо*', 'ράδιο*', 'רדיו', 'راديو', 'رادیو', 'ریڈیو',
  'रेडियो', 'রেডিও', 'ரேடியோ', 'เรดิโอ', 'ラジオ', '라디오',
  // television
  'televi*', 'télévi*', 'telewiz*', 'tv', 'телевиз*', 'телевіз*', 'τηλεόρασ*', 'טלוויזיה', 'تلفزيون',
  'تلویزیون', 'ٹیلی ویژن', 'टेलीविज़न', 'टीवी', 'টেলিভিশন', 'டிவி', 'ทีวี', 'テレビ', '텔레비전',
  '电视', '電視',
]

const SPACED_TERM = /^[\p{Script=Latin}\p{Script=Cyrillic}\p{Script=Greek}'’ *]+$/u
const UNSPACED: ReadonlySet<LangCode> = new Set(['ja-JP', 'zh-CN', 'zh-TW', 'th-TH'])

const norm = (s: string) => s.normalize('NFC').toLocaleLowerCase('en')

/** Words in `text`, measured as described in the header comment. */
export function countWords(code: LangCode, text: string): number {
  if (UNSPACED.has(code)) {
    const segments = [...new Intl.Segmenter(code, { granularity: 'word' }).segment(text)]
      .filter((s) => s.isWordLike)
      .map((s) => s.segment)
    return code === 'ja-JP' ? segments.filter((s) => !/^\p{Script=Hiragana}$/u.test(s)).length : segments.length
  }
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length
}

/** Blocklisted terms found in `text`. */
export function blockedTerms(text: string): string[] {
  const t = norm(text)
  const words = t.split(/[^\p{L}\p{M}\p{N}'’]+/u).map((w) => w.replace(/^['’]+|['’]+$/gu, ''))
  // Elided articles (l'hôtel, dell'hotel) hide the word behind an apostrophe.
  const parts = new Set([...words, ...words.flatMap((w) => w.split(/['’]/u))])
  return BLOCKLIST.filter((raw) => {
    const term = norm(raw)
    if (!SPACED_TERM.test(term) || term.includes(' ')) return t.includes(term)
    if (term.endsWith('*')) {
      const stem = term.slice(0, -1)
      return [...parts].some((w) => w.startsWith(stem))
    }
    return parts.has(term)
  })
}

/** Letters in `text` that fall outside the language's expected scripts. */
export function foreignLetters(code: LangCode, text: string): string[] {
  const allowed = EXPECTED_SCRIPTS[code].map((s) => SCRIPT_RE[s])
  const bad = new Set<string>()
  for (const ch of text) {
    if (/\p{L}/u.test(ch) && !allowed.some((re) => re.test(ch))) bad.add(ch)
  }
  return [...bad]
}

const comparable = (s: string) => norm(s).replace(/[^\p{L}\p{N}]+/gu, '')

export interface Report {
  errors: string[]
  /** Per-language verbosity ratio and per-sentence normalised word counts. */
  table: { code: LangCode; ratio: number; counts: number[]; normalised: number[] }[]
}

export function validateSentences(
  sentences: readonly Sentence[],
  codes: readonly LangCode[] = LANGUAGES.map((l) => l.code),
): Report {
  const errors: string[] = []
  const err = (msg: string) => errors.push(msg)

  // Shape: ids, levels, counts per level.
  const ids = new Set<string>()
  for (const s of sentences) {
    if (!/^l[123]-[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id)) err(`${s.id}: id is not a level-prefixed slug`)
    else if (s.id[1] !== String(s.level)) err(`${s.id}: id prefix does not match level ${s.level}`)
    if (ids.has(s.id)) err(`${s.id}: duplicate id`)
    ids.add(s.id)
  }
  for (const level of [1, 2, 3] as const) {
    const n = sentences.filter((s) => s.level === level).length
    if (n !== LEVEL_COUNTS[level]) err(`level ${level}: ${n} sentences, expected ${LEVEL_COUNTS[level]}`)
  }

  for (const s of sentences) {
    const text = s.text as Partial<Record<string, string>>
    const [lo, hi] = BANDS[s.level]
    const enWords = countWords('en-US', s.english)
    if (enWords < lo || enWords > hi) err(`${s.id}: English source has ${enWords} words, band is ${lo}–${hi}`)
    for (const extra of Object.keys(text).filter((c) => !codes.includes(c as LangCode))) {
      err(`${s.id}: unexpected language code ${extra}`)
    }
    for (const code of codes) {
      const t = text[code]
      // 1. Missing language
      if (typeof t !== 'string' || t.trim() === '') {
        err(`${s.id} [${code}]: missing`)
        continue
      }
      // 2. Wrong script
      const foreign = foreignLetters(code, t)
      if (foreign.length > 0) {
        err(`${s.id} [${code}]: letters outside ${EXPECTED_SCRIPTS[code].join('/')}: ${foreign.join(' ')}`)
      }
      if (!/\p{L}/u.test(t)) err(`${s.id} [${code}]: no letters`)
      // 3. English leakage
      if (code !== 'en-US' && comparable(t) === comparable(s.english)) err(`${s.id} [${code}]: equals the English gloss`)
      // 5. Blocklisted internationalisms
      const blocked = blockedTerms(t)
      if (blocked.length > 0) err(`${s.id} [${code}]: blocklisted ${blocked.join(', ')}`)
    }
    const blockedEn = blockedTerms(s.english)
    if (blockedEn.length > 0) err(`${s.id} [english]: blocklisted ${blockedEn.join(', ')}`)
  }

  // 4. Duplicates within one language
  for (const code of codes) {
    const seen = new Map<string, string>()
    for (const s of sentences) {
      const t = s.text[code]
      if (typeof t !== 'string') continue
      const key = comparable(t)
      const prev = seen.get(key)
      if (prev) err(`[${code}]: ${s.id} has the same text as ${prev}`)
      else seen.set(key, s.id)
    }
  }

  // 6. Length bands (normalised per language) and 7. level integrity
  const table: Report['table'] = []
  const enTotal = sentences.reduce((acc, s) => acc + countWords('en-US', s.english), 0)
  const present = (code: LangCode) => sentences.every((s) => typeof s.text[code] === 'string')
  for (const code of codes.filter(present)) {
    const counts = sentences.map((s) => countWords(code, s.text[code]))
    const ratio = counts.reduce((a, b) => a + b, 0) / enTotal
    const normalised = counts.map((c) => c / ratio)
    table.push({ code, ratio, counts, normalised })
    const [rlo, rhi] = VERBOSITY_RANGE
    if (ratio < rlo || ratio > rhi) err(`[${code}]: verbosity ratio ${ratio.toFixed(2)} outside ${rlo}–${rhi}`)
    sentences.forEach((s, i) => {
      const [lo, hi] = BANDS[s.level]
      const n = normalised[i] as number
      if (n < lo || n > hi) {
        err(`${s.id} [${code}]: ${counts[i]} words ÷ ${ratio.toFixed(2)} = ${n.toFixed(1)}, band is ${lo}–${hi}`)
      }
    })
    const mean = (level: SentenceLevel) => {
      const xs = counts.filter((_, i) => sentences[i]?.level === level)
      return xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)
    }
    if (!(mean(1) < mean(2) && mean(2) < mean(3))) {
      err(`[${code}]: mean words per level not increasing (${[1, 2, 3].map((l) => mean(l as SentenceLevel).toFixed(1)).join(' / ')})`)
    }
  }

  return { errors, table }
}

function main(): void {
  const { errors, table } = validateSentences(SENTENCES)
  if (process.argv.includes('--table')) {
    console.log(`code     ratio  ${SENTENCES.map((s) => `L${s.level}`.padEnd(8)).join('')}(raw words → normalised)`)
    for (const row of table) {
      const cells = row.counts.map((c, i) => `${c}→${(row.normalised[i] as number).toFixed(1)}`.padEnd(8))
      console.log(`${row.code.padEnd(8)} ${row.ratio.toFixed(2)}   ${cells.join('')}`)
    }
  }
  const perLevel = ([1, 2, 3] as const).map((l) => `L${l}=${SENTENCES.filter((s) => s.level === l).length}`)
  console.log(`sentences=${SENTENCES.length} (${perLevel.join(' ')}) languages=${LANGUAGES.length} texts=${SENTENCES.length * LANGUAGES.length}`)
  if (errors.length > 0) {
    for (const e of errors) console.error(`FAIL ${e}`)
    console.error(`${errors.length} problem(s)`)
    process.exitCode = 1
    return
  }
  console.log('all sentence checks passed')
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
