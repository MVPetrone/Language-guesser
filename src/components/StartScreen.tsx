import { useState } from 'react'
import type { Language } from '../data/languages.ts'
import type { Difficulty } from '../engine/game.ts'
import { DIFFICULTY_TIERS, LIVES, MIN_POOL, ROUNDS, answerTiers, optionCountFor } from '../engine/game.ts'
import { Icon } from './Icon.tsx'

const LEVELS: { id: Difficulty; label: string; hint: string }[] = [
  { id: 'easy', label: 'Easy', hint: 'Big, famous languages · short sentences' },
  { id: 'normal', label: 'Normal', hint: 'Adds the recognisable ones · longer sentences' },
  { id: 'hard', label: 'Hard', hint: 'Includes confusable pairs · rare words' },
  { id: 'expert', label: 'Expert', hint: 'Confusable languages only · 5 choices · no slow-down' },
]

const TIER_DOTS: Record<Difficulty, number> = { easy: 1, normal: 2, hard: 3, expert: 3 }

/** 1–3 lit dots; expert adds the aperture ring around all three. */
function TierGlyph({ level }: { level: Difficulty }) {
  const lit = TIER_DOTS[level]
  return (
    <svg className="level__glyph" viewBox="0 0 34 14" aria-hidden="true" focusable="false">
      {[9, 17, 25].map((cx, i) => (
        <circle key={cx} className={i < lit ? 'is-lit' : ''} cx={cx} cy="7" r="2.6" />
      ))}
      {level === 'expert' && <rect className="level__ring" x="1" y="1" width="32" height="12" rx="6" />}
    </svg>
  )
}

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
    <main className="screen screen--start">
      <div className="ambient-slot" aria-hidden="true" />

      <header className="hero">
        <img
          className="hero__mark"
          src={`${import.meta.env.BASE_URL}brand/mark.svg`}
          alt=""
          aria-hidden="true"
          width="72"
          height="72"
        />
        <h1 className="hero__title">Guess the Language</h1>
        <p className="hero__lede">Hear one sentence. Name the language.</p>
        <p className="eyebrow hero__spec">
          {ROUNDS} rounds · {LIVES} lives · {pool.length} languages
        </p>
      </header>

      <fieldset className="levels">
        <legend className="eyebrow levels__legend">Difficulty</legend>
        <div className="levels__grid">
          {LEVELS.map((level) => (
            <label key={level.id} className={`level ${difficulty === level.id ? 'is-selected' : ''}`}>
              <input
                className="control-input"
                type="radio"
                name="difficulty"
                value={level.id}
                checked={difficulty === level.id}
                onChange={() => setDifficulty(level.id)}
              />
              <span className="level__head">
                <span className="level__label">{level.label}</span>
                <TierGlyph level={level.id} />
              </span>
              <span className="level__hint">{level.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {difficulty === 'expert' && !tooFew && (
        <p className="notice" data-testid="expert-note">
          <span className="notice__tag">Expert pool</span>
          Expert only asks about the {pool.filter((l) => l.tier === 3).length} confusable languages you don’t know. Wrong
          choices come from the same language family wherever it has enough members.
        </p>
      )}
      {tierFallback && (
        <p className="notice" data-testid="tier-fallback">
          <span className="notice__tag">Fallback</span>
          You know all of this level’s usual languages, so it draws from the nearest harder ones instead.
        </p>
      )}

      <div className="start__go">
        {tooFew && (
          <p className="notice notice--warn" id="pool-guard" role="alert" data-testid="pool-guard">
            <span className="notice__tag">Pool too small</span>
            A game needs at least {MIN_POOL} languages you don’t know — only {pool.length} are left. Untick a few in
            “Languages I know”.
          </p>
        )}
        {/* This click is the user gesture that unlocks audio playback. */}
        <button
          type="button"
          className="btn btn--signal btn--xl start__cta"
          onClick={() => onStart(difficulty)}
          disabled={tooFew}
          aria-describedby={tooFew ? 'pool-guard' : undefined}
        >
          <Icon name="play" className="btn__icon" />
          Start listening
        </button>
      </div>

      <footer className="start__foot">
        <div className="start__known">
          <button type="button" className="link" onClick={onEditKnown} data-testid="edit-known">
            Languages I know
          </button>
          <span className="start__pool-note" data-testid="excluded-count">
            {excludedCount === 0
              ? 'Playing all languages.'
              : `${excludedCount} language${excludedCount === 1 ? '' : 's'} you know ${excludedCount === 1 ? 'is' : 'are'} left out.`}
          </span>
        </div>
        <div className="start__telemetry">
          {bestScore !== null && (
            <p className="readout">
              <span className="eyebrow">
                Best<span className="sr-only"> score:</span>
              </span>{' '}
              <span className="readout__value">{bestScore}</span>
            </p>
          )}
          <p className="eyebrow start__keys">
            Sound on
            <span className="touch-only-hide">
              {' · '}
              <kbd>1</kbd>–<kbd>{optionCountFor(difficulty)}</kbd> answer · <kbd>R</kbd> replay
            </span>
            <span className="touch-only">{' · tap the orb to replay'}</span>
          </p>
        </div>
      </footer>
    </main>
  )
}
