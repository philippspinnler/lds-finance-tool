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
  sicherem Treffer – automatisch eingetragen. Der Vergleich ist tolerant:
  - ein Tippfehler pro Namensteil (ab 5 Buchstaben), z. B. `Michael` /
    `Micheal`;
  - ausgeschriebene Umlaute und fehlende Akzente (`Maeder` = `Mäder`,
    `Rene` = `René`);
  - bei Gleichstand gewinnt der Eintrag, dessen Rufname (erster Vorname)
    passt;
  - steht im Zweck ein anderer Vorname (z. B. Name `Hans Muster`, Zweck
    `Anna Zehnten`), wird die Person mit diesem Vornamen und dem Nachnamen
    des Einzahlers gewählt.
- **Beträge erkennen und eintragen**: Kürzel im Zweck-Text werden erkannt und
  in die passenden Formularfelder eingetragen:

  | Kürzel | Feld |
  |---|---|
  | `Z`, `ZE`, `ZEHNTEN`, `ZEHNTER` | Zehnter |
  | `FO`, `FA`, `FASTOPFER` | Fastopfer |
  | `HH`, `HF` | Humanitäre Hilfe |
  | `M`, `GMF` | Gemeindemissionsfonds |
  | `AM` | Allgemeiner Missionsfonds |
  | `BM` | Allgemeine Spenden |

  Verstandene Schreibweisen: `Z 100 FO 20`, `Z: 100/FO: 20`, `Z-100`,
  `Z = 100`, `Z . 100.00`, `Z: CHF 100.-`, `Z Oktober 100,--` (ein Wort
  zwischen Kürzel und Betrag) sowie Betrag vor dem Kürzel (`100Z 20 FO`).

  Der Gesamtbetrag wird nur dann automatisch dem Standardfeld (Zehnter)
  zugeordnet, wenn der Zweck ein bekanntes Kürzel enthält oder leer ist —
  sonstiger Freitext bleibt zur manuellen Zuordnung offen. Als leer gelten
  auch die Bank-Platzhalter `T .`, `T =` und `T -`.
- **Warnungen**: Ergeben die Teilbeträge nicht den Gesamtbetrag, erscheint
  eine Warnung. Ebenso, wenn ein Kürzel gefunden wurde, im Zweck aber Zahlen
  stehen, die nicht als Betrag gelesen werden konnten (Jahreszahlen
  ausgenommen).
- **Farbmarkierung**: Jeder erkannte Betrag wird im Zweck-Text farbig
  hinterlegt; das befüllte Formularfeld erhält dieselbe Farbe. So ist auf
  einen Blick sichtbar, welcher Betrag wo eingetragen wurde.
- **Unterkonto auswählen**: Hat ein Fonds mehrere Konten (z. B. zwei
  Gemeindemissionskonten), erscheint das Betragsfeld erst nach der Auswahl
  im Kategorie-Feld. Das Script wählt das Konto, dessen Name exakt der
  Feldbeschriftung entspricht, und trägt dann den Betrag ein.
- **Alle Checkboxen anhaken**: Auf Seiten mit mehreren Checkboxen (z. B.
  Spendenlisten zum Abhaken) erscheint unten rechts ein Knopf
  „☑ Alle auswählen", der alle sichtbaren Checkboxen auf einmal anhakt und
  danach ans Seitenende springt.
- **Verwendungszweck-Vorschläge**: Das Verwendungszweck-Feld erhält eine
  eigene Auswahlliste („Spenden", „TN-Beiträge für Veranstaltungen des
  Pfahles", „TN-Beiträge für Veranstaltungen der Gemeinde", „TN-Beiträge
  für Veranstaltungen des Gebietes"). Die Liste wird vom Script selbst
  gezeichnet, damit lange Einträge vollständig lesbar sind und nicht wie
  im nativen Browser-Dropdown abgeschnitten werden; beim Tippen wird sie
  gefiltert. **„Spenden" wird
  automatisch gesetzt, sobald das zugehörige Betrag-Feld einen Wert hat**
  (Verwendungszweck und Betrag sind auf der Seite ein Pflicht-Paar; ein
  bewusst geleertes Feld wird nicht erneut befüllt). Wie bei den Beträgen
  greift die Automatik nur, wenn der Zweck ein bekanntes Kürzel enthält
  oder leer ist — bei sonstigem Freitext bleibt das Feld leer und wird
  manuell befüllt.

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
  Formularfeldern samt Markierungsfarbe (`color`). Weitere Felder lassen
  sich als zusätzliche Zeilen ergänzen; `label` muss exakt der
  Zeilenbeschriftung im Formular entsprechen.
- `DEFAULT_FIELD_LABEL`: Feld, in das der Gesamtbetrag fällt, wenn kein
  Kürzel erkannt wird (Standard: `Zehnter`).
- `VERWENDUNGSZWECK_OPTIONS`: Die Vorschlagsliste für das
  Verwendungszweck-Feld; der erste Eintrag ist der Standardwert.

## Hinweise

- Das Script verarbeitet alle Daten ausschließlich lokal im Browser; es werden
  keine Daten an Dritte gesendet (`@grant none`).
- Automatisch ausgefüllte Werte bitte vor dem Speichern immer kurz prüfen.
