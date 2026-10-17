// Checks src/data/voices.ts against the live edge-tts voice list and exits
// non-zero on any mismatch. Run with: node scripts/validate_voices.mts
//
// For each language the expected pick is derived from `--list-voices`: within
// the locale family of the roster's default voice (no-NO → nb-NO), take the
// lowest id (code-unit order) of each gender, female first. If a family only
// has one gender, take its two lowest ids instead and report it.
import { execFile } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { LANGUAGES } from '../src/data/languages.ts'
import { VOICES_BY_LANG } from '../src/data/voices.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EDGE_TTS = join(ROOT, '.venv', 'bin', 'edge-tts')

interface Voice {
  id: string
  gender: string
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
    .map(([id, gender]) => ({ id, gender }))
}

async function main(): Promise<void> {
  const voices = await listVoices()
  const known = new Map(voices.map((v) => [v.id, v]))
  const errors: string[] = []
  const oneGender: string[] = []

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

    const actual = VOICES_BY_LANG[lang.code]
    if (!known.has(lang.voice)) errors.push(`${lang.code}: default voice ${lang.voice} not in --list-voices`)
    for (const id of actual) {
      if (!known.has(id)) errors.push(`${lang.code}: ${id} not in --list-voices`)
      else if (family(id) !== fam) errors.push(`${lang.code}: ${id} is not in locale family ${fam}`)
    }
    if (actual.length !== 2) errors.push(`${lang.code}: ${actual.length} voices, expected 2`)
    if (actual.join() !== expected.join()) {
      errors.push(`${lang.code}: has [${actual.join(', ')}], rule gives [${expected.join(', ')}]`)
    }
    const genders = actual.map((id) => known.get(id)?.gender ?? '?')
    console.log(`${lang.code.padEnd(7)} ${fam.padEnd(6)} pool=${String(pool.length).padStart(2)}  ${actual.map((id, i) => `${i}:${id} (${genders[i]})`).join('  ')}`)
  }

  const total = Object.values(VOICES_BY_LANG).reduce((n, v) => n + v.length, 0)
  console.log(`languages=${LANGUAGES.length} voices=${total} edge-tts voices listed=${voices.length}`)
  console.log(`locales without both genders: ${oneGender.length === 0 ? 'none' : oneGender.join('; ')}`)
  if (errors.length > 0) {
    for (const e of errors) console.error(`FAIL ${e}`)
    process.exitCode = 1
    return
  }
  console.log('all voice checks passed')
}

await main()
