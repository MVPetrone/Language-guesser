import { LIVES, ROUNDS } from '../engine/game.ts'
import { ScorePop } from '../motion/index.ts'

interface Props {
  roundNumber: number
  score: number
  streak: number
  lives: number
}

export function HUD({ roundNumber, score, streak, lives }: Props) {
  return (
    <header className="hud glass" aria-label="Game status">
      <div className="hud__bar">
        <div className="hud__cell">
          <span className="eyebrow">Round</span>
          <span className="hud__value" data-testid="round-counter">
            {roundNumber}
            <span className="hud__of">/{ROUNDS}</span>
          </span>
        </div>
        <div className="hud__cell">
          <span className="eyebrow">Score</span>
          <ScorePop value={score}>
            <span className="hud__value" data-testid="score">
              {score}
            </span>
          </ScorePop>
        </div>
        <div className="hud__cell">
          <span className="eyebrow">Streak</span>
          <span className={`hud__value ${streak > 0 ? 'is-hot' : ''}`}>{streak}</span>
        </div>
        <div className="hud__cell">
          <span className="eyebrow">Lives</span>
          <span className="hud__value hud__lives">
            {Array.from({ length: LIVES }, (_, i) => (
              <span key={i} className={`hud__pip ${i < lives ? '' : 'is-spent'}`} aria-hidden="true" />
            ))}
            <span className="sr-only">
              {lives} of {LIVES} lives
            </span>
          </span>
        </div>
      </div>
    </header>
  )
}
