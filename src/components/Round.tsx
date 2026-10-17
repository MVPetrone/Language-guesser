import { sentenceById } from '../data/sentences.ts'
import { SLOW_RATE, type RoundSpec } from '../engine/game.ts'
import type { AudioControls } from '../hooks/useAudio.ts'
import { useHotkeys } from '../hooks/useHotkeys.ts'
import { GuessGrid } from './GuessGrid.tsx'

interface Props {
  round: RoundSpec
  audio: AudioControls
  slow: boolean
  onToggleSlow: () => void
  onGuess: (index: number) => void
  onSkip: () => void
}

const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

/** Last resort when the recorded clip is missing: the player's own OS voice. */
function speakFallback(round: RoundSpec, slow: boolean) {
  const u = new SpeechSynthesisUtterance(sentenceById(round.sentenceId).text[round.language.code])
  u.lang = round.language.code
  u.rate = slow ? SLOW_RATE : 1
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(u)
}

export function Round({ round, audio, slow, onToggleSlow, onGuess, onSkip }: Props) {
  useHotkeys({
    '1': () => onGuess(0),
    '2': () => onGuess(1),
    '3': () => onGuess(2),
    '4': () => onGuess(3),
    r: audio.replay,
  })

  return (
    <main className="screen round">
      <div className="player">
        <button
          type="button"
          className={`play ${audio.isPlaying ? 'is-playing' : ''}`}
          onClick={audio.replay}
          disabled={audio.error !== null}
          aria-label={audio.isPlaying ? 'Playing' : 'Play clip'}
          data-testid="play"
        >
          <span aria-hidden="true">{audio.isPlaying ? '🔊' : '▶'}</span>
        </button>
        <label className="toggle">
          <input type="checkbox" checked={slow} onChange={onToggleSlow} />
          <span>🐢 Slow (0.6×)</span>
        </label>
        {audio.needsTap && <p className="muted">Tap ▶ to hear the clip.</p>}
      </div>

      {audio.error && (
        <div className="alert" role="alert" data-testid="audio-error">
          <p>{audio.error}</p>
          <div className="alert-actions">
            <button type="button" className="btn" onClick={onSkip} data-testid="skip">
              Skip this round
            </button>
            {canSpeak && (
              <button type="button" className="btn btn-ghost" onClick={() => speakFallback(round, slow)}>
                Try device voice (fallback — may sound different)
              </button>
            )}
          </div>
        </div>
      )}

      <p className="prompt">Which language is this?</p>
      <GuessGrid options={round.options} onPick={onGuess} />
    </main>
  )
}
