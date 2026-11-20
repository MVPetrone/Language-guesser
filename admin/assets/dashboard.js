/* Traffic dashboard — dependency-free, CSP-safe (no inline handlers, no CDN). */
(() => {
  let range = '24h';
  let timer = null;

  const $ = (id) => document.getElementById(id);

  const fmt = (n) => new Intl.NumberFormat('en-GB').format(n || 0);

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function kpiCard(label, value, delta, suffix = '') {
    const card = el('div', 'kpi');
    card.append(el('div', 'k', label));
    card.append(el('div', 'v', fmt(value) + suffix));
    if (delta !== undefined && delta !== null) {
      const d = el('div', 'd ' + (delta > 0 ? 'up' : delta < 0 ? 'down' : ''), (delta > 0 ? '▲ ' : delta < 0 ? '▼ ' : '') + Math.abs(delta) + '% vs previous');
      card.append(d);
    }
    return card;
  }

  function bars(container, rows, opts = {}) {
    container.textContent = '';
    if (!rows || rows.length === 0) {
      container.append(el('p', 'empty', opts.empty || 'Nothing yet.'));
      return;
    }
    const max = Math.max(...rows.map((r) => r.n), 1);
    const total = rows.reduce((a, r) => a + r.n, 0) || 1;
    const NS = 'http://www.w3.org/2000/svg';
    for (const row of rows) {
      const wrap = el('div', 'bar');
      wrap.append(el('div', 'label', row.k));
      wrap.append(el('div', 'n', opts.share ? Math.round((row.n / total) * 100) + '%' : fmt(row.n)));
      // SVG geometry instead of style.width: CSP style-src 'self' blocks style attributes.
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('class', 'track-svg');
      svg.setAttribute('viewBox', '0 0 100 6');
      svg.setAttribute('preserveAspectRatio', 'none');
      const bg = document.createElementNS(NS, 'rect');
      bg.setAttribute('class', 'bg');
      bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
      bg.setAttribute('width', '100'); bg.setAttribute('height', '6');
      const fill = document.createElementNS(NS, 'rect');
      fill.setAttribute('class', 'fill');
      fill.setAttribute('x', '0'); fill.setAttribute('y', '0');
      fill.setAttribute('width', String(Math.max(3, (row.n / max) * 100)));
      fill.setAttribute('height', '6');
      svg.append(bg, fill);
      wrap.append(svg);
      container.append(wrap);
    }
  }

  function chart(points) {
    const svg = $('chart');
    svg.textContent = '';
    const W = 800, H = 210, padL = 34, padB = 22, padT = 10;
    const max = Math.max(1, ...points.map((p) => p.views));
    const stepX = points.length > 1 ? (W - padL - 8) / (points.length - 1) : 0;
    const y = (v) => padT + (H - padT - padB) * (1 - v / max);
    const x = (i) => padL + i * stepX;

    const ns = 'http://www.w3.org/2000/svg';
    const mk = (name, attrs) => {
      const node = document.createElementNS(ns, name);
      for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
      return node;
    };

    const defs = mk('defs', {});
    const grad = mk('linearGradient', { id: 'grad', x1: '0', y1: '0', x2: '0', y2: '1' });
    grad.append(mk('stop', { offset: '0%', 'stop-color': '#f0a13c', 'stop-opacity': '.35' }));
    grad.append(mk('stop', { offset: '100%', 'stop-color': '#f0a13c', 'stop-opacity': '0' }));
    defs.append(grad);
    svg.append(defs);

    for (let g = 0; g <= 3; g++) {
      const value = (max / 3) * g;
      const yy = y(value);
      svg.append(mk('line', { class: 'grid-line', x1: padL, x2: W - 4, y1: yy, y2: yy }));
      const label = mk('text', { class: 'axis', x: 4, y: yy + 3 });
      label.textContent = String(Math.round(value));
      svg.append(label);
    }

    const line = points.map((p, i) => (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ' ' + y(p.views).toFixed(1)).join(' ');
    const areaPath = line + ` L ${x(points.length - 1).toFixed(1)} ${H - padB} L ${x(0).toFixed(1)} ${H - padB} Z`;
    svg.append(mk('path', { class: 'area', d: areaPath }));
    svg.append(mk('path', { class: 'line', d: line }));

    points.forEach((p, i) => {
      if (p.views > 0 && (points.length < 40 || i % Math.ceil(points.length / 12) === 0)) {
        svg.append(mk('circle', { class: 'dot', cx: x(i), cy: y(p.views), r: 2.5 }));
      }
    });

    // Fewer labels on narrow screens: the axis font is scaled up there to stay legible.
    const labelTarget = window.innerWidth < 560 ? 4 : 8;
    const every = Math.ceil(points.length / labelTarget);
    points.forEach((p, i) => {
      if (i % every !== 0) return;
      const label = mk('text', { class: 'axis', x: x(i), y: H - 6, 'text-anchor': 'middle' });
      label.textContent = p.label;
      svg.append(label);
    });
  }

  function tag(text, cls) {
    return el('span', 'tag' + (cls ? ' ' + cls : ''), text);
  }

  function feed(events) {
    const box = $('feed');
    if (!events.length) return;
    box.textContent = '';
    for (const e of events.slice(0, 12)) {
      const row = el('div', 'feed-row');
      row.append(el('div', 'when', e.when));
      const mid = el('div', '');
      mid.append(tag(e.name));
      if (e.lang) mid.append(tag(e.lang, e.ok === true ? 'ok' : e.ok === false ? 'no' : ''));
      if (e.difficulty) mid.append(tag(e.difficulty));
      if (e.score !== null) mid.append(tag('score ' + e.score));
      if (e.country) mid.append(tag(e.country));
      row.append(mid);
      row.append(el('div', 'meta', [e.device, e.browser, e.ref && e.ref !== 'internal' ? e.ref : ''].filter(Boolean).join(' · ')));
      box.append(row);
    }
  }

  async function loadStats() {
    const res = await fetch('/admin/api/stats.php?range=' + encodeURIComponent(range), {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
    if (res.status === 401) {
      window.location = '/admin/index.php?e=session';
      return;
    }
    if (!res.ok) return;
    const data = await res.json();

    const k = $('kpis');
    k.textContent = '';
    k.append(kpiCard('Visitors', data.kpi.visitors, data.delta.visitors));
    k.append(kpiCard('Sessions', data.kpi.sessions, data.delta.sessions));
    k.append(kpiCard('Pageviews', data.kpi.pageviews, data.delta.pageviews));
    k.append(kpiCard('Games started', data.kpi.games, data.delta.games));
    k.append(kpiCard('Completion', data.kpi.completion, undefined, '%'));
    k.append(kpiCard('Live (5 min)', data.live_now, undefined));

    $('live').textContent = String(data.live_now);
    $('series-note').textContent = data.kpi.views_per_session + ' views / session';
    chart(data.series);
    bars($('languages'), data.languages, { empty: 'No rounds played yet.' });
    bars($('devices'), data.devices, { share: true });
    bars($('depth'), data.depth, { empty: 'No rounds played yet.' });
    bars($('referrers'), data.referrers, { share: true });
    bars($('difficulty'), data.difficulty, { empty: 'No games started yet.' });
    bars($('accuracy'), data.accuracy, { empty: 'No answers yet.' });
    bars($('browsers'), data.browsers, { share: true });
  }

  async function loadFeed() {
    const res = await fetch('/admin/api/feed.php?limit=25', { credentials: 'same-origin' });
    if (!res.ok) return;
    const data = await res.json();
    feed(data.events);
  }

  $('range').addEventListener('click', (ev) => {
    const btn = ev.target.closest('button[data-range]');
    if (!btn) return;
    range = btn.dataset.range;
    for (const b of $('range').querySelectorAll('button')) b.classList.toggle('on', b === btn);
    loadStats();
  });

  const tick = () => { loadStats(); loadFeed(); };
  tick();
  timer = setInterval(tick, 15000);
  window.addEventListener('beforeunload', () => clearInterval(timer));
})();
