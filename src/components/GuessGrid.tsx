import type { Options } from '../engine/game.ts'

interface Props {
  options: Options
  onPick?: (index: number) => void
  /** When set, the grid is in reveal mode: buttons are disabled and marked. */
  reveal?: { correctIndex: number; pickedIndex: number | null }
}

export function GuessGrid({ options, onPick, reveal }: Props) {
  return (
    <div className="grid" role="group" aria-label="Answer options">
      {options.map((lang, i) => {
        let state = ''
        if (reveal) {
          if (i === reveal.correctIndex) state = 'is-correct'
          else if (i === reveal.pickedIndex) state = 'is-wrong'
          else state = 'is-dim'
        }
        return (
          <button
            key={lang.code}
            type="button"
            className={`option ${state}`}
            data-testid={`option-${i}`}
            disabled={reveal !== undefined}
            onClick={() => onPick?.(i)}
          >
            <span className="option-key" aria-hidden="true">
              {i + 1}
            </span>
            <span className="option-flag" aria-hidden="true">
              {lang.flag}
            </span>
            <span className="option-name">{lang.name}</span>
          </button>
        )
      })}
    </div>
  )
}
