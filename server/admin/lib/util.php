<?php
declare(strict_types=1);

// Included by the entry points only — never served directly.
if (!defined('ADMIN_DIR')) {
    http_response_code(404);
    exit;
}

/** HTML-escape for output. Every value that came from the database goes through this. */
function h(?string $s): string
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/** Client IP as seen by the LiteSpeed proxy, validated. Never stored raw. */
function client_ip(): string
{
    $candidates = [
        $_SERVER['HTTP_X_REAL_IP'] ?? '',
        $_SERVER['REMOTE_ADDR'] ?? '',
    ];
    foreach ($candidates as $candidate) {
        $ip = trim(explode(',', $candidate)[0]);
        if (filter_var($ip, FILTER_VALIDATE_IP)) {
            return $ip;
        }
    }
    return '0.0.0.0';
}

/** Stable, non-reversible visitor identifier for rate limits and unique counts. */
function ip_hash(?string $ip = null): string
{
    $cfg = app_config() ?: [];
    $secret = (string) ($cfg['app_secret'] ?? 'uninstalled');
    return substr(hash_hmac('sha256', $ip ?? client_ip(), $secret), 0, 32);
}

/** Truncate to a bounded length and strip control characters. */
function clean_str(mixed $value, int $max = 200): string
{
    if (!is_string($value)) {
        return '';
    }
    $value = preg_replace('/[\x00-\x1F\x7F]/u', '', $value) ?? '';
    return mb_substr(trim($value), 0, $max, 'UTF-8');
}

/** Strict identifier format check (hex tokens from the client). */
function is_token(string $value, int $len = 32): bool
{
    return (bool) preg_match('/^[a-f0-9]{' . $len . '}$/', $value);
}

/**
 * Coarse device / OS / browser buckets from the UA string. Deliberately lossy:
 * the dashboard only needs shares, and storing everything invites re-identification.
 */
function parse_ua(string $ua): array
{
    $ua = substr($ua, 0, 400);
    $l = strtolower($ua);

    $device = 'desktop';
    if (preg_match('/ipad|tablet|playbook|silk/', $l)) {
        $device = 'tablet';
    } elseif (preg_match('/mobile|iphone|ipod|android.*mobile|windows phone/', $l)) {
        $device = 'mobile';
    }
    if (preg_match('/bot|crawler|spider|headless|curl|wget|python-requests|monitor/', $l)) {
        $device = 'bot';
    }

    $os = 'other';
    foreach ([
        'ios' => '/iphone|ipad|ipod/',
        'android' => '/android/',
        'windows' => '/windows nt/',
        'macos' => '/macintosh|mac os x/',
        'linux' => '/linux/',
    ] as $name => $pattern) {
        if (preg_match($pattern, $l)) {
            $os = $name;
            break;
        }
    }

    $browser = 'other';
    foreach ([
        'edge' => '/edg\//',
        'samsung' => '/samsungbrowser/',
        'opera' => '/opr\/|opera/',
        'firefox' => '/firefox|fxios/',
        'chrome' => '/chrome|crios/',
        'safari' => '/safari/',
    ] as $name => $pattern) {
        if (preg_match($pattern, $l)) {
            $browser = $name;
            break;
        }
    }

    return [$device, $os, $browser];
}

/** Country from the CDN edge, if it sends one. Two letters only. */
function country_code(): string
{
    $candidates = [
        $_SERVER['HTTP_CF_IPCOUNTRY'] ?? '',
        $_SERVER['HTTP_X_GEOIP_COUNTRY_CODE'] ?? $_SERVER['HTTP_X_COUNTRY_CODE'] ?? '',
        $_SERVER['GEOIP_COUNTRY_CODE'] ?? '',
    ];
    foreach ($candidates as $c) {
        $c = strtoupper(trim($c));
        if (preg_match('/^[A-Z]{2}$/', $c) && $c !== 'XX') {
            return $c;
        }
    }
    return '';
}

/** Referrer reduced to its hostname — no query strings, no full URLs. */
function referrer_host(string $referrer): string
{
    $host = parse_url($referrer, PHP_URL_HOST);
    if (!is_string($host) || $host === '') {
        return '';
    }
    $host = strtolower($host);
    $host = preg_replace('/^www\./', '', $host) ?? '';
    if ($host === 'lingoguess.com') {
        return 'internal';
    }
    return mb_substr($host, 0, 100, 'UTF-8');
}

/** JSON body with a hard byte cap; returns [] on anything unexpected. */
function read_json_body(int $maxBytes = 8192): array
{
    $raw = file_get_contents('php://input', false, null, 0, $maxBytes + 1);
    if ($raw === false || strlen($raw) > $maxBytes) {
        json_out(['error' => 'payload_too_large'], 413);
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/** Same-origin check for the public collector (browsers send Origin on POST). */
function is_first_party_request(): bool
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    $referer = $_SERVER['HTTP_REFERER'] ?? '';
    $allowed = ['https://lingoguess.com', 'https://www.lingoguess.com'];
    if ($origin !== '') {
        return in_array(rtrim($origin, '/'), $allowed, true);
    }
    if ($referer !== '') {
        $host = strtolower((string) parse_url($referer, PHP_URL_HOST));
        return in_array($host, ['lingoguess.com', 'www.lingoguess.com'], true);
    }
    return false;
}

/** Local-timezone label for a unix timestamp. */
function uk_date(int $ts, string $format = 'd M H:i'): string
{
    $dt = new DateTimeImmutable('@' . $ts);
    return $dt->setTimezone(new DateTimeZone('Europe/London'))->format($format);
}
