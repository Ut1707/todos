const test = require('node:test');
const assert = require('node:assert/strict');
const { parse } = require('../parser.js');

// Samstag, 03.10.2026, 10:00 Uhr
const now = new Date(2026, 9, 3, 10, 0);
const categories = [
  { id: 'arbeit', name: 'Arbeit' },
  { id: 'privat', name: 'Privat' },
  { id: 'finanzen', name: 'Finanzen' },
  { id: 'gesundheit', name: 'Gesundheit' },
];
const p = (text, context = 'todo') => parse(text, { now, context, categories });

test('Erinnerung mit „erinnere mich“, morgen und Uhrzeit', () => {
  const r = p('Erinnere mich morgen um 9 an den Zahnarzt');
  assert.equal(r.type, 'reminder');
  assert.equal(r.text, 'Zahnarzt');
  assert.equal(r.date, '2026-10-04');
  assert.equal(r.time, '09:00');
});

test('Erinnerung mitten im Satz', () => {
  const r = p('Morgen Abend erinnere mich daran, die Mülltonne rauszustellen');
  assert.equal(r.type, 'reminder');
  assert.equal(r.text, 'Die Mülltonne rauszustellen');
  assert.equal(r.date, '2026-10-04');
  assert.equal(r.time, '19:00');
});

test('Gedanke mit Idee-Schlüsselwort und gesprochenem Hashtag', () => {
  const r = p('Idee Hashtag Buch Kinderbuch über einen Drachen');
  assert.equal(r.type, 'thought');
  assert.equal(r.text, 'Kinderbuch über einen Drachen');
  assert.deepEqual(r.tags, ['idee', 'buch']);
});

test('Gedanke: Datumswörter bleiben im Text', () => {
  const r = p('Morgen ist auch noch ein Tag', 'thought');
  assert.equal(r.type, 'thought');
  assert.equal(r.text, 'Morgen ist auch noch ein Tag');
  assert.equal(r.date, null);
});

test('ToDo mit Wochentag, Priorität und Kategorie', () => {
  const r = p('Steuererklärung abgeben bis Freitag wichtig Kategorie Finanzen');
  assert.equal(r.type, 'todo');
  assert.equal(r.text, 'Steuererklärung abgeben');
  assert.equal(r.date, '2026-10-09');
  assert.equal(r.priority, true);
  assert.equal(r.categoryId, 'finanzen');
});

test('ToDo mit #kategorie', () => {
  const r = p('Meeting vorbereiten #arbeit');
  assert.equal(r.categoryId, 'arbeit');
  assert.equal(r.text, 'Meeting vorbereiten');
});

test('Relative Tage', () => {
  const r = p('In 3 Tagen Mama anrufen');
  assert.equal(r.text, 'Mama anrufen');
  assert.equal(r.date, '2026-10-06');
  assert.equal(r.time, null);
});

test('In zwei Stunden (Zahlwort)', () => {
  const r = p('In zwei Stunden Wäsche aufhängen', 'reminder');
  assert.equal(r.date, '2026-10-03');
  assert.equal(r.time, '12:00');
  assert.equal(r.text, 'Wäsche aufhängen');
});

test('In einer halben Stunde', () => {
  const r = p('in einer halben Stunde Ofen aus', 'reminder');
  assert.equal(r.time, '10:30');
});

test('Absolutes Datum mit Monatsnamen', () => {
  const r = p('Am 12. Oktober um 14:30 Uhr Friseur', 'reminder');
  assert.equal(r.date, '2026-10-12');
  assert.equal(r.time, '14:30');
  assert.equal(r.text, 'Friseur');
});

test('Absolutes Datum mit Punkten, vergangenes Datum → nächstes Jahr', () => {
  const r = p('Am 5.3. Versicherung kündigen');
  assert.equal(r.date, '2027-03-05');
  assert.equal(r.text, 'Versicherung kündigen');
});

test('Nur Uhrzeit, schon vorbei → morgen', () => {
  const r = p('um 8 Uhr joggen', 'reminder');
  assert.equal(r.date, '2026-10-04');
  assert.equal(r.time, '08:00');
});

test('Nur Uhrzeit, noch nicht vorbei → heute, mit abends', () => {
  const r = p('um 7 abends kochen', 'reminder');
  assert.equal(r.date, '2026-10-03');
  assert.equal(r.time, '19:00');
  assert.equal(r.text, 'Kochen');
});

test('Halb drei', () => {
  const r = p('Übermorgen um halb drei Elterngespräch', 'reminder');
  assert.equal(r.date, '2026-10-05');
  assert.equal(r.time, '14:30');
});

test('„um einen“ ist keine Uhrzeit', () => {
  const r = p('Anrufen um einen Termin zu machen');
  assert.equal(r.time, null);
  assert.equal(r.text, 'Anrufen um einen Termin zu machen');
});

test('Nächste Woche → Montag', () => {
  const r = p('nächste Woche Auto waschen');
  assert.equal(r.date, '2026-10-05');
});

test('Gleicher Wochentag → nächste Woche', () => {
  const r = p('Samstag Markt');
  assert.equal(r.date, '2026-10-10');
});

test('ToDo-Schlüsselwort aus anderem Tab', () => {
  const r = p('Aufgabe Fenster putzen', 'thought');
  assert.equal(r.type, 'todo');
  assert.equal(r.text, 'Fenster putzen');
});

test('Leere Eingabe', () => {
  const r = p('');
  assert.equal(r.text, '');
});
