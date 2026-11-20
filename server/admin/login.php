<?php
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

security_headers();

if (!is_installed()) {
    header('Location: /admin/index.php', true, 303);
    exit;
}

require_method('POST');

$token = $_POST['csrf'] ?? '';
session_boot();
if (!hash_equals((string) $_SESSION['csrf'], (string) $token)) {
    header('Location: /admin/index.php?e=csrf', true, 303);
    exit;
}

$username = clean_str($_POST['username'] ?? '', 32);
$password = is_string($_POST['password'] ?? null) ? $_POST['password'] : '';

if (login_throttled()) {
    audit('login_throttled', $username);
    header('Location: /admin/index.php?e=locked', true, 303);
    exit;
}

if ($username === '' || $password === '' || strlen($password) > 200) {
    header('Location: /admin/index.php?e=bad', true, 303);
    exit;
}

if (!attempt_login($username, $password)) {
    header('Location: /admin/index.php?e=bad', true, 303);
    exit;
}

header('Location: /admin/dashboard.php', true, 303);
