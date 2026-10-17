import { LANGUAGES } from '../data/languages.ts'
import { sentenceById } from '../data/sentences.ts'
import type { RoundResult, RoundSpec } from '../engine/game.ts'
import { useHotkeys } from '../hooks/useHotkeys.ts'
import { GuessGrid } from './GuessGrid.tsx'

interface Props {
  round: RoundSpec
  result: RoundResult
  isFinal: boolean
  onReplay: () => void
  onNext: () => void
}

function verdict(result: RoundResult): { text: string; tone: string } {
  if (result.skipped) return { text: 'Round skipped', tone: 'neutral' }
  if (result.correct) return { text: `Correct! +${result.points}`, tone: 'good' }
  const picked = LANGUAGES.find((l) => l.code === result.guessCode)
  return { text: `Not quite — you picked ${picked?.name ?? 'another language'}`, tone: 'bad' }
}

export function Reveal({ round, result, isFinal, onReplay, onNext }: Props) {
  useHotkeys({ enter: onNext, n: onNext, r: onReplay })

  const { language } = round
  const sentence = sentenceById(round.sentenceId)
  const pickedIndex = round.options.findIndex((l) => l.code === result.guessCode)
  const { text, tone } = verdict(result)

  return (
    <main className="screen reveal">
      <p className={`verdict verdict-${tone}`} role="status" data-testid="verdict">
        {text}
      </p>

      <section className="card" aria-label="Answer">
        <div className="answer">
          <span className="answer-flag" aria-hidden="true">
            {language.flag}
          </span>
          <div>
            <h2 className="answer-name">{language.name}</h2>
            <p className="answer-native" lang={language.code}>
              {language.nativeName} · <span className="muted">{language.family}</span>
            </p>
          </div>
        </div>
        <blockquote className="phrase">
          <p className="phrase-native" lang={language.code} dir="auto">
            “{sentence.text[language.code]}”
          </p>
          <p className="phrase-en">“{sentence.english}”</p>
        </blockquote>
        <p className="fact">💡 {language.fact}</p>
      </section>

      <GuessGrid
        options={round.options}
        reveal={{ correctIndex: round.correctIndex, pickedIndex: pickedIndex === -1 ? null : pickedIndex }}
      />

      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onReplay}>
          🔁 Hear it again
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext} data-testid="next" autoFocus>
          {isFinal ? 'See results' : 'Next round →'}
        </button>
      </div>
    </main>
  )
}
