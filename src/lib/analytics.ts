/**
 * First-party analytics for the live site only.
 *
 * Design notes:
 *  - No cookies, no third-party scripts, no fingerprinting. Two random ids:
 *    `vid` (localStorage, per browser) and `sid` (sessionStorage, per tab session).
 *  - Honours Do Not Track and Global Privacy Control; when either is set the
 *    module does nothing at all.
 *  - Only fires on lingoguess.com. On GitHub Pages previews it stays inert, so
 *    the static build never 404s against a backend that is not there.
 *  - Batched, sent with keepalive/sendBeacon so unloads still deliver.
 */

type Props = Record<string, string | number | boolean | null>;

const HOSTS = new Set(['lingoguess.com', 'www.lingoguess.com']);
const ENDPOINT = '/admin/api/collect.php';
const MAX_BATCH = 8;
const FLUSH_MS = 1200;

const enabled = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (!HOSTS.has(window.location.hostname)) return false;
  const dnt = navigator.doNotTrack ?? (window as unknown as { doNotTrack?: string }).doNotTrack;
  if (dnt === '1' || dnt === 'yes') return false;
  if ((navigator as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl === true) return false;
  return true;
};

const randomId = (): string => {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
};

const readId = (store: Storage | undefined, key: string): string => {
  try {
    const existing = store?.getItem(key);
    if (existing && /^[a-f0-9]{32}$/.test(existing)) return existing;
    const fresh = randomId();
    store?.setItem(key, fresh);
    return fresh;
  } catch {
    return randomId();
  }
};

let vid = '';
let sid = '';
let queue: { name: string; p: Props }[] = [];
let timer: number | null = null;
let started = false;

const flush = (useBeacon = false): void => {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
  if (queue.length === 0) return;
  const payload = JSON.stringify({
    v: 1,
    vid,
    sid,
    path: window.location.pathname,
    ref: document.referrer || '',
    events: queue,
  });
  queue = [];
  try {
    if (useBeacon && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }));
      return;
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      credentials: 'omit',
      mode: 'same-origin',
    }).catch(() => undefined);
  } catch {
    // Analytics must never affect gameplay.
  }
};

const boot = (): void => {
  if (started) return;
  started = true;
  vid = readId(window.localStorage, 'lg.vid');
  sid = readId(window.sessionStorage, 'lg.sid');
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush(true);
  });
  window.addEventListener('pagehide', () => flush(true));
};

export const track = (name: string, props: Props = {}): void => {
  if (!enabled()) return;
  boot();
  queue.push({ name, p: props });
  if (queue.length >= MAX_BATCH) {
    flush();
    return;
  }
  if (timer === null) {
    timer = window.setTimeout(() => flush(), FLUSH_MS);
  }
};

export const trackPageview = (): void => {
  track('pageview', { path: window.location.pathname });
};
