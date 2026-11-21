<?php
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

security_headers();

if (!is_installed()) {
    http_response_code(503);
    echo '<!doctype html><meta charset="utf-8"><title>Not installed</title>'
        . '<title>Not installed</title>'
        . '<body><h1>Admin is not installed</h1>'
        . '<p>Run the one-time installer with your setup token.</p>';
    exit;
}

if (current_user()) {
    header('Location: /admin/dashboard.php', true, 303);
    exit;
}

$error = $_GET['e'] ?? '';
$messages = [
    'bad' => 'Wrong username or password.',
    'locked' => 'Too many attempts. Try again in 15 minutes.',
    'session' => 'Your session expired. Sign in again.',
    'csrf' => 'Session check failed. Try signing in again.',
];
$message = $messages[is_string($error) ? $error : ''] ?? '';
?>
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Sign in · Lingo Guess Admin</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="/fonts/fonts.css" />
<link rel="stylesheet" href="/admin/assets/admin.css" />
</head>
<body class="auth-body">
  <main class="auth-card">
    <div class="brand">
      <span class="brand-mark" aria-hidden="true"></span>
      <div>
        <strong>Lingo Guess</strong>
        <small>Admin · CRM</small>
      </div>
    </div>

    <h1>Sign in</h1>
    <?php if ($message !== ''): ?>
      <p class="alert" role="alert"><?= h($message) ?></p>
    <?php endif; ?>

    <form method="post" action="/admin/login.php" autocomplete="on">
      <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>" />
      <label for="u">Username</label>
      <input id="u" name="username" type="text" required maxlength="32"
             autocomplete="username" autocapitalize="none" spellcheck="false" />
      <label for="p">Password</label>
      <input id="p" name="password" type="password" required maxlength="200"
             autocomplete="current-password" />
      <button type="submit">Sign in</button>
    </form>

    <p class="fineprint">
      Sessions expire after 30 minutes of inactivity. All access is logged.
    </p>
  </main>
</body>
</html>
