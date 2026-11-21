import { useState } from 'react'
import { LANGUAGES } from '../data/languages.ts'
import type { GameState, RoundResult } from '../engine/game.ts'
import { copyText, shareText } from '../share.ts'
import { Flag } from './Flag.tsx'
import { Icon } from './Icon.tsx'

interface Props {
  game: GameState
  bestScore: number | null
  isNewBest: boolean
  shareUrl: string
  onPlayAgain: () => void
  onMenu: () => void
}

type CopyState = 'idle' | 'copied' | 'failed'
type Outcome = 'hit' | 'miss' | 'skip'

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]))

const outcomeOf = (r: RoundResult): Outcome => (r.correct ? 'hit' : r.skipped ? 'skip' : 'miss')

/** Text glyphs, not icons: selecting the token row copies a readable grid. */
const TOKEN_GLYPH: Record<Outcome, string> = { hit: '✓', miss: '✗', skip: '–' }

export function EndScreen({ game, bestScore, isNewBest, shareUrl, onPlayAgain, onMenu }: Props) {
  const [copy, setCopy] = useState<CopyState>('idle')
  const text = shareText(game, shareUrl)
  const correct = game.history.filter((r) => r.correct).length
  const skipped = game.history.filter((r) => r.skipped).length
  const rounds = game.history.length

  const onShare = async () => {
    setCopy((await copyText(text)) ? 'copied' : 'failed')
  }

  return (
    <main className="screen screen--end" data-testid="end-screen">
      <header className="result">
        <h1 className="result__title">{game.lives > 0 ? 'Well played!' : 'Out of lives'}</h1>
        <p className="result__score">
          <span className="result__value" data-testid="final-score">
            {game.score}
          </span>{' '}
          <span className="eyebrow">points</span>
        </p>
        <p className="result__summary">
          You named {correct} of {rounds} language{rounds === 1 ? '' : 's'}
          {correct === rounds && rounds > 0 ? ' — a perfect ear.' : '.'}
        </p>
        <div className="result__badges">
          <span className="badge">{game.difficulty}</span>
          {isNewBest && (
            <span className="badge badge--best" data-testid="new-best">
              <Icon name="aperture" className="badge__icon" />
              New best score
            </span>
          )}
        </div>
      </header>

      <dl className="stats">
        <div className="stats__item">
          <dt className="eyebrow">Best score</dt>
          <dd className="stats__value">{bestScore ?? '—'}</dd>
        </div>
        <div className="stats__item">
          <dt className="eyebrow">Best streak</dt>
          <dd className="stats__value" data-testid="best-streak">
            {game.bestStreak}
          </dd>
        </div>
        <div className="stats__item">
          <dt className="eyebrow">Lives left</dt>
          <dd className="stats__value">{game.lives}</dd>
        </div>
      </dl>

      <ol
        className="tokens"
        data-testid="recap"
        aria-label={`Round by round: ${correct} correct, ${rounds - correct - skipped} wrong, ${skipped} skipped`}
      >
        {game.history.map((r) => (
          <li key={r.roundNumber} className={`token token--${outcomeOf(r)}`}>
            {TOKEN_GLYPH[outcomeOf(r)]}
          </li>
        ))}
      </ol>

      <div className="actions end__actions">
        <button type="button" className="btn btn--ghost" onClick={onShare} data-testid="share">
          <Icon name="share" className="btn__icon" />
          Share result
        </button>
        <button type="button" className="btn btn--signal" onClick={onPlayAgain} autoFocus>
          <Icon name="replay" className="btn__icon" />
          Play again
        </button>
      </div>
      <p className="end__status" role="status" data-testid="share-status">
        {copy === 'copied' && 'Copied to clipboard!'}
        {copy === 'failed' && 'Couldn’t copy automatically — select the text below.'}
      </p>
      {copy === 'failed' && (
        <textarea
          className="textfield"
          readOnly
          value={text}
          rows={3}
          aria-label="Result to copy"
          onFocus={(e) => e.currentTarget.select()}
          data-testid="share-fallback"
        />
      )}

      <details className="log">
        <summary className="log__summary">
          <span className="eyebrow">Round by round</span>
          <Icon name="chevron" className="log__chevron" />
        </summary>
        <ol className="log__list">
          {game.history.map((r) => {
            const answer = byCode.get(r.code)
            const picked = r.guessCode ? byCode.get(r.guessCode) : undefined
            const outcome = outcomeOf(r)
            return (
              <li key={r.roundNumber} className={`log__row log__row--${outcome}`}>
                <span className="log__num" aria-hidden="true">
                  {String(r.roundNumber).padStart(2, '0')}
                </span>
                <span className="log__answer">
                  {answer && (
                    <span className="log__flag" aria-hidden="true">
                      <Flag code={answer.code} />
                    </span>
                  )}
                  {answer?.name}
                </span>
                <span className="log__detail">
                  {outcome === 'hit' ? `+${r.points}` : outcome === 'skip' ? 'skipped' : `you said ${picked?.name ?? '?'}`}
                </span>
              </li>
            )
          })}
        </ol>
      </details>

      <button type="button" className="link link--quiet end__menu" onClick={onMenu}>
        Back to menu
      </button>
    </main>
  )
}
