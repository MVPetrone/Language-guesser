// Pre-generates every language × phrase clip with edge-tts and writes a
// deterministic manifest. Run with: node scripts/generate_audio.mts
//
// Idempotent: clips that already exist (and are > 1 KB) are skipped, so a
// re-run only fills gaps and rewrites the manifest.
import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { LANGUAGES } from '../src/data/languages.ts'
import { PHRASES } from '../src/data/phrases.ts'

const run = promisify(execFile)

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const EDGE_TTS = join(ROOT, '.venv', 'bin', 'edge-tts')
const AUDIO_DIR = join(ROOT, 'public', 'audio')
const MIN_BYTES = 1024
const RETRIES = 3
const DELAY_MS = 400

interface ManifestEntry {
  locale: string
  phraseId: string
  bytes: number
  sha256: string
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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

async function main(): Promise<void> {
  const failed = new Set<string>()
  let generated = 0
  let skipped = 0

  for (const lang of LANGUAGES) {
    for (const phrase of PHRASES) {
      const out = join(AUDIO_DIR, lang.code, `${phrase.id}.mp3`)
      if (await isGood(out)) {
        skipped++
        continue
      }
      await mkdir(dirname(out), { recursive: true })
      console.log(`${lang.code}/${phrase.id} (${lang.voice})`)
      try {
        await synth(lang.voice, phrase.text[lang.code], out)
        generated++
      } catch (err) {
        console.error(`  FAILED ${lang.code}/${phrase.id}: ${String(err)}`)
        failed.add(lang.code)
      }
      await sleep(DELAY_MS)
    }
  }

  const entries: ManifestEntry[] = []
  for (const lang of LANGUAGES) {
    if (failed.has(lang.code)) continue
    for (const phrase of PHRASES) {
      const path = join(AUDIO_DIR, lang.code, `${phrase.id}.mp3`)
      const buf = await readFile(path)
      entries.push({
        locale: lang.code,
        phraseId: phrase.id,
        bytes: buf.byteLength,
        sha256: createHash('sha256').update(buf).digest('hex'),
      })
    }
  }
  entries.sort((a, b) =>
    a.locale === b.locale
      ? a.phraseId.localeCompare(b.phraseId, 'en')
      : a.locale.localeCompare(b.locale, 'en'),
  )
  await writeFile(join(AUDIO_DIR, 'manifest.json'), `${JSON.stringify(entries, null, 2)}\n`)

  console.log(`generated=${generated} skipped=${skipped} manifest=${entries.length}`)
  if (failed.size > 0) {
    console.error(`Languages with failed clips (remove from roster): ${[...failed].join(', ')}`)
    process.exitCode = 1
  }
}

await main()
