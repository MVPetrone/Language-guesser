<?php
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

security_headers();

require_method('POST');
session_boot();
require_csrf($_POST['csrf'] ?? null);

$user = current_user();
audit('logout', '', $user['username'] ?? null);
destroy_session();

header('Location: /admin/index.php', true, 303);
