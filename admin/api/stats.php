<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';

security_headers(true);
require_method('GET');
require_login_api();

$ranges = [
    '24h' => [86400, 3600, 'H:i'],
    '7d' => [7 * 86400, 86400, 'D j M'],
    '30d' => [30 * 86400, 86400, 'j M'],
];
$range = $_GET['range'] ?? '24h';
if (!is_string($range) || !isset($ranges[$range])) {
    $range = '24h';
}
[$span, $bucket, $label] = $ranges[$range];

$pdo = db();
$now = time();
$from = $now - $span;
$prevFrom = $from - $span;

$one = static function (string $sql, array $args) use ($pdo): int {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($args);
    return (int) $stmt->fetchColumn();
};

$kpi = static function (int $a, int $b) use ($pdo): array {
    $stmt = $pdo->prepare('SELECT COUNT(DISTINCT vid) FROM events WHERE name = \'pageview\' AND ts >= ? AND ts < ?');
    $stmt->execute([$a, $b]);
    $visitors = (int) $stmt->fetchColumn();
    $stmt = $pdo->prepare('SELECT COUNT(DISTINCT sid) FROM events WHERE ts >= ? AND ts < ?');
    $stmt->execute([$a, $b]);
    $sessions = (int) $stmt->fetchColumn();
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM events WHERE name = \'pageview\' AND ts >= ? AND ts < ?');
    $stmt->execute([$a, $b]);
    $views = (int) $stmt->fetchColumn();
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM events WHERE name = \'game_start\' AND ts >= ? AND ts < ?');
    $stmt->execute([$a, $b]);
    $games = (int) $stmt->fetchColumn();
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM events WHERE name = \'game_over\' AND ts >= ? AND ts < ?');
    $stmt->execute([$a, $b]);
    $finished = (int) $stmt->fetchColumn();
    return [
        'visitors' => $visitors,
        'sessions' => $sessions,
        'pageviews' => $views,
        'games' => $games,
        'finished' => $finished,
        'completion' => $games > 0 ? round($finished / $games * 100) : 0,
        'views_per_session' => $sessions > 0 ? round($views / $sessions, 2) : 0,
    ];
};

$series = [];
$stmt = $pdo->prepare(
    'SELECT CAST((ts - ?) / ? AS INTEGER) AS b,
            COUNT(CASE WHEN name = \'pageview\' THEN 1 END) AS views,
            COUNT(DISTINCT CASE WHEN name = \'pageview\' THEN vid END) AS visitors
     FROM events WHERE ts >= ? GROUP BY b ORDER BY b'
);
$stmt->execute([$from, $bucket, $from]);
$rows = $stmt->fetchAll();
$buckets = (int) ceil($span / $bucket);
$filled = array_fill(0, max(1, $buckets), ['views' => 0, 'visitors' => 0]);
foreach ($rows as $row) {
    $i = (int) $row['b'];
    if ($i >= 0 && $i < count($filled)) {
        $filled[$i] = ['views' => (int) $row['views'], 'visitors' => (int) $row['visitors']];
    }
}
foreach ($filled as $i => $point) {
    $series[] = [
        't' => date('c', $from + $i * $bucket),
        'label' => (new DateTimeImmutable('@' . ($from + $i * $bucket)))
            ->setTimezone(new DateTimeZone('Europe/London'))->format($label),
        'views' => $point['views'],
        'visitors' => $point['visitors'],
    ];
}

$top = static function (string $sql, array $args) use ($pdo): array {
    $stmt = $pdo->prepare($sql);
    $stmt->execute($args);
    return array_map(static fn ($r) => ['k' => (string) ($r['k'] ?: '—'), 'n' => (int) $r['n']], $stmt->fetchAll());
};

$languages = $top(
    'SELECT lang AS k, COUNT(*) AS n FROM events
     WHERE name = \'round\' AND lang IS NOT NULL AND lang <> "" AND ts >= ? GROUP BY lang ORDER BY n DESC LIMIT 10',
    [$from]
);
$devices = $top('SELECT device AS k, COUNT(DISTINCT sid) AS n FROM events WHERE ts >= ? GROUP BY device ORDER BY n DESC', [$from]);
$browsers = $top('SELECT browser AS k, COUNT(DISTINCT sid) AS n FROM events WHERE ts >= ? GROUP BY browser ORDER BY n DESC LIMIT 6', [$from]);
$countries = $top(
    'SELECT country AS k, COUNT(DISTINCT sid) AS n FROM events
     WHERE ts >= ? AND country <> "" GROUP BY country ORDER BY n DESC LIMIT 8',
    [$from]
);
$referrers = $top(
    'SELECT CASE WHEN ref = "" THEN \'direct\' ELSE ref END AS k, COUNT(DISTINCT sid) AS n
     FROM events WHERE name = \'pageview\' AND ts >= ? GROUP BY k ORDER BY n DESC LIMIT 8',
    [$from]
);
$difficulty = $top(
    'SELECT difficulty AS k, COUNT(*) AS n FROM events
     WHERE name = \'game_start\' AND difficulty IS NOT NULL AND ts >= ? GROUP BY difficulty ORDER BY n DESC',
    [$from]
);
$accuracy = $top(
    'SELECT CASE WHEN ok = 1 THEN \'correct\' ELSE \'wrong\' END AS k, COUNT(*) AS n
     FROM events WHERE name = \'round\' AND ok IS NOT NULL AND ts >= ? GROUP BY k',
    [$from]
);

$deltas = [];
$cur = $kpi($from, $now + 1);
$prev = $kpi($prevFrom, $from);
foreach ($cur as $key => $value) {
    $deltas[$key] = $prev[$key] > 0
        ? round((($value - $prev[$key]) / $prev[$key]) * 100)
        : ($value > 0 ? 100 : 0);
}

$live = $one('SELECT COUNT(DISTINCT sid) FROM events WHERE ts >= ?', [$now - 300]);
$installed = is_file(STORAGE . '/config.php') ? (int) filemtime(STORAGE . '/config.php') : null;

json_out([
    'range' => $range,
    'generated_at' => gmdate('c'),
    'kpi' => $cur,
    'delta' => $deltas,
    'live_now' => $live,
    'series' => $series,
    'languages' => $languages,
    'devices' => $devices,
    'browsers' => $browsers,
    'countries' => $countries,
    'referrers' => $referrers,
    'difficulty' => $difficulty,
    'accuracy' => $accuracy,
]);
