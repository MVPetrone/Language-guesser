<?php
declare(strict_types=1);

require __DIR__ . '/../lib/bootstrap.php';

security_headers(true);
require_method('GET');
require_login_api();

$limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 25;
$limit = max(1, min(100, $limit));

$stmt = db()->prepare(
    'SELECT ts, name, path, lang, difficulty, ok, score, device, browser, country, ref
     FROM events ORDER BY ts DESC, id DESC LIMIT ?'
);
$stmt->bindValue(1, $limit, PDO::PARAM_INT);
$stmt->execute();

$out = [];
foreach ($stmt->fetchAll() as $row) {
    $out[] = [
        'ts' => (int) $row['ts'],
        'when' => uk_date((int) $row['ts'], 'H:i:s'),
        'name' => $row['name'],
        'path' => $row['path'],
        'lang' => $row['lang'],
        'difficulty' => $row['difficulty'],
        'ok' => $row['ok'] === null ? null : (bool) $row['ok'],
        'score' => $row['score'] === null ? null : (int) $row['score'],
        'device' => $row['device'],
        'browser' => $row['browser'],
        'country' => $row['country'],
        'ref' => $row['ref'],
    ];
}

json_out(['events' => $out, 'count' => count($out)]);
