import { useState } from 'react'
import { LANGUAGES } from '../data/languages.ts'
import { shareGrid, type GameState } from '../engine/game.ts'
import { copyText, shareText } from '../share.ts'

interface Props {
  game: GameState
  bestScore: number | null
  isNewBest: boolean
  shareUrl: string
  onPlayAgain: () => void
  onMenu: () => void
}

type CopyState = 'idle' | 'copied' | 'failed'

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]))

export function EndScreen({ game, bestScore, isNewBest, shareUrl, onPlayAgain, onMenu }: Props) {
  const [copy, setCopy] = useState<CopyState>('idle')
  const text = shareText(game, shareUrl)
  const correct = game.history.filter((r) => r.correct).length

  const onShare = async () => {
    setCopy((await copyText(text)) ? 'copied' : 'failed')
  }

  return (
    <main className="screen end" data-testid="end-screen">
      <h1 className="title">{game.lives > 0 ? 'Well played!' : 'Out of lives'}</h1>

      <p className="final-score">
        <span className="final-score-value" data-testid="final-score">
          {game.score}
        </span>
        <span className="muted">points</span>
      </p>
      {isNewBest ? (
        <p className="badge" data-testid="new-best">
          🏆 New best score!
        </p>
      ) : (
        bestScore !== null && <p className="muted">Best: {bestScore}</p>
      )}

      <dl className="stats">
        <div>
          <dt>Correct</dt>
          <dd>
            {correct}/{game.history.length}
          </dd>
        </div>
        <div>
          <dt>Best streak</dt>
          <dd data-testid="best-streak">{game.bestStreak}</dd>
        </div>
        <div>
          <dt>Lives left</dt>
          <dd>{game.lives}</dd>
        </div>
      </dl>

      <p className="share-grid" aria-label="Results grid">
        {shareGrid(game.history)}
      </p>

      <ol className="recap" data-testid="recap">
        {game.history.map((r) => {
          const answer = byCode.get(r.code)
          const picked = r.guessCode ? byCode.get(r.guessCode) : undefined
          return (
            <li key={r.roundNumber} className={r.correct ? 'is-hit' : r.skipped ? 'is-skip' : 'is-miss'}>
              <span className="recap-mark" aria-hidden="true">
                {r.correct ? '✓' : r.skipped ? '–' : '✗'}
              </span>
              <span className="recap-answer">
                {answer?.flag} {answer?.name}
              </span>
              <span className="recap-detail muted">
                {r.correct ? `+${r.points}` : r.skipped ? 'skipped' : `you said ${picked?.name ?? '?'}`}
              </span>
            </li>
          )
        })}
      </ol>

      <div className="actions">
        <button type="button" className="btn" onClick={onShare} data-testid="share">
          📋 Copy result
        </button>
        <button type="button" className="btn btn-primary" onClick={onPlayAgain} autoFocus>
          Play again
        </button>
      </div>
      <p className="muted" role="status" data-testid="share-status">
        {copy === 'copied' && 'Copied to clipboard!'}
        {copy === 'failed' && 'Couldn’t copy automatically — select the text below.'}
      </p>
      {copy === 'failed' && (
        <textarea
          className="share-fallback"
          readOnly
          value={text}
          rows={3}
          onFocus={(e) => e.currentTarget.select()}
          data-testid="share-fallback"
        />
      )}

      <button type="button" className="btn btn-ghost" onClick={onMenu}>
        Change difficulty
      </button>
    </main>
  )
}
