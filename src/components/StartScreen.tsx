import { useState } from 'react'
import type { Difficulty } from '../engine/game.ts'
import { LIVES, ROUNDS } from '../engine/game.ts'

const LEVELS: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: 'Big, famous languages' },
  { id: 'normal', label: 'Normal', hint: 'Adds the recognisable ones' },
  { id: 'hard', label: 'Hard', hint: 'Includes confusable pairs' },
]

interface Props {
  bestScore: number | null
  onStart: (difficulty: Difficulty) => void
}

export function StartScreen({ bestScore, onStart }: Props) {
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')

  return (
    <main className="screen start">
      <h1 className="title">Guess the Language</h1>
      <p className="lede">
        A voice says a short everyday phrase. Which language was it? {ROUNDS} rounds, {LIVES} lives.
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

      {/* This click is the user gesture that unlocks audio playback. */}
      <button type="button" className="btn btn-primary btn-xl" onClick={() => onStart(difficulty)}>
        ▶ Start
      </button>

      {bestScore !== null && <p className="muted">Best score: {bestScore}</p>}
      <p className="fineprint">
        Sound on. Keys: <kbd>1</kbd>–<kbd>4</kbd> answer, <kbd>R</kbd> replay.
      </p>
    </main>
  )
}
