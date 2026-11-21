import { useEffect, useRef, useState, type ReactNode } from 'react'
import { LANGUAGES } from '../data/languages.ts'
import {
  DAILY_DIFFICULTY,
  currentStreak,
  dailyGuess,
  dailyNext,
  dailyShareText,
  dailySkip,
  formatDateKey,
  initialDaily,
  londonDateKey,
  recordDailyResult,
  resultOf,
  type DailyRecord,
  type DailyResult,
  type DailyState,
} from '../engine/daily.ts'
import { LIVES, ROUNDS, SLOW_RATE, allowsSlow, isOver, type RoundResult } from '../engine/game.ts'
import { useAudio } from '../hooks/useAudio.ts'
import { useHotkeys } from '../hooks/useHotkeys.ts'
import { track, trackPageview } from '../lib/analytics.ts'
import { AmbientField, ScreenTransition } from '../motion/index.ts'
import { copyText } from '../share.ts'
import { saveDaily } from '../storage.ts'
import { HUD } from './HUD.tsx'
import { Icon, type IconName } from './Icon.tsx'
import { LanguageCombobox } from './LanguageCombobox.tsx'
import { AnswerPanel } from './Reveal.tsx'
import { ClipPlayer } from './Round.tsx'

interface Props {
  record: DailyRecord | null
  onRecord: (record: DailyRecord) => void
  onPlayNormal: () => void
  onBack: () => void
}

const byCode = new Map(LANGUAGES.map((l) => [l.code, l]))

function clipUrl(code: string, voiceIndex: number, sentenceId: string): string {
  return `${import.meta.env.BASE_URL}audio/${code}/${voiceIndex}/${sentenceId}.mp3`
}

function shareUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}?daily=1`
}

/** The whole Daily Challenge flow: intro → rounds/reveals → results. */
export function DailyChallenge({ record, onRecord, onPlayNormal, onBack }: Props) {
  // Fixed for the visit: a game that crosses midnight still counts for the day it began.
  const [today] = useState(() => londonDateKey())
  const [state, setState] = useState<DailyState | null>(null)
  const [slow, setSlow] = useState(false)
  const game = state?.game ?? null
  const slowActive = allowsSlow(DAILY_DIFFICULTY) && slow

  const src =
    game && game.phase !== 'over' ? clipUrl(game.round.language.code, game.round.voiceIndex, game.round.sentenceId) : null
  const audio = useAudio(src)
  const { setRate } = audio
  useEffect(() => {
    setRate(slowActive ? SLOW_RATE : 1)
  }, [slowActive, setRate])

  useEffect(() => {
    trackPageview('daily')
  }, [])

  const reported = useRef(-1)
  useEffect(() => {
    if (!game || game.phase !== 'reveal' || !game.lastResult || game.lastResult.skipped) return
    if (reported.current === game.roundNumber) return
    reported.current = game.roundNumber
    track('daily_guess', { correct: game.lastResult.correct })
  }, [game])

  const start = () => {
    track('daily_start')
    setState(initialDaily(today))
  }

  const next = () => {
    if (!state) return
    // Leaving the final reveal completes the day: record it here, in the event
    // handler, so the engine stays pure.
    if (state.game.phase === 'reveal' && isOver(state.game)) {
      const result = resultOf(state.game)
      const nextRecord = recordDailyResult(record, today, result)
      saveDaily(nextRecord)
      onRecord(nextRecord)
      track('daily_complete', { score: result.score, correct: result.correct })
    }
    setState(dailyNext(state))
  }

  const screenKey = !game ? 'daily-intro' : `daily-${game.phase}`
  const frame = (screen: ReactNode) => (
    <>
      <AmbientField intensity={0.5} />
      <ScreenTransition screenKey={screenKey}>{screen}</ScreenTransition>
    </>
  )

  const done = record?.results[today]
  const streak = currentStreak(record, today)

  if (!state || state.game.phase === 'over') {
    if (done) {
      return frame(
        <DailyEnd
          date={today}
          result={done}
          streak={streak}
          best={record?.best ?? streak}
          history={state?.game.history}
          typed={state?.typed}
          justFinished={state !== null}
          onPlayNormal={onPlayNormal}
          onBack={onBack}
        />,
      )
    }
    return frame(<DailyIntro date={today} streak={streak} onStart={start} onBack={onBack} />)
  }

  const g = state.game
  return frame(
    <div className="game game--daily">
      <HUD roundNumber={g.roundNumber} score={g.score} streak={g.streak} lives={g.lives} />
      {g.phase === 'round' ? (
        <main className="screen screen--round screen--daily-round">
          <ClipPlayer
            round={g.round}
            audio={audio}
            slow={slowActive}
            allowSlow={allowsSlow(DAILY_DIFFICULTY)}
            onToggleSlow={() => setSlow((s) => !s)}
            onSkip={() => setState(dailySkip(state))}
          />
          {/* Remount per round so the field starts empty. */}
          <LanguageCombobox key={g.roundNumber} onSubmit={(text) => setState(dailyGuess(state, text))} />
        </main>
      ) : (
        g.lastResult && (
          <DailyReveal
            state={state}
            result={g.lastResult}
            isFinal={isOver(g)}
            onReplay={audio.replay}
            onNext={next}
          />
        )
      )}
    </div>,
  )
}

function DailyIntro({
  date,
  streak,
  onStart,
  onBack,
}: {
  date: string
  streak: number
  onStart: () => void
  onBack: () => void
}) {
  return (
    <main className="screen screen--daily" data-testid="daily-intro">
      <header className="daily-head">
        <p className="eyebrow daily-head__date">
          Daily Challenge · <time dateTime={date}>{formatDateKey(date)}</time>
        </p>
        <h1 className="daily-head__title">Type the language</h1>
        <p className="daily-head__lede">
          Same {ROUNDS} clips for everyone today. No options this time — type what you hear and pick from the list.
        </p>
        <p className="eyebrow daily-head__spec">
          {ROUNDS} rounds · {LIVES} lives · famous &amp; recognisable languages
        </p>
      </header>

      <p className="daily-streak" data-testid="daily-streak">
        {streak > 0 ? `🔥 ${streak}-day streak — keep it going` : 'Finish today to start a streak'}
      </p>

      {/* This click is the user gesture that unlocks audio playback. */}
      <button type="button" className="btn btn--signal btn--xl daily__cta" onClick={onStart} data-testid="daily-start" autoFocus>
        <Icon name="play" className="btn__icon" />
        Start today’s challenge
      </button>

      <button type="button" className="link link--quiet daily__back" onClick={onBack}>
        Back to menu
      </button>
    </main>
  )
}

type Tone = 'good' | 'bad' | 'neutral'

function verdict(result: RoundResult, typed: string | null): { text: string; detail: string; tone: Tone; icon: IconName } {
  if (result.skipped) return { text: 'Round skipped', detail: 'No penalty', tone: 'neutral', icon: 'dash' }
  if (result.correct) return { text: 'Correct!', detail: `+${result.points}`, tone: 'good', icon: 'check' }
  return { text: `Not quite — you typed “${typed ?? ''}”`, detail: '−1 life', tone: 'bad', icon: 'cross' }
}

function DailyReveal({
  state,
  result,
  isFinal,
  onReplay,
  onNext,
}: {
  state: DailyState
  result: RoundResult
  isFinal: boolean
  onReplay: () => void
  onNext: () => void
}) {
  useHotkeys({ enter: onNext, n: onNext, r: onReplay })
  const { text, detail, tone, icon } = verdict(result, state.typed.at(-1) ?? null)

  return (
    <main className="screen screen--reveal">
      <p className={`verdict verdict--${tone}`} role="status" data-testid="verdict">
        <Icon name={icon} className="verdict__icon" />
        <span className="verdict__text">{text}</span> <span className="verdict__detail">{detail}</span>
      </p>

      <AnswerPanel round={state.game.round} />

      <div className="actions reveal__actions glass">
        <button type="button" className="btn btn--ghost" onClick={onReplay} aria-keyshortcuts="R">
          <Icon name="replay" className="btn__icon" />
          Hear it again
          <span className="touch-only-hide">
            <kbd className="btn__kbd">R</kbd>
          </span>
        </button>
        <button
          type="button"
          className="btn btn--signal"
          onClick={onNext}
          data-testid="next"
          aria-keyshortcuts="Enter N"
          autoFocus
        >
          {isFinal ? 'See results' : 'Next round'}
          <Icon name="arrow" className="btn__icon" />
        </button>
      </div>
    </main>
  )
}

type CopyState = 'idle' | 'copied' | 'failed'

function DailyEnd({
  date,
  result,
  streak,
  best,
  history,
  typed,
  justFinished,
  onPlayNormal,
  onBack,
}: {
  date: string
  result: DailyResult
  streak: number
  best: number
  history?: readonly RoundResult[]
  typed?: readonly (string | null)[]
  justFinished: boolean
  onPlayNormal: () => void
  onBack: () => void
}) {
  const [copy, setCopy] = useState<CopyState>('idle')
  const text = dailyShareText(date, result, streak, shareUrl())
  const onShare = async () => setCopy((await copyText(text)) ? 'copied' : 'failed')
  const glyphs = [...(result.grid ?? '')]

  return (
    <main className="screen screen--end screen--daily" data-testid="daily-end">
      <header className="result">
        <p className="eyebrow">
          Daily Challenge · <time dateTime={date}>{formatDateKey(date)}</time>
        </p>
        <h1 className="result__title">{justFinished ? 'Daily complete!' : 'Done for today'}</h1>
        <p className="result__score">
          <span className="result__value" data-testid="daily-score">
            {result.score}
          </span>{' '}
          <span className="eyebrow">points</span>
        </p>
        <p className="result__summary" data-testid="daily-correct">
          {result.correct}/{result.total} correct
          {result.correct === result.total ? ' — a perfect ear.' : '.'}
        </p>
        {!justFinished && <p className="daily-head__lede">Come back tomorrow for a new set of clips.</p>}
      </header>

      <dl className="stats">
        <div className="stats__item">
          <dt className="eyebrow">Streak</dt>
          <dd className="stats__value" data-testid="daily-end-streak">
            {streak > 0 ? `🔥 ${streak}` : '0'}
          </dd>
        </div>
        <div className="stats__item">
          <dt className="eyebrow">Best streak</dt>
          <dd className="stats__value">{best}</dd>
        </div>
        <div className="stats__item">
          <dt className="eyebrow">Correct</dt>
          <dd className="stats__value">
            {result.correct}/{result.total}
          </dd>
        </div>
      </dl>

      {glyphs.length > 0 && (
        <ol className="tokens" aria-label={`Round by round: ${result.correct} correct`}>
          {glyphs.map((g, i) => {
            const outcome = g === '🟩' ? 'hit' : g === '⬜' ? 'skip' : 'miss'
            return (
              <li key={i} className={`token token--${outcome}`}>
                {outcome === 'hit' ? '✓' : outcome === 'skip' ? '–' : '✗'}
              </li>
            )
          })}
        </ol>
      )}

      <div className="actions end__actions">
        <button type="button" className="btn btn--ghost" onClick={onShare} data-testid="daily-share">
          <Icon name="share" className="btn__icon" />
          Share
        </button>
        <button type="button" className="btn btn--signal" onClick={onPlayNormal} autoFocus>
          <Icon name="play" className="btn__icon" />
          Play a normal game
        </button>
      </div>
      <p className="end__status" role="status" data-testid="daily-share-status">
        {copy === 'copied' && 'Copied to clipboard!'}
        {copy === 'failed' && 'Couldn’t copy automatically — select the text below.'}
      </p>
      {copy === 'failed' && (
        <textarea
          className="textfield"
          readOnly
          value={text}
          rows={3}
          aria-label="Result to copy"
          onFocus={(e) => e.currentTarget.select()}
        />
      )}

      {history && history.length > 0 && (
        <details className="log">
          <summary className="log__summary">
            <span className="eyebrow">Round by round</span>
            <Icon name="chevron" className="log__chevron" />
          </summary>
          <ol className="log__list">
            {history.map((r, i) => {
              const answer = byCode.get(r.code)
              const outcome = r.correct ? 'hit' : r.skipped ? 'skip' : 'miss'
              return (
                <li key={r.roundNumber} className={`log__row log__row--${outcome}`}>
                  <span className="log__num" aria-hidden="true">
                    {String(r.roundNumber).padStart(2, '0')}
                  </span>
                  <span className="log__answer">
                    {answer?.flag && (
                      <span className="log__flag" aria-hidden="true">
                        {answer.flag}
                      </span>
                    )}
                    {answer?.name}
                  </span>
                  <span className="log__detail">
                    {outcome === 'hit' ? `+${r.points}` : outcome === 'skip' ? 'skipped' : `you typed “${typed?.[i] ?? '?'}”`}
                  </span>
                </li>
              )
            })}
          </ol>
        </details>
      )}

      <button type="button" className="link link--quiet end__menu" onClick={onBack} data-testid="daily-back">
        Back to menu
      </button>
    </main>
  )
}
