// Emit jobs for clips whose voice changed (force-regenerate) plus any missing clip.
// Usage: node scripts/audio_jobs_force.mts th-TH el-GR da-DK
import { existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LANGUAGES } from '../src/data/languages.ts'
import { SENTENCES } from '../src/data/sentences.ts'
import { VOICES_BY_LANG } from '../src/data/voices.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const AUDIO = join(ROOT, 'public', 'audio')
const force = new Set(process.argv.slice(2))
const good = (p: string) => existsSync(p) && statSync(p).size > 1024

for (const lang of LANGUAGES) {
  for (const [voiceIndex, voice] of VOICES_BY_LANG[lang.code].entries()) {
    for (const sentence of SENTENCES) {
      const out = join(AUDIO, lang.code, String(voiceIndex), `${sentence.id}.mp3`)
      if (good(out) && !(force.has(lang.code) && voiceIndex === 0)) continue
      const text = sentence.text[lang.code]
      if (!text) continue
      process.stdout.write(
        [lang.code, String(voiceIndex), voice, sentence.id, Buffer.from(text, 'utf8').toString('base64')].join('\t') + '\n',
      )
    }
  }
}
