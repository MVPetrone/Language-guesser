<?php
// temporary capability probe — removed after inspection
header('Content-Type: text/plain');
$out = [];
$out['php'] = PHP_VERSION;
$out['sapi'] = PHP_SAPI;
$out['pdo_drivers'] = PDO::getAvailableDrivers();
foreach (['pdo_sqlite','sqlite3','mbstring','json','openssl','sodium','fileinfo','curl','intl'] as $e) {
    $out['ext'][$e] = extension_loaded($e);
}
$out['post_max'] = ini_get('post_max_size');
$out['memory'] = ini_get('memory_limit');
$out['max_execution'] = ini_get('max_execution_time');
$out['docroot'] = $_SERVER['DOCUMENT_ROOT'] ?? null;
$parent = dirname($_SERVER['DOCUMENT_ROOT'] ?? __DIR__);
$out['parent_writable'] = is_writable($parent);
$out['parent'] = $parent;
$out['sqlite_can_open_parent'] = false;
try {
    $p = $parent . '/.probe.sqlite';
    $db = new PDO('sqlite:' . $p);
    $db->exec('CREATE TABLE IF NOT EXISTS t (a TEXT)');
    $db->exec("INSERT INTO t VALUES ('ok')");
    $out['sqlite_can_open_parent'] = true;
    $db = null;
    @unlink($p);
} catch (Throwable $e) {
    $out['sqlite_err'] = $e->getMessage();
}
$out['headers'] = function_exists('getallheaders') ? getallheaders() : [];
echo json_encode($out, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
