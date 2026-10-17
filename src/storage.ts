// localStorage can be disabled, full, or throw on access (Safari private mode,
// sandboxed iframes, blocked cookies). Every call here degrades to "no value".
const BEST_KEY = 'gtl:bestScore'

export function loadBestScore(): number | null {
  try {
    const raw = window.localStorage.getItem(BEST_KEY)
    if (raw === null) return null
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : null
  } catch {
    return null
  }
}

export function saveBestScore(score: number): void {
  try {
    window.localStorage.setItem(BEST_KEY, String(score))
  } catch {
    // Not persisted; the in-memory best for this session still works.
  }
}
