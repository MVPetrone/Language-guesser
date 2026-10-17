// Pre-generates every language × voice × sentence clip with edge-tts and
// writes a deterministic manifest. Run with: node scripts/generate_audio.mts
//
// Layout: public/audio/<locale>/<voiceIndex>/<sentenceId>.mp3, where
// voiceIndex indexes VOICES_BY_LANG[locale].
//
// Idempotent: clips that already exist (and are > 1 KB) are skipped, so a
// re-run only fills gaps and rewrites the manifest. Any other .mp3 under
// public/audio (e.g. clips from an older layout) is reported and fails the run.
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { LANGUAGES } from '../src/data/languages.ts'
import { SENTENCES } from '../src/data/sentences.ts'
import { VOICES_BY_LANG } from '../src/data/voices.ts'

const run = promisify(execFile)

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EDGE_TTS = join(ROOT, '.venv', 'bin', 'edge-tts')
const AUDIO_DIR = join(ROOT, 'public', 'audio')
const MIN_BYTES = 1024
const RETRIES = 3
const DELAY_MS = 500

interface ManifestEntry {
  locale: string
  voiceIndex: number
  voice: string
  sentenceId: string
  bytes: number
  sha256: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Plain code-unit order, so the manifest is identical on every machine. */
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

const clipPath = (locale: string, voiceIndex: number, sentenceId: string) =>
  join(AUDIO_DIR, locale, String(voiceIndex), `${sentenceId}.mp3`)

async function isGood(path: string): Promise<boolean> {
  if (!existsSync(path)) return false
  return (await stat(path)).size > MIN_BYTES
}

async function synth(voice: string, text: string, out: string): Promise<void> {
  const tmp = `${out}.part`
  let lastError: unknown
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      // execFile, not a shell: the text is passed verbatim, no quoting issues.
      await run(EDGE_TTS, ['--voice', voice, '--text', text, '--write-media', tmp], {
        timeout: 60_000,
      })
      if (!(await isGood(tmp))) throw new Error('output missing or < 1 KB')
      await rename(tmp, out)
      return
    } catch (err) {
      lastError = err
      await rm(tmp, { force: true })
      if (attempt < RETRIES) {
        const backoff = 1000 * 2 ** (attempt - 1)
        console.warn(`  retry ${attempt}/${RETRIES - 1} in ${backoff}ms: ${String(err)}`)
        await sleep(backoff)
      }
    }
  }
  throw lastError
}

async function listMp3(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await listMp3(path)))
    else if (entry.name.endsWith('.mp3')) out.push(path)
  }
  return out
}

async function main(): Promise<void> {
  /** `${locale}/${voiceIndex}` of every voice with at least one failed clip. */
  const failedVoices = new Map<string, string[]>()
  const total = LANGUAGES.reduce((n, l) => n + VOICES_BY_LANG[l.code].length * SENTENCES.length, 0)
  let done = 0
  let generated = 0
  let skipped = 0

  for (const lang of LANGUAGES) {
    for (const [voiceIndex, voice] of VOICES_BY_LANG[lang.code].entries()) {
      for (const sentence of SENTENCES) {
        done++
        const out = clipPath(lang.code, voiceIndex, sentence.id)
        if (await isGood(out)) {
          skipped++
          continue
        }
        await mkdir(dirname(out), { recursive: true })
        console.log(`[${done}/${total}] ${lang.code}/${voiceIndex}/${sentence.id} (${voice})`)
        try {
          await synth(voice, sentence.text[lang.code], out)
          generated++
        } catch (err) {
          console.error(`  FAILED ${lang.code}/${voiceIndex}/${sentence.id}: ${String(err)}`)
          const key = `${lang.code}/${voiceIndex}`
          failedVoices.set(key, [...(failedVoices.get(key) ?? []), sentence.id])
        }
        await sleep(DELAY_MS)
      }
    }
  }

  // A voice with any failed clip is left out of the manifest entirely, so the
  // game can drop that voice for the locale and keep the other one.
  const expected = new Set<string>()
  const entries: ManifestEntry[] = []
  for (const lang of LANGUAGES) {
    for (const [voiceIndex, voice] of VOICES_BY_LANG[lang.code].entries()) {
      for (const sentence of SENTENCES) expected.add(clipPath(lang.code, voiceIndex, sentence.id))
      if (failedVoices.has(`${lang.code}/${voiceIndex}`)) continue
      for (const sentence of SENTENCES) {
        const buf = await readFile(clipPath(lang.code, voiceIndex, sentence.id))
        entries.push({
          locale: lang.code,
          voiceIndex,
          voice,
          sentenceId: sentence.id,
          bytes: buf.byteLength,
          sha256: createHash('sha256').update(buf).digest('hex'),
        })
      }
    }
  }
  entries.sort(
    (a, b) => cmp(a.locale, b.locale) || a.voiceIndex - b.voiceIndex || cmp(a.sentenceId, b.sentenceId),
  )
  await writeFile(join(AUDIO_DIR, 'manifest.json'), `${JSON.stringify(entries, null, 2)}\n`)

  const strays = (await listMp3(AUDIO_DIR)).filter((p) => !expected.has(p))
  console.log(`generated=${generated} skipped=${skipped} manifest=${entries.length} expected=${total}`)
  if (strays.length > 0) {
    console.error(`Stray clips not in the current pool (delete them): ${strays.map((p) => relative(AUDIO_DIR, p)).join(', ')}`)
    process.exitCode = 1
  }
  if (failedVoices.size > 0) {
    for (const [key, ids] of failedVoices) console.error(`Voice ${key} failed (drop it): ${ids.join(', ')}`)
    process.exitCode = 1
  }
}

await main()
