import { LANGUAGES } from '../data/languages.ts'
import { sentenceById } from '../data/sentences.ts'
import type { RoundResult, RoundSpec } from '../engine/game.ts'
import { useHotkeys } from '../hooks/useHotkeys.ts'
import { GuessGrid } from './GuessGrid.tsx'
import { Icon, type IconName } from './Icon.tsx'

interface Props {
  round: RoundSpec
  result: RoundResult
  isFinal: boolean
  onReplay: () => void
  onNext: () => void
}

type Tone = 'good' | 'bad' | 'neutral'

/** The verdict line, plus its telemetry: points won or what it cost. */
function verdict(result: RoundResult): { text: string; detail: string; tone: Tone; icon: IconName } {
  if (result.skipped) return { text: 'Round skipped', detail: 'No penalty', tone: 'neutral', icon: 'dash' }
  if (result.correct) return { text: 'Correct!', detail: `+${result.points}`, tone: 'good', icon: 'check' }
  const picked = LANGUAGES.find((l) => l.code === result.guessCode)
  return {
    text: `Not quite — you picked ${picked?.name ?? 'another language'}`,
    detail: '−1 life',
    tone: 'bad',
    icon: 'cross',
  }
}

export function Reveal({ round, result, isFinal, onReplay, onNext }: Props) {
  useHotkeys({ enter: onNext, n: onNext, r: onReplay })

  const { language } = round
  const sentence = sentenceById(round.sentenceId)
  const pickedIndex = round.options.findIndex((l) => l.code === result.guessCode)
  const { text, detail, tone, icon } = verdict(result)

  return (
    <main className="screen screen--reveal">
      <p className={`verdict verdict--${tone}`} role="status" data-testid="verdict">
        <Icon name={icon} className="verdict__icon" />
        <span className="verdict__text">{text}</span> <span className="verdict__detail">{detail}</span>
      </p>

      <section className="answer panel" aria-label="Answer">
        <div className="answer__head">
          <h2 className="answer__native" lang={language.code} dir="auto">
            {language.nativeName}
          </h2>
          <p className="eyebrow answer__meta">
            {language.flag && (
              <span className="answer__flag" aria-hidden="true">
                {language.flag}
              </span>
            )}
            <span>{language.name}</span>
            <span aria-hidden="true">·</span>
            <span>{language.family}</span>
          </p>
        </div>

        <blockquote className="phrase">
          <p className="eyebrow">Transcript</p>
          <p className="phrase__native" lang={language.code} dir="auto">
            {sentence.text[language.code]}
          </p>
          <p className="phrase__gloss">{sentence.english}</p>
        </blockquote>

        <p className="fact">
          <Icon name="aperture" className="fact__icon" />
          <span>{language.fact}</span>
        </p>
      </section>

      <GuessGrid
        options={round.options}
        reveal={{ correctIndex: round.correctIndex, pickedIndex: pickedIndex === -1 ? null : pickedIndex }}
      />

      <div className="actions reveal__actions glass">
        <button type="button" className="btn btn--ghost" onClick={onReplay} aria-keyshortcuts="R">
          <Icon name="replay" className="btn__icon" />
          Hear it again
          <span className="touch-only-hide">
            <kbd className="btn__kbd">R</kbd>
          </span>
        </button>
        <button
          type="button"
          className="btn btn--signal"
          onClick={onNext}
          data-testid="next"
          aria-keyshortcuts="Enter N"
          autoFocus
        >
          {isFinal ? 'See results' : 'Next round'}
          <Icon name="arrow" className="btn__icon" />
        </button>
      </div>
    </main>
  )
}
