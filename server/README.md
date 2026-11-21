# Lingo Guess Admin / CRM

A small PHP 8 + SQLite admin application that lives at `/admin` on
lingoguess.com, plus a first-party analytics collector that the game posts to.

Phase 1 (this) is the traffic dashboard. The CRM entities (contacts, pipeline)
are scaffolded in the nav and land next.

## Layout

```
server/admin/
  index.php        login page (or redirect to the dashboard)
  login.php        POST handler: CSRF + throttle + password_verify
  logout.php       POST + CSRF
  dashboard.php    traffic dashboard shell
  activity.php     paginated event log
  setup.php        one-time installer, dead once installed (410)
  api/collect.php  public beacon endpoint (the only unauthenticated route)
  api/stats.php    aggregated metrics   (auth)
  api/feed.php     live activity feed   (auth)
  api/events.php   filtered event log   (auth)
  lib/bootstrap.php  paths, config, error handling, security headers
  lib/util.php       escaping, IP hashing, UA parsing, validation
  lib/db.php         PDO/SQLite, schema, rate limiter, audit
  lib/auth.php       sessions, CSRF, login throttle
  assets/            CSS + dependency-free JS (charts are hand-drawn SVG)
```

Deploys with `scripts/deploy-lingoguess.sh` (builds the SPA, copies `server/admin`
into `dist-web/admin`, commits the `deploy/lingoguess` branch, optionally triggers
the Hostinger Git deploy with `--ship`).

## Data

`storage/` sits **outside** the webroot (`domains/lingoguess.com/storage`), mode
`0700`, and holds:

| File | Purpose |
|---|---|
| `crm.sqlite` | events, users, login attempts, rate limits, audit (WAL mode) |
| `config.php` | app secret (HMAC key for IP hashes) — never in git |
| `sessions/` | PHP session files |
| `logs/php.log` | error log (display_errors is off) |

Nothing in `storage/` is reachable over HTTP: it is a sibling of `public_html`,
and `admin/.htaccess` additionally denies `lib/` and non-PHP extensions.

## Security model

- **Auth**: bcrypt cost 12, 14-character minimum, dictionary/repeat checks.
  Unknown usernames still run a `password_verify` so timing does not disclose
  whether an account exists.
- **Sessions**: `HttpOnly` + `Secure` + `SameSite=Strict`, id regenerated on
  login, 30 min idle / 12 h absolute expiry, custom `0700` session directory,
  `use_strict_mode` on.
- **CSRF**: per-session token, `hash_equals` comparison, required on every
  state-changing route (login, logout, future mutations).
- **Brute force**: 5 failures per IP per 15 min → `?e=locked`; installer 5/hour.
- **SQL**: PDO with `ATTR_EMULATE_PREPARES = false`; every value bound; the
  event-name filter is a hard allow-list.
- **XSS**: `h()` / `textContent` only, JSON hex-escaped (`JSON_HEX_TAG`), strict
  CSP with **no** `unsafe-inline` (this is why charts use SVG geometry instead of
  `style.width`).
- **Headers**: CSP, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy:
  no-referrer`, COOP/CORP, HSTS, `no-store`, `X-Robots-Tag: noindex`.
- **Collector**: POST only, first-party `Origin`/`Referer` required, 8 KB body
  cap, 12 events per batch, 120 events/min/IP, enum allow-list per event, bots
  dropped, no raw IPs stored (HMAC-SHA256 with the app secret).
- **Installer**: gated by the SHA-256 digest of a 48-character token (only the
  digest is committed), returns 410 once `config.php` exists.
- **Privacy**: no cookies, no third-party scripts, honours Do Not Track and
  Global Privacy Control, referrers reduced to hostnames, UA reduced to
  device/OS/browser buckets, events pruned after 400 days.

## Operating it

```bash
# install (once) — token lives in /root/.lingo-token-only on the ops box
ADMIN_PASS_FILE=/root/.lingo-admin-pass python3 install_admin.py https://lingoguess.com

# deploy
./scripts/deploy-lingoguess.sh --ship

# security + behaviour suite (local PHP server or live)
ADMIN_PASS_FILE=/root/.lingo-admin-pass \
  python3 tests/security/test_admin.py https://lingoguess.com

# local dev
cp -a dist-web/. /tmp/site/ && php -S 127.0.0.1:8099 -t /tmp/site
```

Local runs are needed for the injection tests: Hostinger's edge WAF blocks
SQL-injection-looking query strings with a 403 before PHP sees them, so the live
suite accepts either "handled safely by the app" or "blocked at the edge".

### Rotating the admin password

```sql
UPDATE users SET pass_hash = :bcrypt WHERE username = 'admin';
```
Run `password_hash($new, PASSWORD_BCRYPT, ['cost' => 12])` first. A settings page
with a change-password form is on the next milestone.

### Backups

`crm.sqlite` is a single file — `sqlite3 crm.sqlite ".backup /path/out.sqlite"`
over SSH is enough. Analytics data is not precious; losing a day is fine.

## Next milestones

1. Contacts: capture interested players (email opt-in), dedupe, tags.
2. Pipeline: lead stages for the agency side (prospect → call → proposal → won).
3. Settings: change password, rotate app secret, export CSV, toggle retention.
4. Geo: needs a country header from the CDN; Hostinger's edge does not send one,
   so the panel was replaced by session depth instead of shipping an empty box.
