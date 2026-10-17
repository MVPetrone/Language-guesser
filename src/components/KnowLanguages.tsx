import { useState } from 'react'
import { LANGUAGES, type LangCode, type Language } from '../data/languages.ts'
import { MIN_POOL } from '../engine/game.ts'

type Region =
  | 'Western Europe'
  | 'Northern Europe'
  | 'Central & Eastern Europe'
  | 'Middle East'
  | 'South Asia'
  | 'East & Southeast Asia'
  | 'Africa'

const REGIONS: readonly Region[] = [
  'Western Europe',
  'Northern Europe',
  'Central & Eastern Europe',
  'Middle East',
  'South Asia',
  'East & Southeast Asia',
  'Africa',
]

/** Where each language is mainly spoken; a Record so a new language must be placed. */
const REGION_OF: Record<LangCode, Region> = {
  'en-US': 'Western Europe',
  'es-ES': 'Western Europe',
  'fr-FR': 'Western Europe',
  'de-DE': 'Western Europe',
  'it-IT': 'Western Europe',
  'pt-BR': 'Western Europe',
  'nl-NL': 'Western Europe',
  'cy-GB': 'Western Europe',
  'sv-SE': 'Northern Europe',
  'da-DK': 'Northern Europe',
  'no-NO': 'Northern Europe',
  'fi-FI': 'Northern Europe',
  'pl-PL': 'Central & Eastern Europe',
  'cs-CZ': 'Central & Eastern Europe',
  'sk-SK': 'Central & Eastern Europe',
  'hu-HU': 'Central & Eastern Europe',
  'ro-RO': 'Central & Eastern Europe',
  'bg-BG': 'Central & Eastern Europe',
  'el-GR': 'Central & Eastern Europe',
  'ru-RU': 'Central & Eastern Europe',
  'uk-UA': 'Central & Eastern Europe',
  'tr-TR': 'Middle East',
  'ar-EG': 'Middle East',
  'he-IL': 'Middle East',
  'fa-IR': 'Middle East',
  'hi-IN': 'South Asia',
  'ur-PK': 'South Asia',
  'bn-BD': 'South Asia',
  'ta-IN': 'South Asia',
  'zh-CN': 'East & Southeast Asia',
  'zh-TW': 'East & Southeast Asia',
  'ja-JP': 'East & Southeast Asia',
  'ko-KR': 'East & Southeast Asia',
  'th-TH': 'East & Southeast Asia',
  'vi-VN': 'East & Southeast Asia',
  'id-ID': 'East & Southeast Asia',
  'ms-MY': 'East & Southeast Asia',
  'fil-PH': 'East & Southeast Asia',
  'sw-KE': 'Africa',
  'af-ZA': 'Africa',
}

/** Case- and accent-insensitive form for search ("espanol" finds "Español"). */
const fold = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase()

interface Props {
  initial: readonly LangCode[]
  /** First visit: there is nothing to cancel back to. */
  firstVisit: boolean
  onSave: (codes: LangCode[]) => void
  onCancel?: () => void
}

export function KnowLanguages({ initial, firstVisit, onSave, onCancel }: Props) {
  const [selected, setSelected] = useState<ReadonlySet<LangCode>>(() => new Set(initial))
  const [query, setQuery] = useState('')

  const q = fold(query.trim())
  const matches = (l: Language) => q === '' || fold(l.name).includes(q) || fold(l.nativeName).includes(q)
  const groups = REGIONS.map((region) => ({
    region,
    languages: LANGUAGES.filter((l) => REGION_OF[l.code] === region && matches(l)),
  })).filter((g) => g.languages.length > 0)
  const remaining = LANGUAGES.length - selected.size

  const toggle = (code: LangCode) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })

  return (
    <main className="screen know" data-testid="know-languages">
      {firstVisit && <p className="muted">Before you play</p>}
      <h1 className="know-title">Which languages do you know?</h1>
      <p className="muted">
        Tick the ones you speak or would recognise instantly. They are left out of the game entirely — never the
        answer, never one of the choices.
      </p>

      <input
        type="search"
        className="know-search"
        placeholder="Search, e.g. Polish or Polski"
        aria-label="Search languages"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        data-testid="know-search"
      />

      <div className="know-groups">
        {groups.map(({ region, languages }) => (
          <fieldset key={region} className="know-group">
            <legend>{region}</legend>
            {languages.map((l) => (
              <label key={l.code} className={`know-item ${selected.has(l.code) ? 'is-selected' : ''}`}>
                <input
                  type="checkbox"
                  checked={selected.has(l.code)}
                  onChange={() => toggle(l.code)}
                  data-testid={`know-${l.code}`}
                />
                <span className="know-flag" aria-hidden="true">
                  {l.flag}
                </span>
                <span className="know-name">{l.name}</span>
                <span className="know-native muted" lang={l.code}>
                  {l.nativeName}
                </span>
              </label>
            ))}
          </fieldset>
        ))}
        {groups.length === 0 && <p className="muted">No language matches “{query}”.</p>}
      </div>

      <div className="know-footer">
        <p className={remaining < MIN_POOL ? 'know-warning' : 'muted'} role="status" data-testid="know-count">
          {selected.size} selected · {remaining} left to play
          {remaining < MIN_POOL && ` — a game needs at least ${MIN_POOL}`}
        </p>
        <div className="actions">
          <button type="button" className="btn" onClick={() => onSave([])} data-testid="know-none">
            I don’t know any of these
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onSave(LANGUAGES.map((l) => l.code).filter((c) => selected.has(c)))}
            data-testid="know-save"
          >
            Save
          </button>
        </div>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} data-testid="know-cancel">
            Cancel
          </button>
        )}
      </div>
    </main>
  )
}
