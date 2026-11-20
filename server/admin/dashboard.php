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
<title>Traffic · LingoGuess Admin</title>
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
  <span class="pill"><span class="dot"></span><span id="live">—</span> live now</span>
  <div class="spacer"></div>
  <span class="who"><?= h((string) $user['username']) ?></span>
  <form method="post" action="/admin/logout.php">
    <input type="hidden" name="csrf" value="<?= h($csrf) ?>" />
    <button class="ghost" type="submit">Sign out</button>
  </form>
</header>

<nav class="tabs">
  <a class="on" href="/admin/dashboard.php">Traffic</a>
  <a href="/admin/activity.php">Activity</a>
  <a class="soon" title="Next milestone">Contacts</a>
  <a class="soon" title="Next milestone">Pipeline</a>
  <a class="soon" title="Next milestone">Settings</a>
</nav>

<main class="wrap">
  <div class="row between mb">
    <h2 class="flush">Audience &amp; traffic</h2>
    <div class="seg" id="range">
      <button data-range="24h" class="on">24 hours</button>
      <button data-range="7d">7 days</button>
      <button data-range="30d">30 days</button>
    </div>
  </div>

  <section class="kpis" id="kpis" aria-live="polite"></section>

  <div class="grid">
    <div class="panel">
      <div class="row between"><h2>Pageviews</h2><span class="who" id="series-note"></span></div>
      <svg class="chart" id="chart" viewBox="0 0 800 210" preserveAspectRatio="none" role="img"
           aria-label="Pageviews over time"></svg>
    </div>
    <div class="panel">
      <h2>Languages played</h2>
      <div class="bars" id="languages"><p class="empty">No plays yet.</p></div>
    </div>
  </div>

  <div class="grid3">
    <div class="panel"><h2>Devices</h2><div class="bars" id="devices"></div></div>
    <div class="panel"><h2>Session depth</h2><div class="bars" id="depth"></div></div>
    <div class="panel"><h2>Referrers</h2><div class="bars" id="referrers"></div></div>
  </div>

  <div class="grid3">
    <div class="panel"><h2>Difficulty mix</h2><div class="bars" id="difficulty"></div></div>
    <div class="panel"><h2>Answer accuracy</h2><div class="bars" id="accuracy"></div></div>
    <div class="panel"><h2>Browsers</h2><div class="bars" id="browsers"></div></div>
  </div>

  <div class="panel">
    <div class="row between"><h2 class="flush">Live activity</h2><span class="who" id="feed-note">refreshes every 15s</span></div>
    <div class="feed" id="feed"><p class="empty">Waiting for the first event…</p></div>
  </div>
</main>

<script src="/admin/assets/dashboard.js" defer></script>
</body>
</html>
