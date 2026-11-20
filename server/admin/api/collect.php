<?php
/**
 * Public collector for the game's own analytics.
 *
 * Deliberately paranoid: POST only, first-party origin only, small payloads,
 * hard rate limit, strict allow-list of event names and fields, and nothing
 * user-supplied is ever echoed back.
 */
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';

security_headers(true);

if (!is_installed()) {
    json_out(['error' => 'not_installed'], 503);
}

require_method('POST');

// Same-origin only: a browser posting from lingoguess.com sends Origin.
if (!is_first_party_request()) {
    json_out(['error' => 'forbidden_origin'], 403);
}

// Rate limit per privacy-preserving IP hash: 120 events / minute.
if (!rate_limit('collect:' . ip_hash(), 120, 60)) {
    json_out(['error' => 'rate_limited'], 429);
}

$body = read_json_body(8192);
$events = $body['events'] ?? null;
if (!is_array($events) || $events === []) {
    json_out(['error' => 'no_events'], 422);
}
if (count($events) > 12) {
    $events = array_slice($events, 0, 12);
}

$ua = clean_str($_SERVER['HTTP_USER_AGENT'] ?? '', 400);
[$device, $os, $browser] = parse_ua($ua);

// Crawlers and monitors would only pollute the numbers.
if ($device === 'bot') {
    http_response_code(204);
    exit;
}

$vid = is_string($body['vid'] ?? null) && is_token($body['vid'], 32) ? $body['vid'] : null;
$sid = is_string($body['sid'] ?? null) && is_token($body['sid'], 32) ? $body['sid'] : null;
$path = clean_str($body['path'] ?? '/', 120);
$ref = referrer_host(clean_str($body['ref'] ?? '', 300));
$country = country_code();
$ipHash = ip_hash();

$allowed = [
    // name => [field => max length (0 = int)]
    'pageview' => ['path' => 120],
    'game_start' => ['difficulty' => 12],
    'round' => ['lang' => 8, 'difficulty' => 12, 'ok' => 0, 'ms' => 0],
    'game_over' => ['score' => 0, 'difficulty' => 12],
    'share' => ['channel' => 20],
    'guess_languages_saved' => ['count' => 0],
];

$pdo = db();
$stmt = $pdo->prepare(
    'INSERT INTO events (ts, vid, sid, name, path, lang, difficulty, ok, score, ms, device, os, browser, country, ref, ip_hash, ua)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);

$stored = 0;
$now = time();
foreach ($events as $event) {
    if (!is_array($event)) {
        continue;
    }
    $name = is_string($event['name'] ?? null) ? $event['name'] : '';
    if (!isset($allowed[$name])) {
        continue;
    }
    $props = is_array($event['p'] ?? null) ? $event['p'] : [];

    $clean = [];
    foreach ($allowed[$name] as $field => $max) {
        $value = $props[$field] ?? null;
        if ($max === 0) {
            $clean[$field] = is_bool($value) ? (int) $value : (is_numeric($value) ? (int) $value : null);
        } else {
            $clean[$field] = is_string($value) ? clean_str($value, $max) : null;
        }
    }

    // Bound the integer fields so a hostile client cannot store absurd values.
    if (isset($clean['ms'])) {
        $clean['ms'] = max(0, min(600000, (int) $clean['ms']));
    }
    if (isset($clean['score'])) {
        $clean['score'] = max(0, min(100, (int) $clean['score']));
    }
    if (isset($clean['ok'])) {
        $clean['ok'] = $clean['ok'] === null ? null : ($clean['ok'] ? 1 : 0);
    }
    if (isset($clean['count'])) {
        $clean['count'] = max(0, min(200, (int) $clean['count']));
    }

    $stmt->execute([
        $now,
        $vid,
        $sid,
        $name,
        $clean['path'] ?? $path,
        $clean['lang'] ?? null,
        $clean['difficulty'] ?? null,
        $clean['ok'] ?? null,
        $clean['score'] ?? null,
        $clean['ms'] ?? null,
        $device,
        $os,
        $browser,
        $country,
        $ref,
        $ipHash,
        $ua,
    ]);
    $stored++;
}

// Rare housekeeping so the database cannot grow without bound.
if (random_int(1, 500) === 1) {
    prune_old_data();
}

json_out(['ok' => true, 'stored' => $stored], 202);
