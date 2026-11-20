<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';

security_headers(true);
require_method('GET');
require_login_api();

$names = ['pageview', 'game_start', 'round', 'game_over', 'share', 'guess_languages_saved'];
$name = $_GET['name'] ?? '';
$name = is_string($name) && in_array($name, $names, true) ? $name : '';

$q = clean_str($_GET['q'] ?? '', 60);
$page = max(1, (int) ($_GET['page'] ?? 1));
$perPage = 50;

$where = [];
$args = [];
if ($name !== '') {
    $where[] = 'name = ?';
    $args[] = $name;
}
if ($q !== '') {
    $where[] = '(lang LIKE ? OR path LIKE ? OR ref LIKE ? OR country LIKE ? OR device LIKE ? OR browser LIKE ?)';
    $like = '%' . str_replace(['%', '_'], '', $q) . '%';
    array_push($args, $like, $like, $like, $like, $like, $like);
}
$clause = $where ? ('WHERE ' . implode(' AND ', $where)) : '';

$pdo = db();
$countStmt = $pdo->prepare('SELECT COUNT(*) FROM events ' . $clause);
$countStmt->execute($args);
$total = (int) $countStmt->fetchColumn();

$stmt = $pdo->prepare(
    'SELECT ts, vid, sid, name, path, lang, difficulty, ok, score, ms, device, os, browser, country, ref
     FROM events ' . $clause . ' ORDER BY ts DESC, id DESC LIMIT ? OFFSET ?'
);
$i = 1;
foreach ($args as $arg) {
    $stmt->bindValue($i++, $arg, PDO::PARAM_STR);
}
$stmt->bindValue($i++, $perPage, PDO::PARAM_INT);
$stmt->bindValue($i, ($page - 1) * $perPage, PDO::PARAM_INT);
$stmt->execute();

$rows = [];
foreach ($stmt->fetchAll() as $row) {
    $rows[] = [
        'when' => uk_date((int) $row['ts'], 'd M H:i:s'),
        'name' => $row['name'],
        'path' => $row['path'],
        'lang' => $row['lang'],
        'difficulty' => $row['difficulty'],
        'ok' => $row['ok'] === null ? null : (bool) $row['ok'],
        'score' => $row['score'] === null ? null : (int) $row['score'],
        'ms' => $row['ms'] === null ? null : (int) $row['ms'],
        'device' => $row['device'],
        'os' => $row['os'],
        'browser' => $row['browser'],
        'country' => $row['country'],
        'ref' => $row['ref'],
        // Identifiers are truncated: enough to correlate, not enough to track a person.
        'session' => $row['sid'] ? substr((string) $row['sid'], 0, 8) : null,
    ];
}

json_out([
    'rows' => $rows,
    'total' => $total,
    'page' => $page,
    'per_page' => $perPage,
    'pages' => max(1, (int) ceil($total / $perPage)),
]);
