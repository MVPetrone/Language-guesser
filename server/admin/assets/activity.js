/* Event log — paginated, filtered, all values inserted as text nodes (no innerHTML). */
(() => {
  const state = { page: 1, q: '', name: '', pages: 1 };
  const $ = (id) => document.getElementById(id);

  const cell = (text, cls) => {
    const td = document.createElement('td');
    if (cls) td.className = cls;
    td.textContent = text === null || text === undefined || text === '' ? '—' : String(text);
    return td;
  };

  const tag = (text, cls) => {
    const span = document.createElement('span');
    span.className = 'tag' + (cls ? ' ' + cls : '');
    span.textContent = text;
    return span;
  };

  async function load() {
    const params = new URLSearchParams({ page: String(state.page) });
    if (state.q) params.set('q', state.q);
    if (state.name) params.set('name', state.name);

    const res = await fetch('/admin/api/events.php?' + params.toString(), { credentials: 'same-origin' });
    if (res.status === 401) {
      window.location = '/admin/index.php?e=session';
      return;
    }
    if (!res.ok) return;
    const data = await res.json();
    state.pages = data.pages;

    const body = $('rows');
    body.textContent = '';
    if (!data.rows.length) {
      const tr = document.createElement('tr');
      const td = cell('No events match.', 'empty');
      td.colSpan = 10;
      tr.append(td);
      body.append(tr);
    }
    for (const row of data.rows) {
      const tr = document.createElement('tr');
      tr.append(cell(row.when, 'mono'));
      const eventTd = document.createElement('td');
      eventTd.append(tag(row.name));
      tr.append(eventTd);
      tr.append(cell(row.lang, 'mono'));
      tr.append(cell(row.difficulty));
      const resultTd = document.createElement('td');
      if (row.ok === true) resultTd.append(tag('correct', 'ok'));
      else if (row.ok === false) resultTd.append(tag('wrong', 'no'));
      else if (row.score !== null) resultTd.append(tag('score ' + row.score));
      else resultTd.textContent = '—';
      tr.append(resultTd);
      tr.append(cell(row.device));
      tr.append(cell(row.browser));
      tr.append(cell(row.country, 'mono'));
      tr.append(cell(row.ref));
      tr.append(cell(row.session, 'mono'));
      body.append(tr);
    }

    $('count').textContent = data.total + ' events · page ' + data.page + ' / ' + data.pages;
    $('prev').disabled = data.page <= 1;
    $('next').disabled = data.page >= data.pages;
  }

  let debounce = null;
  $('q').addEventListener('input', (ev) => {
    clearTimeout(debounce);
    const value = ev.target.value.trim();
    debounce = setTimeout(() => { state.q = value; state.page = 1; load(); }, 300);
  });
  $('name').addEventListener('change', (ev) => { state.name = ev.target.value; state.page = 1; load(); });
  $('prev').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); } });
  $('next').addEventListener('click', () => { if (state.page < state.pages) { state.page++; load(); } });

  load();
})();
