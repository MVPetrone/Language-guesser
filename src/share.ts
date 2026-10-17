import { shareGrid, type GameState } from './engine/game.ts'

export function shareText(game: GameState, url: string): string {
  const correct = game.history.filter((r) => r.correct).length
  return [
    `Guess the Language (${game.difficulty}) — ${game.score} pts`,
    `${shareGrid(game.history)} ${correct}/${game.history.length}`,
    url,
  ].join('\n')
}

/**
 * Copies text, preferring the async Clipboard API and falling back to the
 * legacy execCommand path (older browsers, non-secure contexts). Resolves to
 * false when neither works so the caller can show the text for manual copy.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Permission denied or insecure context: try the fallback.
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  } catch {
    return false
  }
}
