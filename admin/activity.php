<?php
declare(strict_types=1);

require __DIR__ . '/lib/bootstrap.php';

security_headers();
$user = require_login_page();
$csrf = csrf_token();
?>
<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Activity · LingoGuess Admin</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="/fonts/fonts.css" />
<link rel="stylesheet" href="/admin/assets/admin.css" />
</head>
<body>
<header class="topbar">
  <div class="brand">
    <span class="brand-mark" aria-hidden="true"></span>
    <div><strong>LingoGuess</strong><small>Admin · CRM</small></div>
  </div>
  <div class="spacer"></div>
  <span class="who"><?= h((string) $user['username']) ?></span>
  <form method="post" action="/admin/logout.php">
    <input type="hidden" name="csrf" value="<?= h($csrf) ?>" />
    <button class="ghost" type="submit">Sign out</button>
  </form>
</header>

<nav class="tabs">
  <a href="/admin/dashboard.php">Traffic</a>
  <a class="on" href="/admin/activity.php">Activity</a>
  <a class="soon" title="Next milestone">Contacts</a>
  <a class="soon" title="Next milestone">Pipeline</a>
  <a class="soon" title="Next milestone">Settings</a>
</nav>

<main class="wrap">
  <div class="row between mb">
    <h2 class="flush">Event log</h2>
    <div class="row">
      <div class="search">
        <input id="q" type="search" placeholder="Search language, path, referrer…" maxlength="60" />
        <select id="name" class="select">
          <option value="">All events</option>
          <option value="pageview">pageview</option>
          <option value="game_start">game_start</option>
          <option value="round">round</option>
          <option value="game_over">game_over</option>
          <option value="share">share</option>
        </select>
      </div>
    </div>
  </div>

  <div class="panel">
    <table class="data">
      <thead>
        <tr>
          <th>When</th><th>Event</th><th>Language</th><th>Diff</th><th>Result</th>
          <th>Device</th><th>Browser</th><th>Country</th><th>Referrer</th><th>Session</th>
        </tr>
      </thead>
      <tbody id="rows"><tr><td colspan="10" class="empty">Loading…</td></tr></tbody>
    </table>
    <div class="pager">
      <span class="who" id="count"></span>
      <button class="ghost" id="prev" type="button">Previous</button>
      <button class="ghost" id="next" type="button">Next</button>
    </div>
  </div>
</main>

<script src="/admin/assets/activity.js" defer></script>
</body>
</html>
