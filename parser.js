/*
 * Regelbasierter Parser für Spracheingaben (Deutsch).
 * Erkennt Bereich (ToDo / Erinnerung / Gedanke), Datum, Uhrzeit, Kategorie,
 * Priorität und Schlagworte und liefert den bereinigten Text zurück.
 * Läuft im Browser (window.TodoParser) und in Node (für die Tests).
 */
(function (root) {
  'use strict';

  // Wortgrenzen, die auch mit Umlauten funktionieren (\b tut das in JS nicht).
  const B = '(?<![\\p{L}\\p{N}])';
  const E = '(?![\\p{L}\\p{N}])';
  const rx = (src, flags = 'iu') => new RegExp(B + src + E, flags);

  const NUMBER_WORDS = {
    null: 0, ein: 1, eins: 1, eine: 1, einen: 1, einem: 1, einer: 1,
    zwei: 2, drei: 3, vier: 4, 'fünf': 5, sechs: 6, sieben: 7, acht: 8, neun: 9,
    zehn: 10, elf: 11, 'zwölf': 12, dreizehn: 13, vierzehn: 14, 'fünfzehn': 15,
    sechzehn: 16, siebzehn: 17, achtzehn: 18, neunzehn: 19, zwanzig: 20,
    dreiundzwanzig: 23, 'dreißig': 30, vierzig: 40, 'fünfundvierzig': 45, 'fünfzig': 50,
  };
  const NUM = '(\\d{1,2}|' + Object.keys(NUMBER_WORDS).sort((a, b) => b.length - a.length).join('|') + ')';
  // Ohne „Uhr“ keine Artikel wie „einen“ als Zahl werten („um einen Termin …“).
  const NUM_BARE = '(\\d{1,2}|eins|zwei|drei|vier|fünf|sechs|sieben|acht|neun|zehn|elf|zwölf)';
  const toNum = (s) => {
    if (s == null) return null;
    const n = parseInt(s, 10);
    return Number.isNaN(n) ? NUMBER_WORDS[s.toLowerCase()] : n;
  };

  const WEEKDAYS = ['sonntag', 'montag', 'dienstag', 'mittwoch', 'donnerstag', 'freitag', 'samstag'];
  const MONTHS = ['januar', 'februar', 'märz', 'april', 'mai', 'juni', 'juli',
    'august', 'september', 'oktober', 'november', 'dezember'];

  const pad = (n) => String(n).padStart(2, '0');
  const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  /** Entfernt den Treffer aus dem Text und gibt den Rest zurück. */
  function cut(text, m) {
    return (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim();
  }

  // ─── Bereich ───────────────────────────────────────────────────────
  function detectType(text, context) {
    let m;
    // „Erinnere mich …“ darf irgendwo im Satz stehen.
    if ((m = text.match(rx('(erinnere?|erinner) mich( bitte)?( daran)?,?( dass)?')))) {
      return { type: 'reminder', text: cut(text, m), autoTag: null };
    }
    if ((m = text.match(new RegExp('^' + B + '(erinnerung|reminder)' + E + '[:,.]?', 'iu')))) {
      return { type: 'reminder', text: cut(text, m), autoTag: null };
    }
    if ((m = text.match(new RegExp('^' + B + '(gedanke|notiz|idee)' + E + '[:,.]?', 'iu')))) {
      return { type: 'thought', text: cut(text, m), autoTag: m[1].toLowerCase() === 'idee' ? 'idee' : null };
    }
    if ((m = text.match(new RegExp('^' + B + '(to-?do|aufgabe)' + E + '[:,.]?', 'iu')))) {
      return { type: 'todo', text: cut(text, m), autoTag: null };
    }
    return { type: context || 'todo', text, autoTag: null };
  }

  // ─── Schlagworte ───────────────────────────────────────────────────
  function normalizeHashtags(text) {
    // Gesprochen kommt „Hashtag Buch“ statt „#Buch“.
    return text.replace(rx('(hashtag|schlagwort)\\s+([\\p{L}\\p{N}_-]+)', 'giu'), '#$2');
  }

  function extractTags(text) {
    const tags = [];
    const rest = text.replace(/#([\p{L}\p{N}_-]+)/gu, (_, t) => {
      const tag = t.toLowerCase();
      if (!tags.includes(tag)) tags.push(tag);
      return ' ';
    });
    return { tags, text: rest.replace(/\s+/g, ' ').trim() };
  }

  // ─── Kategorie ─────────────────────────────────────────────────────
  function findCategory(name, categories) {
    const n = name.toLowerCase();
    return categories.find((c) => c.name.toLowerCase() === n)
      || categories.find((c) => c.name.toLowerCase().startsWith(n) || n.startsWith(c.name.toLowerCase()));
  }

  function extractCategory(text, categories) {
    let m;
    if ((m = text.match(rx('kategorie\\s+([\\p{L}\\p{N}_-]+)')))) {
      const cat = findCategory(m[1], categories);
      if (cat) return { categoryId: cat.id, text: cut(text, m) };
    }
    const re = /#([\p{L}\p{N}_-]+)/gu;
    while ((m = re.exec(text))) {
      const cat = findCategory(m[1], categories);
      if (cat) return { categoryId: cat.id, text: cut(text, m) };
    }
    return { categoryId: null, text };
  }

  // ─── Priorität ─────────────────────────────────────────────────────
  function extractPriority(text) {
    const m = text.match(rx('(sehr wichtig|wichtig|dringend|priorität hoch|hohe priorität)'));
    return m ? { priority: true, text: cut(text, m) } : { priority: false, text };
  }

  // ─── Datum & Uhrzeit ───────────────────────────────────────────────
  function extractDateTime(text, now) {
    let date = null;      // Date (Tagesbeginn)
    let hour = null;
    let minute = 0;
    let period = null;    // 'morning' | 'noon' | 'afternoon' | 'evening' | 'night'
    let exact = null;     // exakter Zeitpunkt aus „in 2 Stunden“
    let m;
    const today = startOfDay(now);

    // „in 3 Tagen“, „in einer halben Stunde“, „in 2 Wochen“
    if ((m = text.match(rx('in (einer )?(halben|viertel) ?stunde')))) {
      exact = new Date(now.getTime() + (m[2].toLowerCase() === 'halben' ? 30 : 15) * 60000);
      text = cut(text, m);
    } else if ((m = text.match(rx('in ' + NUM + ' (minuten?|stunden?|tag(?:en)?|wochen?|monat(?:en)?)')))) {
      const n = toNum(m[1]);
      const unit = m[2].toLowerCase();
      if (unit.startsWith('minute')) exact = new Date(now.getTime() + n * 60000);
      else if (unit.startsWith('stunde')) exact = new Date(now.getTime() + n * 3600000);
      else if (unit.startsWith('tag')) date = addDays(today, n);
      else if (unit.startsWith('woche')) date = addDays(today, 7 * n);
      else { date = new Date(today); date.setMonth(date.getMonth() + n); }
      text = cut(text, m);
    }

    // Tageszeit-Kombinationen zuerst, damit „morgen früh“ nicht doppelt zählt.
    const periods = [
      ['(früh|morgens|vormittags|am morgen|am vormittag)', 'morning'],
      ['(mittags|am mittag)', 'noon'],
      ['(nachmittags|am nachmittag)', 'afternoon'],
      ['(abends|am abend)', 'evening'],
      ['(nachts|in der nacht)', 'night'],
    ];

    if (!date && !exact) {
      const PERIOD_WORDS = { morgen: 'morning', 'früh': 'morning', vormittag: 'morning', mittag: 'noon',
        nachmittag: 'afternoon', abend: 'evening', nacht: 'night' };
      if ((m = text.match(rx('(bis )?(heute|morgen|übermorgen)( (morgen|früh|vormittag|mittag|nachmittag|abend|nacht))?')))) {
        const offset = { heute: 0, morgen: 1, 'übermorgen': 2 }[m[2].toLowerCase()];
        date = addDays(today, offset);
        if (m[4]) period = PERIOD_WORDS[m[4].toLowerCase()];
        text = cut(text, m);
      }
    }

    if (!date && !exact) {
      const wd = WEEKDAYS.join('|');
      if ((m = text.match(rx('(bis |am |ab )?(nächsten|nächste|kommenden|diesen|diese)? ?(' + wd + ')')))) {
        const target = WEEKDAYS.indexOf(m[3].toLowerCase());
        let diff = (target - today.getDay() + 7) % 7;
        if (diff === 0) diff = 7;
        date = addDays(today, diff);
        text = cut(text, m);
      } else if ((m = text.match(rx('(bis |am )?wochenende')))) {
        const diff = (6 - today.getDay() + 7) % 7 || 7;
        date = addDays(today, today.getDay() === 0 ? 6 : diff);
        text = cut(text, m);
      } else if ((m = text.match(rx('(bis )?(nächste|kommende) woche')))) {
        const diff = (1 - today.getDay() + 7) % 7 || 7;
        date = addDays(today, diff);
        text = cut(text, m);
      }
    }

    if (!date && !exact) {
      const mo = MONTHS.join('|');
      if ((m = text.match(new RegExp(B + '(bis |am |zum )?(\\d{1,2})\\.(\\d{1,2})\\.(\\d{2,4})?', 'iu')))) {
        const day = +m[2];
        const month = +m[3] - 1;
        let year = m[4] ? +m[4] : today.getFullYear();
        if (year < 100) year += 2000;
        date = new Date(year, month, day);
        if (!m[4] && date < today) date.setFullYear(year + 1);
        text = cut(text, m);
      } else if ((m = text.match(rx('(bis |am |zum )?(\\d{1,2})\\.? (' + mo + ')( \\d{4})?')))) {
        const month = MONTHS.indexOf(m[3].toLowerCase());
        let year = m[4] ? +m[4] : today.getFullYear();
        date = new Date(year, month, +m[2]);
        if (!m[4] && date < today) date.setFullYear(year + 1);
        text = cut(text, m);
      }
    }

    // Uhrzeit
    if (!exact) {
      if ((m = text.match(rx('um (viertel nach|viertel vor|halb) ' + NUM + '( uhr)?')))) {
        const h = toNum(m[2]);
        const kind = m[1].toLowerCase();
        if (kind === 'halb') { hour = h - 1; minute = 30; }
        else if (kind === 'viertel nach') { hour = h; minute = 15; }
        else { hour = h - 1; minute = 45; }
        text = cut(text, m);
      } else if ((m = text.match(rx('(um |gegen |ab )?(\\d{1,2})[:.](\\d{2})( uhr)?')))) {
        hour = +m[2]; minute = +m[3];
        text = cut(text, m);
      } else if ((m = text.match(rx('(um |gegen |ab )?' + NUM + ' uhr( ' + NUM + ')?')))) {
        hour = toNum(m[2]); minute = m[4] ? toNum(m[4]) : 0;
        text = cut(text, m);
      } else if ((m = text.match(rx('(um|gegen) ' + NUM_BARE)))) {
        hour = toNum(m[2]);
        text = cut(text, m);
      }
    }

    if (!period) {
      for (const [src, p] of periods) {
        if ((m = text.match(rx(src)))) { period = p; text = cut(text, m); break; }
      }
    }

    if (hour != null && period) {
      if ((period === 'afternoon' || period === 'evening') && hour < 12) hour += 12;
      if (period === 'night' && hour >= 6 && hour < 12) hour += 12;
    } else if (hour != null && !period && hour >= 1 && hour <= 5) {
      // „um halb drei“ meint praktisch immer nachmittags.
      hour += 12;
    } else if (hour == null && period) {
      hour = { morning: 8, noon: 12, afternoon: 15, evening: 19, night: 22 }[period];
    }

    if (exact) {
      return { text, date: fmtDate(exact), time: `${pad(exact.getHours())}:${pad(exact.getMinutes())}` };
    }

    let time = null;
    if (hour != null && hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      time = `${pad(hour)}:${pad(minute)}`;
      if (!date) {
        // Nur eine Uhrzeit: heute, oder morgen, falls schon vorbei.
        date = today;
        const at = new Date(today); at.setHours(hour, minute);
        if (at <= now) date = addDays(today, 1);
      }
    }

    if (date && Number.isNaN(date.getTime())) date = null;
    return { text, date: date ? fmtDate(date) : null, time };
  }

  // ─── Aufräumen ─────────────────────────────────────────────────────
  function tidy(text, type) {
    let t = text.replace(/\s+/g, ' ').trim();
    // Übriggebliebene Füllwörter am Rand
    t = t.replace(/^(und|bitte|noch|,|:|-|–)\s+/iu, '');
    if (type === 'reminder') {
      t = t.replace(new RegExp('^' + B + '(daran,? dass|daran|dass|an (den|die|das|dem|der)|an)' + E + '\\s*', 'iu'), '');
    }
    t = t.replace(new RegExp('\\s+' + B + '(bis|am|um|an|zu|und)' + E + '$', 'iu'), '');
    t = t.replace(/^[\s,.:;–-]+|[\s,;:–-]+$/gu, '');
    return t ? t.charAt(0).toUpperCase() + t.slice(1) : t;
  }

  /**
   * @param {string} input   gesprochener oder getippter Text
   * @param {object} opts    { now: Date, context: 'todo'|'reminder'|'thought', categories: [{id,name}] }
   */
  function parse(input, opts = {}) {
    const now = opts.now || new Date();
    const categories = opts.categories || [];
    let text = normalizeHashtags(String(input || '').trim());

    const detected = detectType(text, opts.context);
    const type = detected.type;
    text = detected.text;

    const result = { type, text: '', categoryId: null, priority: false, date: null, time: null, tags: [] };

    if (type === 'thought') {
      const t = extractTags(text);
      result.tags = t.tags;
      if (detected.autoTag && !result.tags.includes(detected.autoTag)) result.tags.unshift(detected.autoTag);
      result.text = tidy(t.text, type);
      return result;
    }

    if (type === 'todo') {
      const c = extractCategory(text, categories);
      result.categoryId = c.categoryId;
      text = c.text;
      const p = extractPriority(text);
      result.priority = p.priority;
      text = p.text;
    }

    const dt = extractDateTime(text, now);
    result.date = dt.date;
    result.time = dt.time;
    result.text = tidy(dt.text, type);
    return result;
  }

  const api = { parse };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TodoParser = api;
})(typeof window !== 'undefined' ? window : globalThis);
