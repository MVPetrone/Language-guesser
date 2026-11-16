import type { Options } from '../engine/game.ts'
import { Icon } from './Icon.tsx'

interface Props {
  options: Options
  onPick?: (index: number) => void
  /** When set, the grid is in reveal mode: buttons are disabled and marked. */
  reveal?: { correctIndex: number; pickedIndex: number | null }
}

export function GuessGrid({ options, onPick, reveal }: Props) {
  return (
    <div className="options" role="group" aria-label="Answer options">
      {options.map((lang, i) => {
        let state = ''
        let note = ''
        let mark: 'chevron' | 'check' | 'cross' | null = 'chevron'
        if (reveal) {
          if (i === reveal.correctIndex) {
            state = 'is-correct'
            note = i === reveal.pickedIndex ? ', correct — your answer' : ', correct answer'
            mark = 'check'
          } else if (i === reveal.pickedIndex) {
            state = 'is-wrong'
            note = ', your answer'
            mark = 'cross'
          } else {
            state = 'is-dim'
            mark = null
          }
        }
        return (
          <button
            key={lang.code}
            type="button"
            className={`option ${state}`}
            data-testid={`option-${i}`}
            disabled={reveal !== undefined}
            aria-keyshortcuts={reveal ? undefined : String(i + 1)}
            onClick={() => onPick?.(i)}
          >
            <span className="option__key" aria-hidden="true">
              {i + 1}
            </span>
            {/* `option-name` is a hook read by tests/e2e — style via option__name. */}
            <span className="option__name option-name">{lang.name}</span>
            {mark ? <Icon name={mark} className="option__mark" /> : <span aria-hidden="true" />}
            {note && <span className="sr-only">{note}</span>}
          </button>
        )
      })}
    </div>
  )
}
