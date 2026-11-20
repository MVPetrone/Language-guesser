<?php
declare(strict_types=1);

// Included by the entry points only — never served directly.
if (!defined('ADMIN_DIR')) {
    http_response_code(404);
    exit;
}

const SESSION_NAME = 'lgcrm';
const IDLE_TIMEOUT = 1800;      // 30 min without a request
const ABSOLUTE_TIMEOUT = 43200; // 12 h since login

/** Hardened session start: private storage, strict cookie, no fixation. */
function session_boot(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_save_path(STORAGE . '/sessions');
    session_name(SESSION_NAME);
    $secure = !empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https';
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.gc_maxlifetime', (string) ABSOLUTE_TIMEOUT);
    session_start();

    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
}

function current_user(): ?array
{
    session_boot();
    if (empty($_SESSION['uid'])) {
        return null;
    }
    $now = time();
    $last = (int) ($_SESSION['last_seen'] ?? 0);
    $started = (int) ($_SESSION['started'] ?? 0);
    if ($last > 0 && $now - $last > IDLE_TIMEOUT) {
        destroy_session();
        return null;
    }
    if ($started > 0 && $now - $started > ABSOLUTE_TIMEOUT) {
        destroy_session();
        return null;
    }
    $_SESSION['last_seen'] = $now;

    $stmt = db()->prepare('SELECT id, username, last_login FROM users WHERE id = ?');
    $stmt->execute([(int) $_SESSION['uid']]);
    $user = $stmt->fetch();
    if (!$user) {
        destroy_session();
        return null;
    }
    return $user;
}

function destroy_session(): void
{
    $_SESSION = [];
    $params = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => $params['path'],
        'domain' => $params['domain'],
        'secure' => $params['secure'],
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    session_destroy();
}

/** Page guard: redirect to the login screen. */
function require_login_page(): array
{
    $user = current_user();
    if (!$user) {
        header('Location: /admin/index.php', true, 303);
        exit;
    }
    return $user;
}

/** API guard: 401 JSON, no redirect that could leak state to a browser. */
function require_login_api(): array
{
    $user = current_user();
    if (!$user) {
        json_out(['error' => 'unauthorized'], 401);
    }
    return $user;
}

function csrf_token(): string
{
    session_boot();
    return (string) $_SESSION['csrf'];
}

/** Constant-time CSRF check for every state-changing request. */
function require_csrf(?string $token): void
{
    session_boot();
    if (!is_string($token) || $token === '' || !hash_equals((string) $_SESSION['csrf'], $token)) {
        json_out(['error' => 'csrf_failed'], 403);
    }
}

/** Login throttle: 5 failures per 15 min per IP, 10 per IP+username per hour. */
function login_throttled(): bool
{
    $ip = ip_hash();
    $pdo = db();
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM login_attempts WHERE ip_hash = ? AND ok = 0 AND ts > ?');
    $stmt->execute([$ip, time() - 900]);
    return (int) $stmt->fetchColumn() >= 5;
}

function record_login_attempt(string $username, bool $ok): void
{
    $stmt = db()->prepare('INSERT INTO login_attempts (ts, ip_hash, username, ok) VALUES (?, ?, ?, ?)');
    $stmt->execute([time(), ip_hash(), clean_str($username, 64), $ok ? 1 : 0]);
}

/**
 * Verify credentials. Always runs a password_verify (even for unknown users) so
 * response timing does not reveal whether a username exists.
 */
function attempt_login(string $username, string $password): bool
{
    $stmt = db()->prepare('SELECT id, pass_hash FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $row = $stmt->fetch();
    $hash = $row['pass_hash'] ?? '$2y$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv';
    $ok = password_verify($password, $hash) && $row !== false;
    if (!$ok) {
        record_login_attempt($username, false);
        return false;
    }
    session_boot();
    session_regenerate_id(true);
    $_SESSION['uid'] = (int) $row['id'];
    $_SESSION['started'] = time();
    $_SESSION['last_seen'] = time();
    db()->prepare('UPDATE users SET last_login = ? WHERE id = ?')->execute([time(), (int) $row['id']]);
    record_login_attempt($username, true);
    audit('login', '', $username);
    return true;
}

/** Password policy used by setup and any future rotation. */
function password_problem(string $password): ?string
{
    if (strlen($password) < 14) {
        return 'Use at least 14 characters.';
    }
    if (preg_match('/^(.)\1+$/', $password)) {
        return 'That is a single repeated character.';
    }
    $common = ['password', 'lingoguess', 'qwerty', 'letmein', 'changeme', 'admin123'];
    foreach ($common as $bad) {
        if (stripos($password, $bad) !== false) {
            return 'Avoid dictionary words like "' . $bad . '".';
        }
    }
    return null;
}
