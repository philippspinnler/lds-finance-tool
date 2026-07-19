# LDS Finance Tool

Ein Tampermonkey-Userscript, das die Spenden-Erfassung auf den Finanzseiten von
`churchofjesuschrist.org` erleichtert.

## Was macht das Script?

- **Beschreibung lesbar machen**: Das kryptische ISO-20022-Beschreibungsfeld
  (Bank-XML mit `<Nm>`, `<Ustrd>`, `<Amt>` usw.) wird in lesbare Zeilen
  umgewandelt (**Name** und **Zweck**). Der Originaltext bleibt hinter einem
  aufklappbaren „raw"-Link erhalten.
- **Spender automatisch auswählen**: Anhand des Namens aus der Beschreibung
  wird der passende Eintrag im Spender-Feld gesucht und – nur bei eindeutigem,
  sicherem Treffer – automatisch eingetragen.
- **Beträge erkennen und eintragen**: Kürzel im Zweck-Text (z. B. `ZE 50` für
  Zehnter, `FO 20` für Fastopfer) werden erkannt und in die passenden
  Formularfelder eingetragen. Ergeben die Teilbeträge nicht den Gesamtbetrag,
  erscheint eine Warnung.
- **Verwendungszweck-Vorschläge**: Das Verwendungszweck-Feld erhält eine
  Auswahlliste („Spenden", „TN Beiträge für Veranstaltungen des Pfahles",
  „TN Beiträge für Veranstaltungen der Gemeinde"). **„Spenden" wird als
  Standardwert vorbelegt**, solange das Feld leer ist.

## Installation (Firefox + Tampermonkey)

1. **Tampermonkey installieren**: In Firefox
   [Tampermonkey auf addons.mozilla.org](https://addons.mozilla.org/de/firefox/addon/tampermonkey/)
   öffnen und **„Zu Firefox hinzufügen"** klicken.
2. **Neues Userscript anlegen**: Auf das Tampermonkey-Symbol in der
   Symbolleiste klicken → **„Übersicht"** (Dashboard) öffnen → Reiter
   **„Installierte Userscripte"** → **„+"** (Neues Script erstellen).
3. **Script einfügen**: Den vorgegebenen Inhalt des Editors komplett löschen,
   den gesamten Inhalt von
   [`lds-finance-tool.user.js`](lds-finance-tool.user.js)
   hineinkopieren und mit **Strg+S** (bzw. Datei → Speichern) speichern.
4. **Fertig**: Die Finanzseite auf `churchofjesuschrist.org` (neu) laden. Das
   Script läuft automatisch auf allen Seiten, die auf
   `https://*.churchofjesuschrist.org/*` passen.

**Alternative**: Die Roh-Datei direkt im Browser öffnen (z. B. über den
„Raw"-Button auf GitHub). Tampermonkey erkennt die Endung `.user.js` und
bietet die Installation automatisch an.

## Konfiguration

Direkt im Script anpassbar:

- `ZWECK_AMOUNT_FIELDS`: Zuordnung von Kürzeln im Zweck-Text zu
  Formularfeldern (Standard: Zehnter, Fastopfer). Weitere Felder lassen sich
  als zusätzliche Zeilen ergänzen.
- `DEFAULT_FIELD_LABEL`: Feld, in das der Gesamtbetrag fällt, wenn kein
  Kürzel erkannt wird (Standard: `Zehnter`).
- `SPENDER_AUTO_SELECT`: Auf `false` setzen, wenn der Spendername nur ins
  Suchfeld getippt, aber nicht automatisch ausgewählt werden soll.
- `VERWENDUNGSZWECK_OPTIONS`: Die Vorschlagsliste für das
  Verwendungszweck-Feld; der erste Eintrag ist der Standardwert.

## Hinweise

- Das Script verarbeitet alle Daten ausschließlich lokal im Browser; es werden
  keine Daten an Dritte gesendet (`@grant none`).
- Automatisch ausgefüllte Werte bitte vor dem Speichern immer kurz prüfen.
