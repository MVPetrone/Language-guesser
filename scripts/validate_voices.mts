// Checks src/data/voices.ts against the live edge-tts voice list and exits
// non-zero on any mismatch. Run with: node scripts/validate_voices.mts
//
// Default rule: within the locale family of the roster's default voice
// (no-NO → nb-NO), take the lowest id (code-unit order) of each gender, female
// first. If a family has only one gender, take its two lowest ids and report it.
//
// Two guards exist because the rule alone encodes an accident, not the intent:
//   1. NOVELTY_STYLES — a chosen voice must sound like a natural adult human.
//      The rule's lowest-id female for en-US is `en-US-AnaNeural`, tagged
//      "Cartoon / Cute" (a child voice), which is wrong for a game whose whole
//      point is identifying a language from a voice.
//   2. HAND_PICKED — languages where a specific voice was chosen deliberately
//      instead of by the rule. Each entry must name the reason. An override is
//      still fully validated (locale family, gender, existence).
import { execFile } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { LANGUAGES } from '../src/data/languages.ts'
import { VOICES_BY_LANG } from '../src/data/voices.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EDGE_TTS = join(ROOT, '.venv', 'bin', 'edge-tts')

/** Substrings in a voice's categories that mark it as unusable for this game. */
const NOVELTY_STYLES = ['cartoon', 'cute', 'child', 'kid', 'singing', 'dialect', 'santa', 'granny']

/** Deliberate overrides of the lowest-id rule. The value must match exactly. */
const HAND_PICKED: Record<string, { ids: string[]; reason: string }> = {
  'en-US': {
    ids: ['en-US-JennyNeural', 'en-US-AndrewNeural'],
    reason: 'lowest-id female is en-US-AnaNeural, a "Cartoon/Cute" child voice',
  },
}

interface Voice {
  id: string
  gender: string
  categories: string
}

const byId = (a: Voice, b: Voice) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
const family = (voiceId: string) => voiceId.split('-').slice(0, 2).join('-')

async function listVoices(): Promise<Voice[]> {
  const { stdout } = await promisify(execFile)(EDGE_TTS, ['--list-voices'], { timeout: 60_000 })
  // Table: header row, dashed rule, then "<id> <gender> <categories...>".
  return stdout
    .split('\n')
    .slice(2)
    .map((line) => line.trim().split(/\s+/))
    .filter((cols): cols is [string, string, ...string[]] => cols.length >= 2 && /^[a-z]{2,3}-/.test(cols[0] ?? ''))
    .map(([id, gender, ...rest]) => ({ id, gender, categories: rest.join(' ') }))
}

async function main(): Promise<void> {
  const voices = await listVoices()
  const known = new Map(voices.map((v) => [v.id, v]))
  const errors: string[] = []
  const oneGender: string[] = []
  const overridesUsed: string[] = []

  for (const lang of LANGUAGES) {
    const fam = family(lang.voice)
    const pool = voices.filter((v) => family(v.id) === fam && v.id.startsWith(`${fam}-`)).sort(byId)
    const female = pool.filter((v) => v.gender === 'Female')
    const male = pool.filter((v) => v.gender === 'Male')
    let expected: string[]
    if (female[0] && male[0]) {
      expected = [female[0].id, male[0].id]
    } else {
      expected = pool.slice(0, 2).map((v) => v.id)
      oneGender.push(`${lang.code} (${fam}: ${female.length} female, ${male.length} male)`)
    }

    const override = HAND_PICKED[lang.code]
    const actual = VOICES_BY_LANG[lang.code]

    if (!known.has(lang.voice)) errors.push(`${lang.code}: default voice ${lang.voice} not in --list-voices`)
    for (const id of actual) {
      if (!known.has(id)) errors.push(`${lang.code}: ${id} not in --list-voices`)
      else if (family(id) !== fam) errors.push(`${lang.code}: ${id} is not in locale family ${fam}`)
    }
    if (actual.length !== 2) errors.push(`${lang.code}: ${actual.length} voices, expected 2`)

    // Guard 1: no novelty / child / dialect voices, whatever the rule picked.
    for (const id of actual) {
      const cats = (known.get(id)?.categories ?? '').toLowerCase()
      const hit = NOVELTY_STYLES.find((bad) => cats.includes(bad))
      if (hit) errors.push(`${lang.code}: ${id} has a novelty style (matched "${hit}" in "${cats}")`)
    }

    // Guard 2: an override must be declared and precise; otherwise the rule must hold.
    if (override) {
      if (actual.join() !== override.ids.join()) {
        errors.push(`${lang.code}: HAND_PICKED expects [${override.ids.join(', ')}], file has [${actual.join(', ')}]`)
      } else {
        overridesUsed.push(`${lang.code} (${override.reason})`)
      }
    } else if (actual.join() !== expected.join()) {
      errors.push(`${lang.code}: has [${actual.join(', ')}], rule gives [${expected.join(', ')}]`)
    }

    const genders = actual.map((id) => known.get(id)?.gender ?? '?')
    console.log(`${lang.code.padEnd(7)} ${fam.padEnd(6)} pool=${String(pool.length).padStart(2)}  ${actual.map((id, i) => `${i}:${id} (${genders[i]})`).join('  ')}`)
  }

  const total = Object.values(VOICES_BY_LANG).reduce((n, v) => n + v.length, 0)
  console.log(`languages=${LANGUAGES.length} voices=${total} edge-tts voices listed=${voices.length}`)
  console.log(`locales without both genders: ${oneGender.length === 0 ? 'none' : oneGender.join('; ')}`)
  console.log(`declared overrides: ${overridesUsed.length === 0 ? 'none' : overridesUsed.join('; ')}`)
  if (errors.length > 0) {
    for (const e of errors) console.error(`FAIL ${e}`)
    process.exitCode = 1
    return
  }
  console.log('all voice checks passed')
}

await main()
