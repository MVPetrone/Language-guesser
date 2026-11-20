<?php
/**
 * Bootstraps every admin request: paths, config, error handling, security headers.
 * Nothing here trusts user input; all callers go through the helpers below.
 */
declare(strict_types=1);

// Not an entry point: refuse to run when requested directly.
if (isset($_SERVER['SCRIPT_FILENAME']) && basename((string) $_SERVER['SCRIPT_FILENAME']) === basename(__FILE__)) {
    http_response_code(404);
    exit;
}

define('ADMIN_DIR', dirname(__DIR__));                 // .../public_html/admin
define('DOC_ROOT', dirname(ADMIN_DIR));                // .../public_html
define('STORAGE', dirname(DOC_ROOT) . '/storage');     // .../storage (outside the webroot)

foreach ([STORAGE, STORAGE . '/sessions', STORAGE . '/logs'] as $dir) {
    if (!is_dir($dir)) {
        @mkdir($dir, 0700, true);
    }
}

// No stack traces or paths in responses, ever. Errors go to a private log.
ini_set('display_errors', '0');
ini_set('display_startup_errors', '0');
ini_set('log_errors', '1');
ini_set('error_log', STORAGE . '/logs/php.log');
ini_set('expose_php', '0');
error_reporting(E_ALL);

date_default_timezone_set('UTC');

require __DIR__ . '/util.php';
require __DIR__ . '/db.php';
require __DIR__ . '/auth.php';

/** Config array, or null when the app has not been set up yet. */
function app_config(): ?array
{
    static $cfg = false;
    if ($cfg !== false) {
        return $cfg;
    }
    $file = STORAGE . '/config.php';
    if (!is_file($file)) {
        return $cfg = null;
    }
    $loaded = require $file;
    return $cfg = (is_array($loaded) ? $loaded : null);
}

function is_installed(): bool
{
    $cfg = app_config();
    return is_array($cfg) && !empty($cfg['app_secret']);
}

/** Headers that apply to every admin response. */
function security_headers(bool $isJson = false): void
{
    header_remove('X-Powered-By');
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: no-referrer');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=(), interest-cohort=()');
    header('Cross-Origin-Opener-Policy: same-origin');
    header('Cross-Origin-Resource-Policy: same-origin');
    header('X-Robots-Tag: noindex, nofollow, noarchive');
    if (!empty($_SERVER['HTTPS']) || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') {
        header('Strict-Transport-Security: max-age=31536000; includeSubDomains');
    }
    if ($isJson) {
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: no-store, private');
    } else {
        header(
            "Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; "
            . "img-src 'self' data:; font-src 'self'; connect-src 'self'; form-action 'self'; "
            . "frame-ancestors 'none'; base-uri 'none'; object-src 'none'"
        );
        header('Cache-Control: no-store, private');
    }
}

/** JSON response + exit. */
function json_out(array $payload, int $status = 200): never
{
    http_response_code($status);
    security_headers(true);
    echo json_encode(
        $payload,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT
    );
    exit;
}

/** Refuse anything that is not the expected verb. */
function require_method(string ...$allowed): void
{
    $m = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (!in_array($m, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        json_out(['error' => 'method_not_allowed'], 405);
    }
}
