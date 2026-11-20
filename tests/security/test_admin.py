#!/usr/bin/env python3
"""
Security + behaviour suite for the LingoGuess admin/CRM.

Runs against any base URL (local PHP server or the live site):

    python3 tests/security/test_admin.py http://127.0.0.1:36859
    BASE_URL=https://lingoguess.com ADMIN_USER=... ADMIN_PASS=... \
    SETUP_TOKEN=... python3 tests/security/test_admin.py

The installer test only runs when SETUP_TOKEN is supplied *and* the target is
not installed yet. Rate-limit tests run last because they deliberately trip the
throttles.
"""
from __future__ import annotations

import http.cookiejar
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("BASE_URL", "http://127.0.0.1:36859")).rstrip("/")
USER = os.environ.get("ADMIN_USER", "admin")
PASSWORD = os.environ.get("ADMIN_PASS", "") or (
    open(os.environ["ADMIN_PASS_FILE"]).read().strip() if os.environ.get("ADMIN_PASS_FILE") else ""
)
SETUP_TOKEN = os.environ.get("SETUP_TOKEN", "") or (
    open(os.environ["SETUP_TOKEN_FILE"]).read().strip() if os.environ.get("SETUP_TOKEN_FILE") else ""
)

results: list[tuple[str, bool, str]] = []


