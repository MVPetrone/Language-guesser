import { sentenceById } from '../data/sentences.ts'
import { SLOW_RATE, type RoundSpec } from '../engine/game.ts'
import type { AudioControls } from '../hooks/useAudio.ts'
import { useHotkeys } from '../hooks/useHotkeys.ts'
import { GuessGrid } from './GuessGrid.tsx'
import { Icon } from './Icon.tsx'
import { WaveformLive } from '../motion/index.ts'

interface Props {
  round: RoundSpec
  audio: AudioControls
  slow: boolean
  /** Expert hides the 0.6x toggle; replay at full speed only. */
  allowSlow: boolean
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

/** The orb's frame: the aperture's concentric arcs, broken like an iris. */
function ApertureRings() {
  return (
    <svg className="orb__rings" viewBox="0 0 112 112" fill="none" aria-hidden="true" focusable="false">
      <circle className="orb__ring orb__ring--outer" cx="56" cy="56" r="54" pathLength="100" />
      <circle className="orb__ring orb__ring--inner" cx="56" cy="56" r="47" pathLength="100" />
    </svg>
  )
}

type PlayerProps = Omit<Props, 'onGuess'>

/**
 * The listening half of a round: the orb, its waveform and slow switch, and
 * the autoplay / missing-clip notices. Shared by the normal and daily rounds.
 */
export function ClipPlayer({ round, audio, slow, allowSlow, onToggleSlow, onSkip }: PlayerProps) {
  const caption = audio.error ? 'Clip unavailable' : audio.needsTap ? 'Tap to play' : 'Tap to replay'

  return (
    <>
      <section className="player" aria-label="Clip">
        <button
          type="button"
          className={`orb ${audio.isPlaying ? 'is-playing' : ''}`}
          onClick={audio.replay}
          disabled={audio.error !== null}
          aria-label={audio.isPlaying ? 'Playing' : 'Play clip'}
          aria-keyshortcuts="R"
          data-testid="play"
        >
          <ApertureRings />
          <span className="orb__core" aria-hidden="true">
            <Icon name="play" className="orb__play" />
          </span>
        </button>
        <p className="eyebrow player__caption" aria-hidden="true">
          {caption}
          <span className="touch-only-hide"> · R</span>
          {slow && <span className="player__rate"> · 0.6×</span>}
        </p>
        <div className="player__wave">
          <WaveformLive playing={audio.isPlaying} bars={20} height={40} />
        </div>
        {allowSlow && (
          <label className="switch">
            <input className="control-input" type="checkbox" role="switch" checked={slow} onChange={onToggleSlow} />
            <span className="switch__track" aria-hidden="true">
              <span className="switch__thumb" />
            </span>
            Slow 0.6×
          </label>
        )}
      </section>

      {audio.needsTap && (
        <p className="notice notice--warn">
          <span className="notice__tag">Autoplay blocked</span>
          Tap the play button to hear the clip.
        </p>
      )}

      {audio.error && (
        <div className="notice notice--warn" role="alert" data-testid="audio-error">
          <span className="notice__tag">No signal</span>
          <p>{audio.error}</p>
          <div className="notice__actions">
            <button type="button" className="btn btn--sm" onClick={onSkip} data-testid="skip">
              Skip this round
            </button>
            {canSpeak && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => speakFallback(round, slow)}>
                Try device voice (fallback — may sound different)
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export function Round({ onGuess, ...player }: Props) {
  const { round, audio } = player
  // One hotkey per option; expert shows five.
  const hotkeys: Record<string, () => void> = { r: audio.replay }
  for (let i = 0; i < round.options.length; i++) hotkeys[String(i + 1)] = () => onGuess(i)
  useHotkeys(hotkeys)

  return (
    <main className="screen screen--round">
      <ClipPlayer {...player} />

      <div className="round__answers">
        <h1 className="eyebrow round__prompt">Which language is this?</h1>
        <GuessGrid options={round.options} onPick={onGuess} />
      </div>
    </main>
  )
}
