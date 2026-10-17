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

const HEARD_KEY = 'gtl:heard'
/** Recently heard clip keys kept across games; oldest are dropped first. */
export const HEARD_CAP = 400

/** Clip keys (`code|voice|sentence`) heard in earlier games, oldest first. */
export function loadHeard(): string[] {
  try {
    const raw = window.localStorage.getItem(HEARD_KEY)
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((k): k is string => typeof k === 'string').slice(-HEARD_CAP)
  } catch {
    return []
  }
}

export function saveHeard(keys: readonly string[]): void {
  try {
    window.localStorage.setItem(HEARD_KEY, JSON.stringify(keys.slice(-HEARD_CAP)))
  } catch {
    // Not persisted; the game still avoids repeats within a game.
  }
}

/** `keys` with `key` moved to the newest end, capped at `HEARD_CAP`. */
export function appendHeard(keys: readonly string[], key: string): string[] {
  return [...keys.filter((k) => k !== key), key].slice(-HEARD_CAP)
}

const KNOWN_KEY = 'gtl:known'

/**
 * Codes of the languages the player said they know, or null if they have
 * never been asked (or storage is unavailable, in which case they are asked
 * again on the next visit).
 */
export function loadKnown(): string[] | null {
  try {
    const raw = window.localStorage.getItem(KNOWN_KEY)
    if (raw === null) return null
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : null
  } catch {
    return null
  }
}

export function saveKnown(codes: readonly string[]): void {
  try {
    window.localStorage.setItem(KNOWN_KEY, JSON.stringify(codes))
  } catch {
    // Not persisted; the choice still applies for this session.
  }
}
