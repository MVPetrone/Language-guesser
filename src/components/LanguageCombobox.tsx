import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import type { Language } from '../data/languages.ts'
import { normaliseAnswer, suggestLanguages } from '../engine/daily.ts'
import { Icon } from './Icon.tsx'

interface Props {
  onSubmit: (text: string) => void
}

/**
 * Free-text answer with an autocomplete list (ARIA 1.2 combobox pattern).
 * ArrowUp/Down move the highlight, Enter picks the highlighted suggestion
 * (filling the field) or, with nothing highlighted, submits what was typed;
 * Escape closes the list. Picking never submits on its own: the guess is
 * always a deliberate second step.
 */
export function LanguageCombobox({ onSubmit }: Props) {
  const id = useId()
  const listId = `${id}-list`
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const [value, setValue] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const suggestions = useMemo(() => suggestLanguages(value), [value])
  const expanded = open && suggestions.length > 0
  const optionId = (i: number) => `${id}-opt-${i}`

  useEffect(() => {
    if (active < 0) return
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (language: Language) => {
    setValue(language.name)
    setOpen(false)
    setActive(-1)
    inputRef.current?.focus()
  }

  const submit = () => {
    if (normaliseAnswer(value) === '') return
    setOpen(false)
    onSubmit(value)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) setOpen(true)
        setActive((a) => Math.min(a + 1, suggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => Math.max(a - 1, -1))
        break
      case 'Enter': {
        e.preventDefault()
        const highlighted = expanded && active >= 0 ? suggestions[active] : undefined
        if (highlighted) pick(highlighted)
        else submit()
        break
      }
      case 'Escape':
        if (expanded) {
          e.preventDefault()
          setOpen(false)
          setActive(-1)
        }
        break
    }
  }

  return (
    <form
      className="typed"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <label className="eyebrow typed__label" htmlFor={`${id}-input`}>
        Which language is this? Type it
      </label>
      <div className="typed__row">
        <div className="typed__field">
          <Icon name="search" className="typed__icon" />
          <input
            ref={inputRef}
            id={`${id}-input`}
            className="typed__input"
            type="text"
            role="combobox"
            aria-expanded={expanded}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            placeholder="e.g. Spanish, Español, Farsi…"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setOpen(true)
              setActive(-1)
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            autoFocus
            data-testid="daily-input"
          />
          <ul
            ref={listRef}
            id={listId}
            className="typed__list"
            role="listbox"
            aria-label="Matching languages"
            hidden={!expanded}
            data-testid="daily-suggestions"
          >
            {suggestions.map((language, i) => (
              <li
                key={language.code}
                id={optionId(i)}
                data-index={i}
                className={`typed__option ${i === active ? 'is-active' : ''}`}
                role="option"
                aria-selected={i === active}
                // Keep focus in the input so the list does not close before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(language)}
              >
                <span className="typed__flag" aria-hidden="true">
                  {language.flag}
                </span>
                <span className="typed__name">{language.name}</span>
                {language.nativeName !== language.name && (
                  <span className="typed__native" lang={language.code} dir="auto">
                    <span aria-hidden="true">— </span>
                    {language.nativeName}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <button
          type="submit"
          className="btn btn--solid typed__go"
          disabled={normaliseAnswer(value) === ''}
          data-testid="daily-guess"
        >
          Guess
        </button>
      </div>
    </form>
  )
}