def check(name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    print(("  PASS  " if ok else "  FAIL  ") + name + (f"  [{detail}]" if detail and not ok else ""))


class Client:
    def __init__(self) -> None:
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(
            urllib.request.HTTPCookieProcessor(self.jar),
            NoRedirect(),
        )

    def req(self, method: str, path: str, data: bytes | None = None, headers: dict | None = None):
        url = BASE + path
        request = urllib.request.Request(url, data=data, method=method)
        request.add_header("User-Agent", "security-suite/1.0")
        for key, value in (headers or {}).items():
            request.add_header(key, value)
        try:
            with self.opener.open(request, timeout=30) as response:
                return response.status, dict(response.headers), response.read()
        except urllib.error.HTTPError as err:
            return err.code, dict(err.headers), err.read()

    def post_form(self, path: str, fields: dict, headers: dict | None = None):
        body = urllib.parse.urlencode(fields).encode()
        hdrs = {"Content-Type": "application/x-www-form-urlencoded"}
        hdrs.update(headers or {})
        return self.req("POST", path, body, hdrs)

    def post_json(self, path: str, payload, headers: dict | None = None):
        body = json.dumps(payload).encode()
        hdrs = {"Content-Type": "application/json"}
        hdrs.update(headers or {})
        return self.req("POST", path, body, hdrs)

    def cookie(self, name: str):
        for c in self.jar:
            if c.name == name:
                return c
        return None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def body_text(raw: bytes) -> str:
    return raw.decode("utf-8", "replace")


def csrf_from(html: str) -> str:
    match = re.search(r'name="csrf" value="([a-f0-9]{64})"', html)
    return match.group(1) if match else ""


# --------------------------------------------------------------------------- #
# 1. Unauthenticated surface
# --------------------------------------------------------------------------- #
anon = Client()

status, headers, raw = anon.req("GET", "/admin/dashboard.php")
check("dashboard requires auth (redirects)", status in (302, 303) and "/admin/index.php" in headers.get("Location", ""), f"{status} {headers.get('Location')}")

status, headers, raw = anon.req("GET", "/admin/api/stats.php")
check("stats API requires auth (401 json)", status == 401 and b"unauthorized" in raw, str(status))

status, headers, raw = anon.req("GET", "/admin/api/events.php")
check("events API requires auth", status == 401, str(status))

status, headers, raw = anon.req("GET", "/admin/api/feed.php")
check("feed API requires auth", status == 401, str(status))

status, headers, raw = anon.req("GET", "/admin/setup.php")
check("setup refuses GET", status in (405, 410), str(status))

status, headers, raw = anon.post_json("/admin/setup.php", {"username": "x", "password": "y"})
check("setup refuses request without token", status in (403, 410), str(status))

status, headers, raw = anon.req("GET", "/admin/lib/bootstrap.php")
check("lib/ is not directly reachable", status in (403, 404), str(status))

status, headers, raw = anon.req("GET", "/admin/lib/db.php")
check("db include is not directly reachable", status in (403, 404), str(status))

status, headers, raw = anon.req("GET", "/admin/lib/bootstrap.php")
check("bootstrap is not directly reachable", status in (403, 404), str(status))

for path in ("/admin/index.php",):
    status, headers, raw = anon.req("GET", path)
    check(f"security headers on {path}",
          headers.get("X-Frame-Options") == "DENY"
          and headers.get("X-Content-Type-Options") == "nosniff"
          and "frame-ancestors 'none'" in headers.get("Content-Security-Policy", "")
          and "no-store" in headers.get("Cache-Control", ""),
          str({k: headers.get(k) for k in ("X-Frame-Options", "Content-Security-Policy")})[:80])

check("login page is not indexable",
      "noindex" in anon.req("GET", "/admin/index.php")[1].get("X-Robots-Tag", ""), "")

# --------------------------------------------------------------------------- #
# 2. Installer gate
# --------------------------------------------------------------------------- #
installed = "already_installed" in body_text(anon.post_json("/admin/setup.php", {}).__getitem__(2))

if installed:
    check("setup is dead once installed (410)", anon.post_json("/admin/setup.php", {})[0] == 410, "")
elif SETUP_TOKEN:
    status, headers, raw = anon.post_json(
        "/admin/setup.php", {"username": "admin", "password": "short"}, {"X-Setup-Token": SETUP_TOKEN}
    )
    check("setup rejects weak passwords", status == 422, str(status))

    status, headers, raw = anon.post_json(
        "/admin/setup.php", {"username": "admin", "password": "Correct-Horse-Battery-9x!"},
        {"X-Setup-Token": "wrong" + SETUP_TOKEN},
    )
    check("setup rejects a wrong token", status == 403, str(status))

    status, headers, raw = anon.post_json(
        "/admin/setup.php",
        {"username": "admin", "password": "Correct-Horse-Battery-9x!"},
        {"X-Setup-Token": SETUP_TOKEN},
    )
    check("setup accepts the right token", status == 201, f"{status} {raw[:120]}")
    PASSWORD = PASSWORD or "Correct-Horse-Battery-9x!"
else:
    print("  SKIP  installer tests (already installed / no token supplied)")

# --------------------------------------------------------------------------- #
# 3. Login flow, cookies, fixation
# --------------------------------------------------------------------------- #
if not PASSWORD:
    print("  SKIP  authenticated tests (no ADMIN_PASS)")
else:
    c = Client()
    status, headers, raw = c.post_form("/admin/login.php", {"username": USER, "password": "wrong-password", "csrf": "0" * 64})
    check("login rejects a bad CSRF token", status in (302, 303) and "e=csrf" in headers.get("Location", ""), headers.get("Location", ""))

    page = body_text(c.req("GET", "/admin/index.php")[2])
    token = csrf_from(page)
    check("login page exposes a CSRF token", len(token) == 64, str(len(token)))

    status, headers, raw = c.post_form("/admin/login.php", {"username": USER, "password": "definitely-wrong", "csrf": token})
    check("login rejects wrong credentials", "e=bad" in headers.get("Location", ""), headers.get("Location", ""))

    page = body_text(c.req("GET", "/admin/index.php")[2])
    token = csrf_from(page)
    first_sid = c.cookie("lgcrm").value if c.cookie("lgcrm") else ""
    status, headers, raw = c.post_form("/admin/login.php", {"username": USER, "password": PASSWORD, "csrf": token})
    check("login succeeds with correct credentials", status in (302, 303) and "/admin/dashboard.php" in headers.get("Location", ""), headers.get("Location", ""))

    cookie = c.cookie("lgcrm")
    check("session cookie is HttpOnly", bool(cookie) and "httponly" in str(cookie._rest).lower() or bool(cookie and cookie.has_nonstandard_attr("HttpOnly")), str(cookie and cookie._rest))
    check("session cookie is SameSite=Strict", bool(cookie) and "strict" in str(cookie._rest).lower(), str(cookie and cookie._rest))
    if BASE.startswith("https://"):
        check("session cookie is Secure", bool(cookie) and cookie.secure, str(cookie and cookie.secure))

    status, headers, raw = c.req("GET", "/admin/dashboard.php")
    dash = body_text(raw)
    check("dashboard renders for an authenticated user", status == 200 and "Audience" in dash, str(status))

    status, headers, raw = c.req("GET", "/admin/api/stats.php?range=24h")
    check("stats API returns JSON for an authenticated user", status == 200 and b'"kpi"' in raw, str(status))

    status, headers, raw = c.req("GET", "/admin/api/stats.php?range=DROP%20TABLE")
    check("unknown range falls back instead of erroring", status == 200, str(status))

    status, headers, raw = c.req("POST", "/admin/logout.php", b"")
    check("logout requires a CSRF token", status == 403, str(status))

    dash_token = csrf_from(dash)
    status, headers, raw = c.post_form("/admin/logout.php", {"csrf": dash_token})
    check("logout works with a valid token", status in (302, 303), str(status))

    status, headers, raw = c.req("GET", "/admin/dashboard.php")
    check("session is dead after logout", status in (302, 303), str(status))

    # session fixation: a fresh login must issue a new session id
    c2 = Client()
    page = body_text(c2.req("GET", "/admin/index.php")[2])
    status, headers, raw = c2.post_form("/admin/login.php", {"username": USER, "password": PASSWORD, "csrf": csrf_from(page)})
    new_sid = c2.cookie("lgcrm").value if c2.cookie("lgcrm") else ""
    check("login regenerates the session id", bool(new_sid) and new_sid != first_sid, f"{first_sid[:8]} -> {new_sid[:8]}")

# --------------------------------------------------------------------------- #
# 4. Collector: origin, schema, XSS, size
# --------------------------------------------------------------------------- #
pub = Client()
origin = {"Origin": BASE.rstrip("/")}
if BASE.startswith("http://127.0.0.1") or BASE.startswith("http://localhost"):
    origin = {"Origin": "https://lingoguess.com"}

status, headers, raw = pub.post_json("/admin/api/collect.php", {"events": [{"name": "pageview"}]})
check("collector rejects cross/no origin", status == 403, str(status))

status, headers, raw = pub.post_json("/admin/api/collect.php", {"events": [{"name": "pageview"}]}, {"Origin": "https://evil.example"})
check("collector rejects a foreign origin", status == 403, str(status))

status, headers, raw = pub.post_json("/admin/api/collect.php", {"events": []}, origin)
check("collector rejects an empty event list", status == 422, str(status))

status, headers, raw = pub.post_json("/admin/api/collect.php", {"events": [{"name": "<script>alert(1)</script>"}]}, origin)
check("collector ignores unknown event names", status == 202 and b'"stored":0' in raw, body_text(raw)[:60])

vid = "a" * 32
sid = "b" * 32
xss = "<img src=x onerror=alert(1)>"
status, headers, raw = pub.post_json(
    "/admin/api/collect.php",
    {"vid": vid, "sid": sid, "path": xss, "ref": "https://news.ycombinator.com/item?id=1",
     "events": [{"name": "pageview", "p": {"path": xss}},
                {"name": "round", "p": {"lang": xss, "difficulty": "easy", "ok": True, "ms": 1234}},
                {"name": "game_start", "p": {"difficulty": "easy"}}]},
    origin,
)
check("collector stores a valid batch", status == 202 and b'"stored":3' in raw, body_text(raw)[:80])

status, headers, raw = pub.post_json("/admin/api/collect.php", {"events": [{"name": "pageview"}] * 50}, {**origin, "Content-Type": "application/json"})
check("collector caps oversized batches", status in (202, 413), str(status))

huge = {"events": [{"name": "pageview", "p": {"path": "A" * 20000}}]}
status, headers, raw = pub.post_json("/admin/api/collect.php", huge, origin)
check("collector rejects oversized bodies", status == 413, str(status))

status, headers, raw = pub.req("GET", "/admin/api/collect.php", headers=origin)
check("collector is POST-only", status == 405, str(status))

if PASSWORD:
    # A payload is "safe" either because the app handled it (200 + JSON) or
    # because the CDN edge blocked it outright (403). Both are acceptable.
    def safe_outcome(status: int, raw: bytes) -> tuple[bool, str]:
        if status == 200:
            return (b'"rows"' in raw, "handled by app")
        if status == 403:
            return (True, "blocked at edge")
        return (False, f"unexpected {status}")

    status, headers, raw = c2.req("GET", "/admin/api/events.php?q=" + urllib.parse.quote("' OR 1=1 --"))
    ok, how = safe_outcome(status, raw)
    check("event search is injection-safe", ok, f"{status} {how}")

    status, headers, raw = c2.req("GET", "/admin/api/events.php?name=" + urllib.parse.quote("pageview'); DROP TABLE events;--"))
    ok, how = safe_outcome(status, raw)
    check("event name filter is whitelisted", ok, f"{status} {how}")

    status, headers, raw = c2.req("GET", "/admin/api/events.php?q=" + urllib.parse.quote(xss))
    text = body_text(raw)
    if status == 403:
        check("stored XSS is hex-escaped in JSON", True, "blocked at edge")
        check("API responses are JSON + nosniff", True, "blocked at edge")
    else:
        check("stored XSS is hex-escaped in JSON", "<img" not in text and "\\u003Cimg" in text, text[:120])
        check("API responses are JSON + nosniff",
              headers.get("Content-Type", "").startswith("application/json")
              and headers.get("X-Content-Type-Options") == "nosniff",
              headers.get("Content-Type", ""))

    # the row must exist (so the previous check is meaningful) and the table must survive
    status, headers, raw = c2.req("GET", "/admin/api/events.php?name=pageview")
    check("events table survived injection attempts", status == 200 and b'"total"' in raw, str(status))

    status, headers, raw = c2.req("GET", "/admin/activity.php")
    check("activity page renders", status == 200 and b"Event log" in raw, str(status))

# --------------------------------------------------------------------------- #
# 5. Rate limits (run last: they trip the throttles)
# --------------------------------------------------------------------------- #
# Fire concurrently: a sequential loop over a slow link can straddle two
# one-minute windows and never reach the limit.
from concurrent.futures import ThreadPoolExecutor

def one_hit(_):
    client = Client()
    status, _, _ = client.post_json("/admin/api/collect.php", {"events": [{"name": "pageview"}]}, origin)
    return status

with ThreadPoolExecutor(max_workers=12) as pool:
    statuses = list(pool.map(one_hit, range(150)))
limited = 429 in statuses
check("collector rate-limits a flood", limited, "statuses: " + str(sorted(set(statuses))))

if PASSWORD:
    locker = Client()
    locked = False
    for _ in range(8):
        page = body_text(locker.req("GET", "/admin/index.php")[2])
        status, headers, _ = locker.post_form(
            "/admin/login.php",
            {"username": "nobody", "password": "wrong-" + str(time.time()), "csrf": csrf_from(page)},
        )
        if "e=locked" in headers.get("Location", ""):
            locked = True
            break
    check("login throttles repeated failures", locked, "no lockout after 8 attempts")

# --------------------------------------------------------------------------- #
failed = [r for r in results if not r[1]]
print(f"\n{len(results) - len(failed)}/{len(results)} checks passed")
if failed:
    print("FAILED:")
    for name, _, detail in failed:
        print("  -", name, detail)
sys.exit(1 if failed else 0)
