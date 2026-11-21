import { useRef, useState } from 'react'
import { LANGUAGES, type LangCode, type Language } from '../data/languages.ts'
import { MIN_POOL } from '../engine/game.ts'
import { Icon } from './Icon.tsx'

type Region =
  | 'Western Europe'
  | 'Northern Europe'
  | 'Central & Eastern Europe'
  | 'Middle East'
  | 'Caucasus & Central Asia'
  | 'South Asia'
  | 'East & Southeast Asia'
  | 'Africa'

const REGIONS: readonly Region[] = [
  'Western Europe',
  'Northern Europe',
  'Central & Eastern Europe',
  'Middle East',
  'Caucasus & Central Asia',
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
  'ca-ES': 'Western Europe',
  'gl-ES': 'Western Europe',
  'ga-IE': 'Western Europe',
  'mt-MT': 'Western Europe',
  'is-IS': 'Northern Europe',
  'et-EE': 'Northern Europe',
  'lv-LV': 'Northern Europe',
  'lt-LT': 'Northern Europe',
  'hr-HR': 'Central & Eastern Europe',
  'bs-BA': 'Central & Eastern Europe',
  'sr-RS': 'Central & Eastern Europe',
  'sl-SI': 'Central & Eastern Europe',
  'mk-MK': 'Central & Eastern Europe',
  'sq-AL': 'Central & Eastern Europe',
  'ka-GE': 'Caucasus & Central Asia',
  'az-AZ': 'Caucasus & Central Asia',
  'kk-KZ': 'Caucasus & Central Asia',
  'uz-UZ': 'Caucasus & Central Asia',
  'mn-MN': 'Caucasus & Central Asia',
  'ps-AF': 'South Asia',
  'ne-NP': 'South Asia',
  'si-LK': 'South Asia',
  'te-IN': 'South Asia',
  'zh-HK': 'East & Southeast Asia',
  'km-KH': 'East & Southeast Asia',
  'lo-LA': 'East & Southeast Asia',
  'my-MM': 'East & Southeast Asia',
  'jv-ID': 'East & Southeast Asia',
  'su-ID': 'East & Southeast Asia',
  'am-ET': 'Africa',
  'so-SO': 'Africa',
  'zu-ZA': 'Africa',
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
  const searchRef = useRef<HTMLInputElement>(null)

  const q = fold(query.trim())
  const matches = (l: Language) => q === '' || fold(l.name).includes(q) || fold(l.nativeName).includes(q)
  const groups = REGIONS.map((region) => ({
    region,
    languages: LANGUAGES.filter((l) => REGION_OF[l.code] === region && matches(l)),
  })).filter((g) => g.languages.length > 0)
  const remaining = LANGUAGES.length - selected.size
  const tooFew = remaining < MIN_POOL

  const toggle = (code: LangCode) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })

  const clearSearch = () => {
    setQuery('')
    searchRef.current?.focus()
  }

  return (
    <main className="screen screen--know" data-testid="know-languages">
      <header className="know__head">
        <div className="know__bar">
          <p className="eyebrow">
            {firstVisit ? 'Before you play · ' : ''}
            {LANGUAGES.length} languages
          </p>
          {onCancel && (
            <button type="button" className="link link--quiet" onClick={onCancel} data-testid="know-cancel">
              Cancel
            </button>
          )}
        </div>
        <h1 className="know__title">Which languages do you know?</h1>
        <p className="know__lede">
          Tick the ones you speak or would recognise instantly. They are left out of the game entirely — never the
          answer, never one of the choices.
        </p>
      </header>

      <div className="search">
        <Icon name="search" className="search__icon" />
        <input
          ref={searchRef}
          type="search"
          className="search__input"
          placeholder="Search, e.g. Polish or Polski"
          aria-label="Search languages"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          data-testid="know-search"
        />
        {query !== '' && (
          <button type="button" className="search__clear" onClick={clearSearch} aria-label="Clear search">
            <Icon name="cross" />
          </button>
        )}
      </div>

      <div className="know__groups">
        {groups.map(({ region, languages }) => (
          <fieldset key={region} className="know-group">
            <legend className="eyebrow know-group__title">
              {region}
              <span className="know-group__count" aria-hidden="true">
                {languages.length}
              </span>
            </legend>
            <div className="know-group__items">
              {languages.map((l) => (
                <label key={l.code} className={`know-item ${selected.has(l.code) ? 'is-selected' : ''}`}>
                  <input
                    className="control-input"
                    type="checkbox"
                    checked={selected.has(l.code)}
                    onChange={() => toggle(l.code)}
                    data-testid={`know-${l.code}`}
                  />
                  <span className="know-item__flag" aria-hidden="true">
                    {l.flag}
                  </span>
                  <span className="know-item__text">
                    <span className="know-item__name">{l.name}</span>
                    <span className="know-item__native" lang={l.code} dir="auto">
                      {l.nativeName}
                    </span>
                  </span>
                  <span className="know-item__check" aria-hidden="true">
                    <Icon name="check" />
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        {groups.length === 0 && (
          <div className="know__empty">
            <p>No language matches “{query}”.</p>
            <button type="button" className="link" onClick={clearSearch}>
              Clear search
            </button>
          </div>
        )}
      </div>

      <footer className="know__footer glass">
        <p className={`know__count ${tooFew ? 'is-warn' : ''}`} role="status" data-testid="know-count">
          <strong className="know__num">{selected.size}</strong> selected · {remaining} left to play
          {tooFew && ` — a game needs at least ${MIN_POOL}`}
        </p>
        <div className="actions">
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onSave([])} data-testid="know-none">
            I don’t know any of these
          </button>
          <button
            type="button"
            className="btn btn--signal btn--sm know__save"
            onClick={() => onSave(LANGUAGES.map((l) => l.code).filter((c) => selected.has(c)))}
            data-testid="know-save"
          >
            Save
          </button>
        </div>
      </footer>
    </main>
  )
}
