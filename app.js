(function () {
  'use strict';

  const KEY = 'todos-app-v1';
  const UI_KEY = 'todos-ui-v1';
  const { parse } = window.TodoParser;

  const COLORS = ['#007aff', '#34c759', '#ff2d55', '#00c7be', '#ff9500', '#af52de', '#5856d6', '#ff3b30', '#a2845e', '#8e8e93'];
  const DEFAULT_CATEGORIES = [
    { id: 'arbeit', name: 'Arbeit', color: '#007aff' },
    { id: 'privat', name: 'Privat', color: '#34c759' },
    { id: 'beziehung', name: 'Beziehung', color: '#ff2d55' },
    { id: 'gesundheit', name: 'Gesundheit', color: '#00c7be' },
    { id: 'finanzen', name: 'Finanzen', color: '#ff9500' },
    { id: 'sonstiges', name: 'Sonstiges', color: '#8e8e93' },
  ];
  const FALLBACK_CATEGORY = 'sonstiges';
  const TITLES = { todo: 'ToDos', reminder: 'Erinnerungen', thought: 'Gedanken' };
  const PLACEHOLDERS = {
    todo: 'Neues ToDo …',
    reminder: 'z. B. morgen 9 Uhr Arzt',
    thought: 'Neuer Gedanke …',
  };
  const COLLECTION = { todo: 'todos', reminder: 'reminders', thought: 'thoughts' };

  // ─── Speicher ──────────────────────────────────────────────────────
  function readJSON(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }

  function emptyData() {
    return { version: 1, categories: DEFAULT_CATEGORIES.map((c) => ({ ...c })), todos: [], reminders: [], thoughts: [] };
  }
  function isValidData(d) {
    return d && Array.isArray(d.categories) && Array.isArray(d.todos) && Array.isArray(d.reminders) && Array.isArray(d.thoughts);
  }

  let data = readJSON(KEY);
  if (!isValidData(data)) data = emptyData();
  if (!data.categories.some((c) => c.id === FALLBACK_CATEGORY)) {
    data.categories.push({ ...DEFAULT_CATEGORIES.find((c) => c.id === FALLBACK_CATEGORY) });
  }
  const ui = Object.assign({ tab: 'todo', filter: 'all', tag: null, toCalendar: true, hintClosed: false, lastBackup: null }, readJSON(UI_KEY));

  function save() {
    if (!writeJSON(KEY, data)) toast('Speichern fehlgeschlagen – Speicher voll?');
  }
  function saveUi() { writeJSON(UI_KEY, ui); }

  // ─── Helfer ────────────────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const todayStr = () => ymd(new Date());
  const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return ymd(d); };
  const yesterdayStr = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); };
  const dateFromYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const fmtShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  const fmtDayMonth = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
  const category = (id) => data.categories.find((c) => c.id === id) || data.categories.find((c) => c.id === FALLBACK_CATEGORY);

  function dayLabel(dateStr) {
    if (dateStr === todayStr()) return 'Heute';
    if (dateStr === tomorrowStr()) return 'Morgen';
    if (dateStr === yesterdayStr()) return 'Gestern';
    return fmtShort.format(dateFromYmd(dateStr));
  }

  function dueInfo(todo) {
    if (!todo.due) return null;
    const t = todayStr();
    const cls = todo.due < t ? 'overdue' : todo.due === t ? 'today' : '';
    return { cls, label: dayLabel(todo.due) + (todo.dueTime ? `, ${todo.dueTime}` : '') };
  }

  const icon = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    calendarOk: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M9 15l2 2 4-4"/></svg>',
  };

  // ─── Toast mit Rückgängig ──────────────────────────────────────────
  let toastTimer = null;
  function toast(text, actionLabel, action) {
    const el = $('#toast');
    $('#toast-text').textContent = text;
    const btn = $('#toast-action');
    btn.hidden = !actionLabel;
    btn.textContent = actionLabel || '';
    btn.onclick = () => { el.hidden = true; action && action(); };
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, actionLabel ? 5000 : 2500);
  }

  /** Entfernt einen Eintrag, mit Rückgängig-Möglichkeit. */
  function removeItem(type, id, message) {
    const list = data[COLLECTION[type]];
    const index = list.findIndex((x) => x.id === id);
    if (index < 0) return;
    const [item] = list.splice(index, 1);
    save();
    render();
    toast(message, 'Rückgängig', () => {
      list.splice(Math.min(index, list.length), 0, item);
      save();
      render();
    });
  }

  // ─── Rendern ───────────────────────────────────────────────────────
  function render() {
    document.querySelectorAll('.view').forEach((v) => { v.hidden = v.dataset.view !== ui.tab; });
    document.querySelectorAll('.tab').forEach((t) => {
      const active = t.dataset.tab === ui.tab;
      t.classList.toggle('active', active);
      if (active) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
    });
    $('#page-title').textContent = TITLES[ui.tab];
    $('#composer-input').placeholder = PLACEHOLDERS[ui.tab];
    renderTodos();
    renderReminders();
    renderThoughts();
    renderBadges();
  }

  function renderBadges() {
    const t = todayStr();
    const now = new Date();
    const todoCount = data.todos.filter((x) => x.due && x.due <= t).length;
    const remCount = data.reminders.filter((r) => new Date(r.at) <= now).length;
    const setBadge = (el, n) => { el.hidden = n === 0; el.textContent = n; };
    setBadge($('#badge-todo'), todoCount);
    setBadge($('#badge-reminder'), remCount);
  }

  function todoRank(x, t) {
    if (x.due && x.due < t) return 0;
    if (x.due === t) return 1;
    if (x.priority) return 2;
    if (x.due) return 3;
    return 4;
  }

  function renderTodos() {
    if (ui.filter !== 'all' && !data.categories.some((c) => c.id === ui.filter)) ui.filter = 'all';
    const counts = {};
    data.todos.forEach((x) => { counts[x.categoryId] = (counts[x.categoryId] || 0) + 1; });
    const chip = (id, name, color, n) =>
      `<button class="chip" data-filter="${esc(id)}" aria-pressed="${ui.filter === id}" style="--c:${esc(color || '')}">` +
      (color ? '<span class="dot"></span>' : '') + `${esc(name)} <span class="count">${n}</span></button>`;
    $('#category-filter').innerHTML = chip('all', 'Alle', null, data.todos.length) +
      data.categories.map((c) => chip(c.id, c.name, c.color, counts[c.id] || 0)).join('');

    const t = todayStr();
    const items = data.todos
      .filter((x) => ui.filter === 'all' || x.categoryId === ui.filter)
      .sort((a, b) => todoRank(a, t) - todoRank(b, t)
        || (a.priority === b.priority ? 0 : a.priority ? -1 : 1)
        || (a.due || '9999').localeCompare(b.due || '9999')
        || (a.dueTime || '99').localeCompare(b.dueTime || '99')
        || b.createdAt - a.createdAt);

    $('#todo-list').innerHTML = items.map((x) => {
      const c = category(x.categoryId);
      const due = dueInfo(x);
      return `<li class="item" data-id="${x.id}" style="--c:${esc(c.color)}">
        <button class="check" data-action="done" aria-label="Erledigt: ${esc(x.text)}">${icon.check}</button>
        <button class="item-body" data-action="edit">
          <div class="item-text">${x.priority ? '<span class="prio" aria-label="wichtig">!</span>' : ''}${esc(x.text)}</div>
          <div class="item-meta">
            ${ui.filter === 'all' ? `<span class="cat">${esc(c.name)}</span>` : ''}
            ${due ? `<span class="due ${due.cls}">${esc(due.label)}</span>` : ''}
          </div>
        </button>
      </li>`;
    }).join('');

    const empty = $('#view-todo .empty');
    if (empty) empty.remove();
    if (!items.length) {
      $('#todo-list').insertAdjacentHTML('afterend', data.todos.length
        ? '<p class="empty"><strong>Nichts in dieser Kategorie</strong>Wähle „Alle“, um alles zu sehen.</p>'
        : '<p class="empty"><strong>Alles erledigt</strong>Tippe unten etwas ein oder nutze das Mikrofon.</p>');
    }
  }

  function renderReminders() {
    const now = new Date();
    const t = todayStr();
    const tm = tomorrowStr();
    const groups = { overdue: [], today: [], tomorrow: [], later: [] };
    [...data.reminders].sort((a, b) => a.at.localeCompare(b.at)).forEach((r) => {
      const day = r.at.slice(0, 10);
      if (new Date(r.at) <= now) groups.overdue.push(r);
      else if (day === t) groups.today.push(r);
      else if (day === tm) groups.tomorrow.push(r);
      else groups.later.push(r);
    });
    const titles = { overdue: 'Fällig', today: 'Heute', tomorrow: 'Morgen', later: 'Später' };
    const row = (r, group) => {
      const day = r.at.slice(0, 10);
      const time = r.at.slice(11, 16);
      const when = group === 'today' || group === 'tomorrow' ? time : `${dayLabel(day)}, ${time}`;
      return `<li class="item" data-id="${r.id}" style="--c:var(--accent)">
        <button class="check" data-action="done" aria-label="Erledigt: ${esc(r.text)}">${icon.check}</button>
        <button class="item-body" data-action="edit">
          <div class="item-text">${esc(r.text)}</div>
          <div class="item-meta"><span class="due ${group === 'overdue' ? 'overdue' : ''}">${esc(when)}</span></div>
        </button>
        <button class="item-side ${r.calendarAdded ? 'added' : ''}" data-action="calendar"
          aria-label="${r.calendarAdded ? 'Erneut in Kalender übernehmen' : 'In Kalender übernehmen'}">${r.calendarAdded ? icon.calendarOk : icon.calendar}</button>
      </li>`;
    };
    const html = Object.keys(groups).filter((g) => groups[g].length).map((g) =>
      `<h2 class="group-title ${g === 'overdue' ? 'overdue' : ''}">${titles[g]}</h2>
       <ul class="list">${groups[g].map((r) => row(r, g)).join('')}</ul>`).join('');
    $('#reminder-list').innerHTML = html ||
      '<p class="empty"><strong>Keine Erinnerungen</strong>Sag zum Beispiel: „Erinnere mich morgen um 9 an den Zahnarzt“.</p>';
  }

  function relTime(ts) {
    const d = new Date(ts);
    const day = ymd(d);
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (day === todayStr()) return `Heute, ${time}`;
    if (day === yesterdayStr()) return `Gestern, ${time}`;
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return sameYear ? fmtDayMonth.format(d) : d.toLocaleDateString('de-DE');
  }

  function renderThoughts() {
    const counts = {};
    data.thoughts.forEach((x) => x.tags.forEach((tag) => { counts[tag] = (counts[tag] || 0) + 1; }));
    const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
    if (ui.tag && !counts[ui.tag]) ui.tag = null;
    $('#tag-filter').innerHTML = tags.length
      ? `<button class="chip" data-tag="" aria-pressed="${!ui.tag}">Alle</button>` +
        tags.map((tag) => `<button class="chip" data-tag="${esc(tag)}" aria-pressed="${ui.tag === tag}">#${esc(tag)} <span class="count">${counts[tag]}</span></button>`).join('')
      : '';
    $('#tag-filter').hidden = !tags.length;

    const q = $('#thought-search').value.trim().toLowerCase();
    const items = data.thoughts
      .filter((x) => !ui.tag || x.tags.includes(ui.tag))
      .filter((x) => !q || x.text.toLowerCase().includes(q) || x.tags.some((tag) => tag.includes(q.replace(/^#/, ''))))
      .sort((a, b) => b.createdAt - a.createdAt);

    $('#thought-list').innerHTML = items.map((x) => `
      <button class="card" data-id="${x.id}" data-action="edit">
        <div class="card-text">${esc(x.text)}</div>
        <div class="card-foot">${x.tags.map((tag) => `<span class="tag">#${esc(tag)}</span>`).join('')}
          <span class="card-date">${esc(relTime(x.createdAt))}</span></div>
      </button>`).join('') ||
      (data.thoughts.length
        ? '<p class="empty"><strong>Nichts gefunden</strong></p>'
        : '<p class="empty"><strong>Noch keine Gedanken</strong>Sag „Idee …“ oder tippe einfach los. Mit „Hashtag Buch“ vergibst du Schlagworte.</p>');
  }

  // ─── Einträge anlegen ──────────────────────────────────────────────
  function defaultCategory() {
    return ui.filter !== 'all' ? ui.filter : FALLBACK_CATEGORY;
  }

  function createFromParsed(p) {
    const base = { id: uid(), text: p.text, createdAt: Date.now() };
    if (p.type === 'todo') {
      data.todos.push({ ...base, categoryId: p.categoryId || defaultCategory(), priority: p.priority, due: p.date, dueTime: p.date ? p.time : null });
    } else if (p.type === 'reminder') {
      data.reminders.push({ ...base, at: `${p.date}T${p.time || '09:00'}`, calendarAdded: false });
    } else {
      data.thoughts.push({ ...base, tags: p.tags });
    }
    save();
    return base.id;
  }

  const TYPE_NAMES = { todo: 'ToDo', reminder: 'Erinnerung', thought: 'Gedanke' };

  function quickAdd(text) {
    const p = parse(text, { context: ui.tab, categories: data.categories });
    if (!p.text) return;
    if (p.type === 'reminder' && !p.date) {
      // Ohne Zeitpunkt geht's nicht – im Sheet nachfragen.
      openSheet({ mode: 'new', parsed: p });
      return;
    }
    const id = createFromParsed(p);
    render();
    const where = p.type === ui.tab ? 'Gespeichert' : `Als ${TYPE_NAMES[p.type]} gespeichert`;
    toast(where, 'Rückgängig', () => {
      const list = data[COLLECTION[p.type]];
      const i = list.findIndex((x) => x.id === id);
      if (i >= 0) list.splice(i, 1);
      save();
      render();
    });
  }

  // ─── Sheet: Neu / Bearbeiten ───────────────────────────────────────
  const form = $('#item-form');
  const f = {
    text: $('#f-text'), dueDate: $('#f-due-date'), dueTime: $('#f-due-time'), priority: $('#f-priority'),
    remDate: $('#f-rem-date'), remTime: $('#f-rem-time'), toCalendar: $('#f-to-calendar'), tags: $('#f-tags'),
  };
  let sheet = null; // { mode, type, id, touched, categoryId }

  function currentType() { return form.querySelector('input[name="type"]:checked').value; }
  function setType(type) {
    form.querySelector(`input[name="type"][value="${type}"]`).checked = true;
    updateTypeFields();
  }
  function updateTypeFields() {
    const type = currentType();
    form.querySelectorAll('.field-group').forEach((g) => { g.hidden = g.dataset.for !== type; });
    $('#convert-btn').hidden = !(sheet && sheet.mode === 'edit' && sheet.type === 'thought' && type === 'thought');
    $('#calendar-btn').hidden = !(sheet && sheet.mode === 'edit' && type === 'reminder');
    f.text.placeholder = { todo: 'Was ist zu tun?', reminder: 'Woran soll ich dich erinnern?', thought: 'Was geht dir durch den Kopf?' }[type];
  }

  function renderCategoryPicker() {
    $('#f-category').innerHTML = data.categories.map((c) =>
      `<button type="button" class="chip" role="radio" data-cat="${esc(c.id)}" aria-checked="${sheet.categoryId === c.id}" style="--c:${esc(c.color)}"><span class="dot"></span>${esc(c.name)}</button>`).join('');
  }

  /**
   * Überträgt ein Parser-Ergebnis in die Felder. Bei der Live-Erkennung (live: true)
   * werden nur gefundene Werte gesetzt, damit Nachbearbeiten nichts wieder leert.
   */
  function fillFromParsed(p, { live } = {}) {
    if (!live) f.text.value = p.text;
    if (p.type !== currentType()) {
      if (live && sheet.typeChosen) p = { ...p, type: currentType() };
      else setType(p.type);
    }
    if (p.type === 'todo') {
      if (p.categoryId) sheet.categoryId = p.categoryId;
      if (p.priority || !live) f.priority.checked = p.priority;
      if (p.date || !live) {
        f.dueDate.value = p.date || '';
        f.dueTime.value = p.date && p.time ? p.time : '';
      }
      renderCategoryPicker();
    } else if (p.type === 'reminder') {
      if (p.date || !live) {
        f.remDate.value = p.date || '';
        f.remTime.value = p.date ? (p.time || '09:00') : '';
      }
    } else if (p.tags.length || !live) {
      f.tags.value = p.tags.map((t) => '#' + t).join(' ');
    }
  }

  function openSheet({ mode, type, item, parsed, dictationHint }) {
    sheet = { mode, type: type || (parsed && parsed.type) || ui.tab, id: item ? item.id : null, touched: false, categoryId: defaultCategory() };
    form.reset();
    f.toCalendar.checked = ui.toCalendar;
    $('#sheet-title').textContent = mode === 'edit' ? 'Bearbeiten' : 'Neu';
    $('#delete-btn').hidden = mode !== 'edit';
    $('#dictation-hint').hidden = !dictationHint;
    setType(sheet.type);

    if (mode === 'edit') {
      f.text.value = item.text;
      if (sheet.type === 'todo') {
        sheet.categoryId = item.categoryId;
        f.dueDate.value = item.due || '';
        f.dueTime.value = item.dueTime || '';
        f.priority.checked = !!item.priority;
      } else if (sheet.type === 'reminder') {
        f.remDate.value = item.at.slice(0, 10);
        f.remTime.value = item.at.slice(11, 16);
        f.toCalendar.checked = false;
      } else {
        f.tags.value = item.tags.map((t) => '#' + t).join(' ');
      }
    } else if (parsed) {
      fillFromParsed(parsed);
    }
    renderCategoryPicker();
    updateTypeFields();
    $('#sheet').hidden = false;
    if (mode === 'new' && !parsed) f.text.focus();
  }

  function closeSheet() {
    $('#sheet').hidden = true;
    sheet = null;
    f.text.blur();
  }

  function parseTags(s) {
    return [...new Set(s.split(/[\s,]+/).map((t) => t.replace(/^#+/, '').toLowerCase()).filter(Boolean))];
  }

  function submitSheet() {
    const type = currentType();
    let text = f.text.value.trim();
    if (!text) { f.text.focus(); return; }
    if (type === 'reminder' && !f.remDate.value) {
      toast('Bitte ein Datum wählen');
      f.remDate.focus();
      return;
    }

    // Typ gewechselt beim Bearbeiten → aus alter Liste entfernen
    let old = null;
    if (sheet.mode === 'edit') {
      const list = data[COLLECTION[sheet.type]];
      const i = list.findIndex((x) => x.id === sheet.id);
      if (i >= 0) old = list[i];
      if (old && type !== sheet.type) list.splice(i, 1);
    }

    const base = { id: old ? old.id : uid(), text, createdAt: old ? old.createdAt : Date.now() };
    let item;
    if (type === 'todo') {
      item = { ...base, categoryId: sheet.categoryId || FALLBACK_CATEGORY, priority: f.priority.checked, due: f.dueDate.value || null, dueTime: f.dueDate.value && f.dueTime.value ? f.dueTime.value : null };
    } else if (type === 'reminder') {
      const at = `${f.remDate.value}T${f.remTime.value || '09:00'}`;
      const sameTime = old && sheet.type === 'reminder' && old.at === at;
      item = { ...base, at, calendarAdded: sameTime ? !!old.calendarAdded : false };
    } else {
      item = { ...base, tags: parseTags(f.tags.value) };
    }

    const list = data[COLLECTION[type]];
    const existing = list.findIndex((x) => x.id === item.id);
    if (existing >= 0) list[existing] = item; else list.push(item);

    const wantCalendar = type === 'reminder' && sheet.mode === 'new' && f.toCalendar.checked;
    if (type === 'reminder' && sheet.mode === 'new') { ui.toCalendar = f.toCalendar.checked; saveUi(); }
    const savedType = type;
    closeSheet();
    if (savedType !== ui.tab) { ui.tab = savedType; saveUi(); }
    save();
    render();
    if (wantCalendar) addToCalendar(item);
    else toast('Gespeichert');
  }

  // Live-Erkennung beim Tippen/Diktieren im Sheet (nur bei neuen Einträgen,
  // solange die Felder nicht von Hand geändert wurden).
  let parseTimer = null;
  f.text.addEventListener('input', () => {
    if (!sheet || sheet.mode !== 'new' || sheet.touched) return;
    clearTimeout(parseTimer);
    parseTimer = setTimeout(() => {
      const p = parse(f.text.value, { context: currentType(), categories: data.categories });
      // Den Text selbst nicht umschreiben, solange getippt wird – die Felder schon.
      fillFromParsed(p, { live: true });
      sheet.cleanText = p.text;
    }, 400);
  });
  f.text.addEventListener('blur', () => {
    if (sheet && sheet.mode === 'new' && !sheet.touched && sheet.cleanText && sheet.cleanText !== f.text.value.trim()) {
      f.text.value = sheet.cleanText;
    }
  });
  [f.dueDate, f.dueTime, f.priority, f.remDate, f.remTime, f.tags].forEach((el) =>
    el.addEventListener('input', () => { if (sheet) sheet.touched = true; }));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (sheet && sheet.mode === 'new' && !sheet.touched && sheet.cleanText) f.text.value = sheet.cleanText;
    submitSheet();
  });
  form.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener('change', () => {
    // Von Hand gewählter Bereich wird von der Live-Erkennung nicht mehr überschrieben.
    if (sheet) sheet.typeChosen = true;
    updateTypeFields();
  }));
  $('#f-category').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b || !sheet) return;
    sheet.categoryId = b.dataset.cat;
    sheet.touched = true;
    renderCategoryPicker();
  });
  $('#quick-times').addEventListener('click', (e) => {
    const b = e.target.closest('[data-quick]');
    if (!b) return;
    const d = new Date();
    if (b.dataset.quick === '1h') { d.setHours(d.getHours() + 1); }
    else if (b.dataset.quick === 'tonight') { d.setHours(19, 0); }
    else { d.setDate(d.getDate() + 1); d.setHours(9, 0); }
    f.remDate.value = ymd(d);
    f.remTime.value = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    sheet.touched = true;
  });
  $('#delete-btn').addEventListener('click', () => {
    const { type, id } = sheet;
    closeSheet();
    removeItem(type, id, 'Gelöscht');
  });
  $('#convert-btn').addEventListener('click', () => {
    sheet.touched = true;
    setType('todo');
    renderCategoryPicker();
  });
  $('#calendar-btn').addEventListener('click', () => {
    const item = data.reminders.find((r) => r.id === sheet.id);
    if (!item) return;
    const at = `${f.remDate.value}T${f.remTime.value || '09:00'}`;
    addToCalendar({ ...item, text: f.text.value.trim() || item.text, at });
  });

  // ─── Kalender (.ics) ───────────────────────────────────────────────
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => '\\' + c); }
  function icsDate(d) {
    return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
  }

  function buildIcs(r) {
    const start = new Date(r.at);
    const end = new Date(start.getTime() + 15 * 60000);
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    return [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//ToDos//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${r.id}@todos`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${icsDate(start)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${icsEscape(r.text)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(r.text)}`, 'TRIGGER:PT0M', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
  }

  function addToCalendar(r) {
    const ics = buildIcs(r);
    if (isIOS) {
      // Safari öffnet text/calendar direkt mit „Zum Kalender hinzufügen“.
      window.location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
    } else {
      const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'erinnerung.ics' });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    const stored = data.reminders.find((x) => x.id === r.id);
    if (stored && stored.at === r.at) { stored.calendarAdded = true; save(); render(); }
  }

  // ─── Listen-Interaktion ────────────────────────────────────────────
  function onListClick(type) {
    return (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const row = btn.closest('[data-id]');
      const id = row.dataset.id;
      const item = data[COLLECTION[type]].find((x) => x.id === id);
      if (!item) return;
      if (btn.dataset.action === 'edit') openSheet({ mode: 'edit', type, item });
      else if (btn.dataset.action === 'calendar') addToCalendar(item);
      else if (btn.dataset.action === 'done') {
        btn.classList.add('done');
        row.classList.add('leaving');
        setTimeout(() => removeItem(type, id, 'Erledigt'), 260);
      }
    };
  }
  $('#todo-list').addEventListener('click', onListClick('todo'));
  $('#reminder-list').addEventListener('click', onListClick('reminder'));
  $('#thought-list').addEventListener('click', onListClick('thought'));

  $('#category-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-filter]');
    if (!b) return;
    ui.filter = b.dataset.filter;
    saveUi();
    renderTodos();
  });
  $('#tag-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tag]');
    if (!b) return;
    ui.tag = b.dataset.tag || null;
    saveUi();
    renderThoughts();
  });
  $('#thought-search').addEventListener('input', renderThoughts);

  document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => {
    ui.tab = t.dataset.tab;
    saveUi();
    render();
    window.scrollTo(0, 0);
  }));

  $('#composer').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#composer-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    quickAdd(text);
  });
  $('#composer-more').addEventListener('click', () => {
    const input = $('#composer-input');
    const text = input.value.trim();
    input.value = '';
    if (text) openSheet({ mode: 'new', parsed: parse(text, { context: ui.tab, categories: data.categories }) });
    else openSheet({ mode: 'new' });
  });

  // Schließen per Hintergrund / Abbrechen
  document.querySelectorAll('.sheet-backdrop').forEach((bd) => {
    bd.addEventListener('click', (e) => {
      if (e.target === bd || e.target.closest('[data-close]')) {
        if (bd.id === 'sheet') closeSheet(); else { bd.hidden = true; render(); }
      }
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!$('#sheet').hidden) closeSheet();
    else if (!$('#settings').hidden) { $('#settings').hidden = true; render(); }
  });

  // ─── Spracheingabe ─────────────────────────────────────────────────
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let speechUnavailable = !SR;
  let rec = null;

  function fallbackToKeyboard() {
    speechUnavailable = true;
    $('#listening').hidden = true;
    openSheet({ mode: 'new', dictationHint: true });
  }

  function startListening() {
    if (speechUnavailable) { fallbackToKeyboard(); return; }
    let heard = '';
    let cancelled = false;
    let failed = false;
    const out = $('#listen-text');
    out.textContent = 'Ich höre zu …';
    out.classList.add('interim');
    $('#listening').hidden = false;

    try {
      rec = new SR();
    } catch {
      fallbackToKeyboard();
      return;
    }
    rec.lang = 'de-DE';
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      let finalText = '';
      let interim = '';
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript;
        else interim += e.results[i][0].transcript;
      }
      // Auch Zwischenergebnisse merken – Safari liefert manchmal kein finales.
      heard = (finalText + ' ' + interim).trim();
      out.textContent = heard || 'Ich höre zu …';
      out.classList.toggle('interim', !finalText);
    };
    rec.onerror = (e) => {
      if (e.error === 'aborted') return;
      failed = true;
      $('#listening').hidden = true;
      if (e.error === 'no-speech') toast('Nichts gehört – nochmal versuchen?');
      else fallbackToKeyboard(); // not-allowed, service-not-allowed, network, audio-capture …
    };
    rec.onend = () => {
      rec = null;
      if (cancelled || failed) return;
      $('#listening').hidden = true;
      if (!heard) { toast('Nichts verstanden – nochmal versuchen?'); return; }
      openSheet({ mode: 'new', parsed: parse(heard, { context: ui.tab, categories: data.categories }) });
    };

    $('#listen-cancel').onclick = () => { cancelled = true; $('#listening').hidden = true; if (rec) rec.abort(); };
    $('#listen-done').onclick = () => { if (rec) rec.stop(); else $('#listening').hidden = true; };

    try {
      rec.start();
    } catch {
      fallbackToKeyboard();
    }
  }
  $('#mic-btn').addEventListener('click', startListening);

  // ─── Einstellungen ─────────────────────────────────────────────────
  function renderSettings() {
    $('#category-list').innerHTML = data.categories.map((c) => `
      <li data-id="${esc(c.id)}">
        <button type="button" class="color-btn" style="--c:${esc(c.color)}" data-action="color" aria-label="Farbe von ${esc(c.name)} ändern"></button>
        <input class="cat-name" value="${esc(c.name)}" maxlength="24" aria-label="Name der Kategorie">
        ${c.id === FALLBACK_CATEGORY ? '' : `<button type="button" class="cat-delete" data-action="delete">Löschen</button>`}
      </li>`).join('');
    const info = $('#backup-info');
    info.textContent = ui.lastBackup
      ? `Letztes Backup: ${new Date(ui.lastBackup).toLocaleDateString('de-DE')}`
      : 'Noch kein Backup. Exportiere ab und zu eine Sicherung, z. B. in die Dateien-App oder iCloud Drive.';
  }

  $('#settings-btn').addEventListener('click', () => { renderSettings(); $('#settings').hidden = false; });

  $('#category-list').addEventListener('click', (e) => {
    const b = e.target.closest('[data-action]');
    if (!b) return;
    const id = b.closest('li').dataset.id;
    const c = data.categories.find((x) => x.id === id);
    if (b.dataset.action === 'color') {
      c.color = COLORS[(COLORS.indexOf(c.color) + 1) % COLORS.length];
    } else if (b.dataset.action === 'delete') {
      const n = data.todos.filter((t) => t.categoryId === id).length;
      const msg = n ? `„${c.name}“ löschen? ${n} ToDo(s) wandern nach „Sonstiges“.` : `„${c.name}“ löschen?`;
      if (!confirm(msg)) return;
      data.todos.forEach((t) => { if (t.categoryId === id) t.categoryId = FALLBACK_CATEGORY; });
      data.categories = data.categories.filter((x) => x.id !== id);
    }
    save();
    renderSettings();
  });
  $('#category-list').addEventListener('change', (e) => {
    if (!e.target.classList.contains('cat-name')) return;
    const c = data.categories.find((x) => x.id === e.target.closest('li').dataset.id);
    const name = e.target.value.trim();
    if (name) c.name = name; else e.target.value = c.name;
    save();
  });
  $('#add-category-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#new-category');
    const name = input.value.trim();
    if (!name) return;
    if (data.categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) { toast('Gibt es schon'); return; }
    const used = data.categories.map((c) => c.color);
    data.categories.push({ id: uid(), name, color: COLORS.find((col) => !used.includes(col)) || COLORS[data.categories.length % COLORS.length] });
    input.value = '';
    save();
    renderSettings();
  });

  $('#export-btn').addEventListener('click', async () => {
    const json = JSON.stringify(data, null, 2);
    const name = `todos-backup-${todayStr()}.json`;
    const file = new File([json], name, { type: 'application/json' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'ToDos-Backup' });
      } else {
        const url = URL.createObjectURL(file);
        const a = Object.assign(document.createElement('a'), { href: url, download: name });
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      ui.lastBackup = Date.now();
      saveUi();
      renderSettings();
    } catch (err) {
      if (err && err.name !== 'AbortError') toast('Export fehlgeschlagen');
    }
  });

  $('#import-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!isValidData(imported)) throw new Error('format');
      const n = imported.todos.length + imported.reminders.length + imported.thoughts.length;
      if (!confirm(`Backup mit ${n} Einträgen laden? Die aktuellen Daten werden ersetzt.`)) return;
      data = imported;
      if (!data.categories.some((c) => c.id === FALLBACK_CATEGORY)) data.categories.push({ ...DEFAULT_CATEGORIES.at(-1) });
      save();
      renderSettings();
      render();
      toast('Backup geladen');
    } catch {
      toast('Das ist keine gültige Backup-Datei');
    }
  });

  // ─── Start ─────────────────────────────────────────────────────────
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (isIOS && !standalone && !ui.hintClosed) $('#install-hint').hidden = false;
  $('#install-hint-close').addEventListener('click', () => {
    $('#install-hint').hidden = true;
    ui.hintClosed = true;
    saveUi();
  });

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  render();
  // Fälligkeiten aktuell halten
  setInterval(() => { renderReminders(); renderTodos(); renderBadges(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });
})();
