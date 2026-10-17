import { useEffect, useReducer, useState } from 'react'
import { EndScreen } from './components/EndScreen.tsx'
import { HUD } from './components/HUD.tsx'
import { Reveal } from './components/Reveal.tsx'
import { Round } from './components/Round.tsx'
import { StartScreen } from './components/StartScreen.tsx'
import { LANGUAGES } from './data/languages.ts'
import { SLOW_RATE, guess, initialState, isOver, nextRound, type Difficulty, type GameState } from './engine/game.ts'
import { seedFromString } from './engine/rng.ts'
import { useAudio } from './hooks/useAudio.ts'
import { loadBestScore, saveBestScore } from './storage.ts'

type AppState = { screen: 'start' } | { screen: 'game'; game: GameState }

type Action =
  | { type: 'start'; seed: number; difficulty: Difficulty }
  | { type: 'guess'; index: number | null }
  | { type: 'next' }
  | { type: 'menu' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'start':
      return { screen: 'game', game: initialState(action.seed, action.difficulty, LANGUAGES) }
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

function clipUrl(code: string, voiceIndex: number, sentenceId: string): string {
  return `${import.meta.env.BASE_URL}audio/${code}/${voiceIndex}/${sentenceId}.mp3`
}

export default function App() {
  const [state, dispatch] = useReducer(reducer, { screen: 'start' })
  const [slow, setSlow] = useState(false)
  const [urlSeed, setUrlSeed] = useState(firstSeed)
  const [bestScore, setBestScore] = useState(loadBestScore)
  const [isNewBest, setIsNewBest] = useState(false)

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
    dispatch({ type: 'start', seed: urlSeed ?? randomSeed(), difficulty })
    setUrlSeed(null)
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

  if (!game) return <StartScreen bestScore={bestScore} onStart={start} />

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
          onGuess={(index) => dispatch({ type: 'guess', index })}
          onSkip={() => dispatch({ type: 'guess', index: null })}
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
