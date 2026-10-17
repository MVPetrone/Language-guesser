import { useState } from 'react'
import type { Language } from '../data/languages.ts'
import type { Difficulty } from '../engine/game.ts'
import { DIFFICULTY_TIERS, LIVES, MIN_POOL, ROUNDS, answerTiers } from '../engine/game.ts'

const LEVELS: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: 'Big, famous languages · short sentences' },
  { id: 'normal', label: 'Normal', hint: 'Adds the recognisable ones · longer sentences' },
  { id: 'hard', label: 'Hard', hint: 'Includes confusable pairs · rare words' },
]

interface Props {
  bestScore: number | null
  /** Languages left after excluding the ones the player knows. */
  pool: readonly Language[]
  excludedCount: number
  onStart: (difficulty: Difficulty) => void
  onEditKnown: () => void
}

export function StartScreen({ bestScore, pool, excludedCount, onStart, onEditKnown }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const tooFew = pool.length < MIN_POOL
  const tierFallback = !tooFew && answerTiers(pool, difficulty) !== DIFFICULTY_TIERS[difficulty]

  return (
    <main className="screen start">
      <h1 className="title">Guess the Language</h1>
      <p className="lede">
        A voice says a sentence. Which language was it? {ROUNDS} rounds, {LIVES} lives.
      </p>

      <fieldset className="levels">
        <legend>Difficulty</legend>
        {LEVELS.map((level) => (
          <label key={level.id} className={`level ${difficulty === level.id ? 'is-selected' : ''}`}>
            <input
              type="radio"
              name="difficulty"
              value={level.id}
              checked={difficulty === level.id}
              onChange={() => setDifficulty(level.id)}
            />
            <span className="level-label">{level.label}</span>
            <span className="level-hint">{level.hint}</span>
          </label>
        ))}
      </fieldset>
      {tierFallback && (
        <p className="fineprint" data-testid="tier-fallback">
          You know all of this level’s usual languages, so it draws from the nearest harder ones instead.
        </p>
      )}

      {/* This click is the user gesture that unlocks audio playback. */}
      <button
        type="button"
        className="btn btn-primary btn-xl"
        onClick={() => onStart(difficulty)}
        disabled={tooFew}
        aria-describedby={tooFew ? 'pool-guard' : undefined}
      >
        ▶ Start
      </button>
      {tooFew && (
        <p className="pool-guard" id="pool-guard" role="alert" data-testid="pool-guard">
          A game needs at least {MIN_POOL} languages you don’t know — only {pool.length} are left. Untick a few in
          “Languages I know”.
        </p>
      )}

      <div className="known">
        <span className="muted" data-testid="excluded-count">
          {excludedCount === 0
            ? 'Playing all languages.'
            : `${excludedCount} language${excludedCount === 1 ? '' : 's'} you know ${excludedCount === 1 ? 'is' : 'are'} left out.`}
        </span>
        <button type="button" className="link" onClick={onEditKnown} data-testid="edit-known">
          Languages I know
        </button>
      </div>

      {bestScore !== null && <p className="muted">Best score: {bestScore}</p>}
      <p className="fineprint">
        Sound on. Keys: <kbd>1</kbd>–<kbd>4</kbd> answer, <kbd>R</kbd> replay.
      </p>
    </main>
  )
}
