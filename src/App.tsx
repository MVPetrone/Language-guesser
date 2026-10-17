import { useEffect, useReducer, useState } from 'react'
import { EndScreen } from './components/EndScreen.tsx'
import { HUD } from './components/HUD.tsx'
import { KnowLanguages } from './components/KnowLanguages.tsx'
import { Reveal } from './components/Reveal.tsx'
import { Round } from './components/Round.tsx'
import { StartScreen } from './components/StartScreen.tsx'
import { LANGUAGES, type LangCode, type Language } from './data/languages.ts'
import {
  SLOW_RATE,
  clipKey,
  guess,
  initialState,
  isOver,
  nextRound,
  type Difficulty,
  type GameState,
} from './engine/game.ts'
import { seedFromString } from './engine/rng.ts'
import { useAudio } from './hooks/useAudio.ts'
import { appendHeard, loadBestScore, loadHeard, loadKnown, saveBestScore, saveHeard, saveKnown } from './storage.ts'

type AppState = { screen: 'start' } | { screen: 'game'; game: GameState }

type Action =
  | { type: 'start'; seed: number; difficulty: Difficulty; pool: readonly Language[]; heard: readonly string[] }
  | { type: 'guess'; index: number | null }
  | { type: 'next' }
  | { type: 'menu' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'start':
      return { screen: 'game', game: initialState(action.seed, action.difficulty, action.pool, action.heard) }
    case 'guess':
      return state.screen === 'game' ? { ...state, game: guess(state.game, action.index) } : state
    case 'next':
      return state.screen === 'game' ? { ...state, game: nextRound(state.game) } : state
    case 'menu':
      return { screen: 'start' }
  }
}

/** `?seed=abc` makes the first game reproducible (handy for tests and sharing). */
function firstSeed(): number | null {
  const param = new URLSearchParams(window.location.search).get('seed')
  return param ? seedFromString(param) : null
}

function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] ?? Date.now() >>> 0
}

const ROSTER = new Set<string>(LANGUAGES.map((l) => l.code))

/** The saved known-languages choice, or null if the player was never asked. */
function initialKnown(): LangCode[] | null {
  const saved = loadKnown()
  return saved === null ? null : saved.filter((c): c is LangCode => ROSTER.has(c))
}

function clipUrl(code: string, voiceIndex: number, sentenceId: string): string {
  return `${import.meta.env.BASE_URL}audio/${code}/${voiceIndex}/${sentenceId}.mp3`
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, { screen: 'start' })
  const [slow, setSlow] = useState(false)
  const [urlSeed, setUrlSeed] = useState(firstSeed)
  const [bestScore, setBestScore] = useState(loadBestScore)
  const [isNewBest, setIsNewBest] = useState(false)
  // Clips heard in earlier games, so replays do not repeat them. Kept in
  // memory too, so it still works for this session if storage is disabled.
  const [heard, setHeard] = useState(loadHeard)
  // Languages the player knows are excluded from every game (answer and
  // distractors). null = not asked yet, so the picker is shown first.
  const [known, setKnown] = useState(initialKnown)
  const [editingKnown, setEditingKnown] = useState(false)
  const pool = LANGUAGES.filter((l) => !known?.includes(l.code))

  const game = state.screen === 'game' ? state.game : null
  const src =
    game && game.phase !== 'over'
      ? clipUrl(game.round.language.code, game.round.voiceIndex, game.round.sentenceId)
      : null
  const audio = useAudio(src)
  const { setRate } = audio

  useEffect(() => {
    setRate(slow ? SLOW_RATE : 1)
  }, [slow, setRate])

  const start = (difficulty: Difficulty) => {
    // A ?seed= game ignores the memory so the seed alone determines it.
    dispatch({
      type: 'start',
      seed: urlSeed ?? randomSeed(),
      difficulty,
      pool,
      heard: urlSeed === null ? heard : [],
    })
    setUrlSeed(null)
  }

  const answer = (index: number | null) => {
    if (game && game.phase === 'round') {
      const { round } = game
      const next = appendHeard(heard, clipKey(round.language.code, round.voiceIndex, round.sentenceId))
      saveHeard(next)
      setHeard(next)
    }
    dispatch({ type: 'guess', index })
  }

  const next = () => {
    // Leaving the final reveal ends the game: record the best score here, in
    // the event handler, so the reducer stays pure.
    if (game && game.phase === 'reveal' && isOver(game)) {
      const isNew = game.score > 0 && game.score > (bestScore ?? 0)
      if (isNew) {
        saveBestScore(game.score)
        setBestScore(game.score)
      }
      setIsNewBest(isNew)
    }
    dispatch({ type: 'next' })
  }

  const saveKnownLanguages = (codes: LangCode[]) => {
    saveKnown(codes)
    setKnown(codes)
    setEditingKnown(false)
  }

  if (!game && (known === null || editingKnown)) {
    return (
      <KnowLanguages
        initial={known ?? []}
        firstVisit={known === null}
        onSave={saveKnownLanguages}
        onCancel={known === null ? undefined : () => setEditingKnown(false)}
      />
    )
  }

  if (!game) {
    return (
      <StartScreen
        bestScore={bestScore}
        pool={pool}
        excludedCount={LANGUAGES.length - pool.length}
        onStart={start}
        onEditKnown={() => setEditingKnown(true)}
      />
    )
  }

  if (game.phase === 'over') {
    return (
      <EndScreen
        game={game}
        bestScore={bestScore}
        isNewBest={isNewBest}
        shareUrl={window.location.origin + import.meta.env.BASE_URL}
        onPlayAgain={() => start(game.difficulty)}
        onMenu={() => dispatch({ type: 'menu' })}
      />
    )
  }

  return (
    <div className="app">
      <HUD roundNumber={game.roundNumber} score={game.score} streak={game.streak} lives={game.lives} />
      {game.phase === 'round' ? (
        <Round
          round={game.round}
          audio={audio}
          slow={slow}
          onToggleSlow={() => setSlow((s) => !s)}
          onGuess={answer}
          onSkip={() => answer(null)}
        />
      ) : (
        game.lastResult && (
          <Reveal
            round={game.round}
            result={game.lastResult}
            isFinal={isOver(game)}
            onReplay={audio.replay}
            onNext={next}
          />
        )
      )}
    </div>
  )
}
