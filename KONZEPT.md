# ToDos – Konzept

Mobile-first Web-App (PWA) für das iPhone, gehostet auf GitHub Pages.
Ersetzt den alten Telegram-Bot (`alt/todo_bot.py`) und die alte `alt/todos.html`.

## Entscheidungen (Interview 2026-10-03)

| Thema | Entscheidung |
|---|---|
| Speicherung | Nur lokal auf dem Gerät (`localStorage`), dazu Backup als JSON-Export/-Import |
| Erinnerungen | Werden über eine `.ics`-Datei mit Alarm in den iPhone-Kalender übernommen, iOS meldet sich dann |
| Spracheingabe | Diktieren mit regelbasierter Erkennung (Datum, Uhrzeit, Kategorie, Priorität, Bereich), ohne KI |
| Gerät | iPhone, Safari bzw. Home-Bildschirm |
| Kategorien | Startet mit Arbeit, Privat, Beziehung, Gesundheit, Finanzen, Sonstiges; eigene anlegbar |
| ToDo-Extras | Fälligkeitsdatum (optional mit Uhrzeit), Priorität „wichtig“ |
| Erledigte ToDos | Verschwinden nach dem Abhaken (mit „Rückgängig“) |
| Gedanken | Freie Notizen mit #Schlagworten, Suche, Filter, Umwandeln in ToDo |
| Telegram-Bot | Entfällt, bleibt nur als Archiv in `alt/` (nicht auf GitHub) |
| Design | iOS-nativ, hell/dunkel automatisch, Tab-Leiste unten, großer Mikrofon-Knopf |
| Name | ToDos |

## Bereiche

1. **ToDos**: Liste mit Kategorie-Filter. Sortierung: überfällig → heute → wichtig → nach Datum → neueste.
2. **Erinnerungen**: Text plus Datum und Uhrzeit, gruppiert nach Überfällig / Heute / Morgen / Später.
   Knopf „In Kalender“ legt einen Termin mit Alarm an.
3. **Gedanken**: Notizen, neueste oben, Schlagwort-Chips, Suche.

## Spracheingabe

Mikrofon-Knopf → Spracherkennung des Browsers (`de-DE`). Wenn die nicht verfügbar ist, öffnet sich das
Eingabefeld, und das Mikrofon der iPhone-Tastatur wird verwendet. Der erkannte Text läuft durch denselben
Parser und erscheint vorausgefüllt zur Bestätigung.

Beispiele, die der Parser versteht:

- „Erinnere mich morgen um 9 an den Zahnarzt“ → Erinnerung, morgen 09:00
- „Idee Hashtag Buch Kinderbuch über einen Drachen“ → Gedanke mit #buch
- „Steuererklärung abgeben bis Freitag wichtig Kategorie Finanzen“ → ToDo, Freitag, wichtig, Finanzen
- „In 3 Tagen Mama anrufen“ → je nach aktivem Tab ToDo mit Datum oder Erinnerung

Schlüsselwörter für den Bereich: „Erinnerung“, „erinnere mich“ → Erinnerung; „Gedanke“, „Idee“, „Notiz“ → Gedanke;
„ToDo“, „Aufgabe“ → ToDo. Ohne Schlüsselwort gilt der aktive Tab.

## Technik

- Reines HTML/CSS/JS, kein Build-Schritt: `index.html`, `styles.css`, `app.js`, `parser.js`
- `manifest.webmanifest` + `sw.js` (offline nutzbar), Icons in `icons/`
- Parser-Tests: `npm test`
- Datenformat: `localStorage["todos-app-v1"]` = `{ version, categories, todos, reminders, thoughts }`

## Ausbaustufen (später)

- Abgleich zwischen Geräten
- Telegram-Anbindung
