// Emit one TSV job per missing clip so the shell can run edge-tts in parallel.
// Columns: locale, voiceIndex, voice, sentenceId, base64(text)
// Used by scripts/generate_audio_parallel.sh — the canonical manifest writer is
// still generate_audio.mts (run it afterwards; it skips existing clips).
import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LANGUAGES } from '../src/data/languages.ts'
import { SENTENCES } from '../src/data/sentences.ts'
import { VOICES_BY_LANG } from '../src/data/voices.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = join(ROOT, 'public', 'audio')

const good = (p: string) => existsSync(p) && statSync(p).size > 1024

for (const lang of LANGUAGES) {
  for (const [voiceIndex, voice] of VOICES_BY_LANG[lang.code].entries()) {
    for (const sentence of SENTENCES) {
      const out = join(AUDIO, lang.code, String(voiceIndex), `${sentence.id}.mp3`)
      if (good(out)) continue
      const text = sentence.text[lang.code]
      if (!text) continue
      process.stdout.write(
        [lang.code, String(voiceIndex), voice, sentence.id, Buffer.from(text, 'utf8').toString('base64')].join('\t') + '\n',
      )
    }
  }
}
