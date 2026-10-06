# ToDos – Hinweise für Claude

Mobile-first PWA (ToDos, Erinnerungen, Gedanken, Spracheingabe) für Jonas' iPhone.
Spezifikation und Entscheidungen: siehe `KONZEPT.md` – vor größeren Änderungen lesen.

## Regeln

- Reines HTML/CSS/JS ohne Build-Schritt und ohne Abhängigkeiten. Dateien: `index.html`, `styles.css`, `app.js`, `parser.js`, `sw.js`.
- Alle Texte in der App auf Deutsch, Stil iOS-nativ (siehe CSS-Variablen in `styles.css`, hell und dunkel).
- Daten bleiben ausschließlich lokal (`localStorage`). Keine Server, Tracking oder externen Dienste ohne ausdrückliche Zustimmung.
- Nach Änderungen am Parser: `npm test` (Node, `tests/parser.test.js`) muss grün sein; neue Sprachmuster mit Test abdecken.
- Bei jeder Änderung an ausgelieferten Dateien `VERSION` in `sw.js` erhöhen, sonst lädt das iPhone die alte Version aus dem Cache.
- Datenformat (`todos-app-v1`) nur abwärtskompatibel ändern – bestehende Einträge auf dem Handy dürfen nicht verloren gehen.

## Veröffentlichen

GitHub Pages baut automatisch aus `main`: https://ut1707.github.io/todos/
Jonas arbeitet oft vom Handy aus – nach einer Änderung kurz sagen, was er auf dem iPhone testen soll.
