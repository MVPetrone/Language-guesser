import { LIVES, ROUNDS } from '../engine/game.ts'

interface Props {
  roundNumber: number
  score: number
  streak: number
  lives: number
}

export function HUD({ roundNumber, score, streak, lives }: Props) {
  return (
    <header className="hud" aria-label="Game status">
      <div className="hud-item">
        <span className="hud-label">Round</span>
        <span className="hud-value" data-testid="round-counter">
          {roundNumber}/{ROUNDS}
        </span>
      </div>
      <div className="hud-item">
        <span className="hud-label">Score</span>
        <span className="hud-value" data-testid="score">
          {score}
        </span>
      </div>
      <div className="hud-item">
        <span className="hud-label">Streak</span>
        <span className="hud-value">{streak > 0 ? `🔥${streak}` : '0'}</span>
      </div>
      <div className="hud-item">
        <span className="hud-label">Lives</span>
        <span className="hud-value" aria-label={`${lives} of ${LIVES} lives`}>
          {'♥'.repeat(lives)}
          <span className="lost">{'♥'.repeat(LIVES - lives)}</span>
        </span>
      </div>
    </header>
  )
}
