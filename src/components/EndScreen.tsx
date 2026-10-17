import type { GameState } from '../engine/game.ts'

interface Props {
  game: GameState
  onPlayAgain: () => void
  onMenu: () => void
}

export function EndScreen({ game, onPlayAgain, onMenu }: Props) {
  const correct = game.history.filter((r) => r.correct).length

  return (
    <main className="screen end" data-testid="end-screen">
      <h1 className="title">{game.lives > 0 ? 'Well played!' : 'Out of lives'}</h1>
      <p className="final-score">
        <span className="final-score-value" data-testid="final-score">
          {game.score}
        </span>
        <span className="muted">points</span>
      </p>
      <p className="muted">
        {correct} of {game.history.length} correct
      </p>
      <div className="actions">
        <button type="button" className="btn btn-ghost" onClick={onMenu}>
          Change difficulty
        </button>
        <button type="button" className="btn btn-primary" onClick={onPlayAgain} autoFocus>
          Play again
        </button>
      </div>
    </main>
  )
}
