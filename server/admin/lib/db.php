<?php
declare(strict_types=1);

// Included by the entry points only — never served directly.
if (!defined('ADMIN_DIR')) {
    http_response_code(404);
    exit;
}

/** Single SQLite connection (WAL), created and migrated on first use. */
function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $file = STORAGE . '/crm.sqlite';
    $pdo = new PDO('sqlite:' . $file, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA synchronous = NORMAL');
    $pdo->exec('PRAGMA busy_timeout = 4000');
    $pdo->exec('PRAGMA foreign_keys = ON');

    migrate($pdo);
    @chmod($file, 0600);

    return $pdo;
}

function migrate(PDO $pdo): void
{
    $pdo->exec(<<<SQL
        CREATE TABLE IF NOT EXISTS users (
            id           INTEGER PRIMARY KEY,
            username     TEXT NOT NULL UNIQUE,
            pass_hash    TEXT NOT NULL,
            created_at   INTEGER NOT NULL,
            last_login   INTEGER
        );

        CREATE TABLE IF NOT EXISTS events (
            id         INTEGER PRIMARY KEY,
            ts         INTEGER NOT NULL,
            vid        TEXT,
            sid        TEXT,
            name       TEXT NOT NULL,
            path       TEXT,
            lang       TEXT,
            difficulty TEXT,
            ok         INTEGER,
            score      INTEGER,
            ms         INTEGER,
            device     TEXT,
            os         TEXT,
            browser    TEXT,
            country    TEXT,
            ref        TEXT,
            ip_hash    TEXT,
            ua         TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts);
        CREATE INDEX IF NOT EXISTS idx_events_name ON events(name, ts);
        CREATE INDEX IF NOT EXISTS idx_events_sid  ON events(sid);

        CREATE TABLE IF NOT EXISTS login_attempts (
            id       INTEGER PRIMARY KEY,
            ts       INTEGER NOT NULL,
            ip_hash  TEXT NOT NULL,
            username TEXT,
            ok       INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_login_ts ON login_attempts(ts);

        CREATE TABLE IF NOT EXISTS rate_limits (
            k    TEXT PRIMARY KEY,
            ts   INTEGER NOT NULL,
            n    INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS audit (
            id     INTEGER PRIMARY KEY,
            ts     INTEGER NOT NULL,
            actor  TEXT,
            action TEXT NOT NULL,
            detail TEXT,
            ip_hash TEXT
        );
        SQL);
}

/** Fixed-window rate limiter. Returns true when the call is allowed. */
function rate_limit(string $key, int $limit, int $windowSeconds): bool
{
    $pdo = db();
    $now = time();
    $bucket = $key . ':' . intdiv($now, $windowSeconds);
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT n FROM rate_limits WHERE k = ?');
        $stmt->execute([$bucket]);
        $n = (int) ($stmt->fetchColumn() ?: 0);
        if ($n >= $limit) {
            $pdo->commit();
            return false;
        }
        $stmt = $pdo->prepare(
            'INSERT INTO rate_limits (k, ts, n) VALUES (?, ?, 1)
             ON CONFLICT(k) DO UPDATE SET n = n + 1, ts = excluded.ts'
        );
        $stmt->execute([$bucket, $now]);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
    return true;
}

function audit(string $action, string $detail = '', ?string $actor = null): void
{
    try {
        $stmt = db()->prepare(
            'INSERT INTO audit (ts, actor, action, detail, ip_hash) VALUES (?, ?, ?, ?, ?)'
        );
        $stmt->execute([time(), $actor, $action, clean_str($detail, 500), ip_hash()]);
    } catch (Throwable $e) {
        // Audit must never break a request.
    }
}

/** Housekeeping: keep the event table bounded and the tables small. */
function prune_old_data(int $keepDays = 400): void
{
    try {
        $pdo = db();
        $cutoff = time() - $keepDays * 86400;
        $pdo->prepare('DELETE FROM events WHERE ts < ?')->execute([$cutoff]);
        $pdo->prepare('DELETE FROM login_attempts WHERE ts < ?')->execute([time() - 7 * 86400]);
        $pdo->prepare('DELETE FROM rate_limits WHERE ts < ?')->execute([time() - 86400]);
    } catch (Throwable $e) {
        // best effort
    }
}
