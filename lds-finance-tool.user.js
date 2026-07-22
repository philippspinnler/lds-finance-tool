// ==UserScript==
// @name         Spenden: Beschreibung lesbar machen
// @namespace    local.philipp.spenden
// @version      1.6
// @description  Formatiert das ISO-20022-Beschreibungsfeld: zeigt Name/Zweck, Original hinter "raw"-Link
// @match        https://*.churchofjesuschrist.org/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
  'use strict';

  const MARKER_CLASS = 'ubf-formatted';

  function extract(tag, text) {
    const m = text.match(new RegExp('<' + tag + '>([^<]*)'));
    return m ? m[1].trim() : null;
  }

  function extractAll(tag, text) {
    const values = [];
    const re = new RegExp('<' + tag + '>([^<]*)', 'g');
    let m;
    while ((m = re.exec(text))) {
      const v = m[1].trim();
      if (v) values.push(v);
    }
    return values;
  }

  function extractName(text) {
    const names = extractAll('Nm', text);
    if (!names.length) return null;
    if (names.length === 1) return names[0];
    // Bei mehreren Nm-Werten steht die Person zuletzt (vor der Adresse),
    // davor der Einzahlungskanal, z. B. "Schaltereinzahlung".
    return names[names.length - 1] + ' (' + names.slice(0, -1).join(', ') + ')';
  }

  function buildReplacement(rawText) {
    const name = extractName(rawText);
    const zweck = extract('Ustrd', rawText);
    if (!name && !zweck) return null;

    const wrap = document.createElement('span');
    wrap.className = MARKER_CLASS;
    wrap.style.display = 'block';
    wrap.style.color = '#000';

    const addLine = (label, value) => {
      if (!value) return;
      const line = document.createElement('span');
      line.style.display = 'block';
      const b = document.createElement('strong');
      b.textContent = label + ': ';
      line.appendChild(b);
      line.appendChild(document.createTextNode(value));
      wrap.appendChild(line);
    };

    addLine('Name', name);
    addLine('Zweck', zweck);

    if (rawText !== lastSpenderRaw) {
      lastSpenderRaw = rawText;
      recordEpoch++;
      if (name) {
        const cleanName = name.split(' (')[0];
        setTimeout(() => trySelectSpender(cleanName), 300);
      }
    }

    const totalRaw = extract('Amt', rawText);
    const total = totalRaw && /^\d+(?:[.,]\d{1,2})?$/.test(totalRaw)
      ? parseFloat(totalRaw.replace(',', '.'))
      : null;

    let amounts = parseZweckAmounts(zweck);
    let mismatch = false;
    if (!amounts.length) {
      // Kein Kürzel mit Betrag: Gesamtbetrag (erstes <Amt>) verwenden.
      if (total !== null) {
        const label = findKeyField(zweck) || DEFAULT_FIELD_LABEL;
        amounts = [{ label, amount: total.toFixed(2), done: false }];
      }
    } else if (total !== null) {
      // Zweck-Beträge gegen den Gesamtbetrag prüfen.
      const sum = amounts.reduce((s, a) => s + parseFloat(a.amount), 0);
      if (Math.abs(sum - total) > 0.005) {
        mismatch = true;
        const others = amounts.filter((a) => a.label !== DEFAULT_FIELD_LABEL);
        const rest = total - others.reduce((s, a) => s + parseFloat(a.amount), 0);
        if (rest > 0) {
          amounts = [
            { label: DEFAULT_FIELD_LABEL, amount: rest.toFixed(2), done: false },
            ...others,
          ];
        }
      }
    }
    if (amounts.length) {
      pendingAmounts = amounts;
      const hint = document.createElement('span');
      hint.style.display = 'block';
      hint.style.fontSize = '0.85em';
      hint.style.opacity = '0.7';
      hint.textContent = 'Erkannt: ' +
        amounts.map((a) => a.label + ' ' + a.amount).join(' · ');
      wrap.appendChild(hint);
    }
    if (mismatch) {
      const warn = document.createElement('span');
      warn.style.display = 'block';
      warn.style.color = '#a94442';
      warn.style.fontWeight = 'bold';
      warn.style.fontSize = '0.9em';
      warn.textContent =
        '⚠ Die Zweck-Beträge ergeben nicht den Gesamtbetrag – bitte prüfen!';
      wrap.appendChild(warn);
    }

    const details = document.createElement('details');
    details.style.marginTop = '0.3em';
    const summary = document.createElement('summary');
    summary.textContent = 'raw';
    summary.style.cursor = 'pointer';
    summary.style.opacity = '0.6';
    summary.style.fontSize = '0.85em';
    const raw = document.createElement('span');
    raw.textContent = rawText;
    raw.style.display = 'block';
    raw.style.fontFamily = 'monospace';
    raw.style.fontSize = '0.8em';
    raw.style.opacity = '0.7';
    raw.style.wordBreak = 'break-word';
    raw.style.whiteSpace = 'pre-wrap';
    details.appendChild(summary);
    details.appendChild(raw);
    wrap.appendChild(details);

    return wrap;
  }

  // Zuordnung: Kürzel im Zweck-Text -> Feldbeschriftung im Spendenformular.
  // Zum Erweitern einfach Keys ergänzen oder neue Zeilen hinzufügen, z. B.:
  //   { label: 'Humanitäre Hilfe', keys: ['HH'] },
  const ZWECK_AMOUNT_FIELDS = [
    { label: 'Zehnter', keys: ['Z', 'ZE', 'ZEHNTEN', 'ZEHNTER'] },
    { label: 'Fastopfer', keys: ['FO', 'FASTOPFER'] },
  ];

  // Fällt kein Kürzel-Treffer an, geht der Gesamtbetrag in dieses Feld.
  const DEFAULT_FIELD_LABEL = 'Zehnter';

  function parseZweckAmounts(zweck) {
    if (!zweck) return [];
    const items = [];
    ZWECK_AMOUNT_FIELDS.forEach(({ label, keys }) => {
      for (const key of keys) {
        const re = new RegExp('\\b' + key + '\\b\\s*:?\\s*(\\d+(?:[.,]\\d{1,2})?)', 'i');
        const m = zweck.match(re);
        if (m) {
          const amount = parseFloat(m[1].replace(',', '.')).toFixed(2);
          items.push({ label, amount, done: false });
          break;
        }
      }
    });
    return items;
  }

  // Erkennt ein Kürzel ohne Betrag, z. B. "ZEHNTEN" oder "ZE Muster".
  function findKeyField(zweck) {
    if (!zweck) return null;
    for (const { label, keys } of ZWECK_AMOUNT_FIELDS) {
      for (const key of keys) {
        if (new RegExp('\\b' + key + '\\b', 'i').test(zweck)) return label;
      }
    }
    return null;
  }

  // Findet das Eingabefeld in der Formularzeile mit der angegebenen Beschriftung.
  function findRowInput(label) {
    for (const el of document.body.querySelectorAll('*')) {
      if (el.children.length > 0) continue;
      if (el.textContent.trim() !== label) continue;
      let ancestor = el.parentElement;
      for (let i = 0; i < 6 && ancestor; i++) {
        const inputs = ancestor.querySelectorAll('input:not([type="hidden"])');
        if (inputs.length === 1) return inputs[0];
        if (inputs.length > 1) break;
        ancestor = ancestor.parentElement;
      }
    }
    return null;
  }

  // Setzt den Wert so, dass auch React & Co. die Eingabe registrieren.
  function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  // --- Spender automatisch anhand des Namens suchen/auswählen ---
  // false: nur den Namen ins Suchfeld tippen, Auswahl bleibt manuell.
  const SPENDER_AUTO_SELECT = true;

  function findSpenderInput() {
    return (
      document.querySelector('input[data-qa="donorDropdownInput"]') ||
      document.querySelector('input[placeholder*="Spender"]')
    );
  }

  function nameTokens(text) {
    return text
      .toLowerCase()
      .split(/[^a-zà-öø-ÿß']+/)
      .filter((t) => t.length >= 2 && t !== 'und');
  }

  function optionHits(optionText, bankTokens) {
    return nameTokens(optionText).filter((t) => bankTokens.includes(t)).length;
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function trySelectSpender(name) {
    const input = findSpenderInput();
    if (!input || input.value.trim()) return;

    // Die Spenderliste hängt als natives <datalist> am Eingabefeld;
    // ggf. kurz warten, bis sie befüllt ist.
    let datalist = null;
    for (let i = 0; i < 8; i++) {
      const listId = input.getAttribute('list');
      datalist = listId ? document.getElementById(listId) : null;
      if (datalist && datalist.options.length) break;
      await delay(250);
    }
    if (!datalist || !datalist.options.length || input.value.trim()) return;

    const bankTokens = nameTokens(name);
    if (!bankTokens.length) return;

    const scored = Array.from(datalist.options)
      .map((opt) => ({
        value: opt.value,
        hits: optionHits(opt.value, bankTokens),
        total: nameTokens(opt.value).length,
      }))
      .filter((s) => s.hits > 0)
      .sort((a, b) => b.hits - a.hits);
    if (!scored.length) return;

    const best = scored[0];
    const unique = scored.filter((s) => s.hits === best.hits).length === 1;
    const strong = best.hits >= 2 || best.hits === best.total;

    // Nur bei eindeutigem, sicherem Treffer ausfüllen — sonst Feld leer lassen.
    if (SPENDER_AUTO_SELECT && unique && strong) {
      setInputValue(input, best.value);
    }
  }

  let lastSpenderRaw = null;

  // Zählt die Datensatz-Wechsel (jede neu verarbeitete Bank-Beschreibung).
  let recordEpoch = 0;

  let pendingAmounts = null;

  function attemptFill() {
    if (!pendingAmounts) return;
    let open = false;
    pendingAmounts.forEach((item) => {
      if (item.done) return;
      const input = findRowInput(item.label);
      if (!input) { open = true; return; }
      if (input.value.trim() === '' && document.activeElement !== input) {
        setInputValue(input, item.amount);
      }
      item.done = true;
    });
    if (!open) pendingAmounts = null;
  }

  const VERWENDUNGSZWECK_OPTIONS = [
    'Spenden',
    'TN Beiträge für Veranstaltungen des Pfahles',
    'TN Beiträge für Veranstaltungen der Gemeinde',
  ];
  const DATALIST_ID = 'ubf-verwendungszweck-options';
  const DEFAULT_VERWENDUNGSZWECK = VERWENDUNGSZWECK_OPTIONS[0]; // 'Spenden'

  function ensureDatalist() {
    let dl = document.getElementById(DATALIST_ID);
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = DATALIST_ID;
      VERWENDUNGSZWECK_OPTIONS.forEach((text) => {
        const opt = document.createElement('option');
        opt.value = text;
        dl.appendChild(opt);
      });
      document.body.appendChild(dl);
    }
    return dl;
  }

  function enhanceVerwendungszweckInputs(root) {
    const inputs = root.querySelectorAll('input[placeholder*="Verwendungszweck"]');
    if (!inputs.length) return;
    ensureDatalist();
    inputs.forEach((input) => {
      if (input.getAttribute('list') !== DATALIST_ID) {
        input.setAttribute('list', DATALIST_ID);
        input.autocomplete = 'off';
      }
      maybePrefillVerwendungszweck(input);
    });
  }

  // Findet das zum Verwendungszweck gehörende Betrag-Feld: das nächste
  // Währungsfeld (data-qa="currencyInput") im umschließenden Container.
  function findPairedBetragInput(vzInput) {
    let ancestor = vzInput.parentElement;
    for (let i = 0; i < 8 && ancestor; i++) {
      const betrag = ancestor.querySelector('input[data-qa="currencyInput"]');
      if (betrag) return betrag;
      ancestor = ancestor.parentElement;
    }
    return null;
  }

  // Simuliert eine echte Eingabe (Fokus, Tippen, Verlassen), damit die
  // Seiten-App den Wert sicher in ihren Formular-Zustand übernimmt.
  function typeInputValue(input, value) {
    const prev = document.activeElement;
    input.focus();
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    setter.call(input, value);
    input.dispatchEvent(new InputEvent('input', {
      bubbles: true, data: value, inputType: 'insertText',
    }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();
    if (prev && prev !== document.body && typeof prev.focus === 'function') {
      prev.focus();
    }
  }

  // "Spenden" setzen, sobald der zugehörige Betrag einen Wert hat (die
  // Seite befüllt ihn aus der Banktransaktion, das Feld ist meist
  // schreibgeschützt). Verwendungszweck und Betrag sind ein Paar
  // ("beide oder keins"-Validierung).
  //
  // Einmal pro Datensatz (nicht pro Element): beim Wechsel der Spende
  // verwendet die Seite dasselbe Eingabefeld weiter, zeigt aber noch den
  // alten Text an, ohne ihn in den Zustand des neuen Datensatzes zu
  // übernehmen. Darum wird nach jedem Wechsel neu "getippt": ein leeres
  // Feld bekommt den Standardwert, ein angezeigter Text wird erneut
  // eingegeben, damit er auch für den neuen Datensatz gilt. Innerhalb
  // desselben Datensatzes bleibt ein bewusst geleertes Feld leer.
  function maybePrefillVerwendungszweck(input) {
    if (input.dataset.ubfEpoch === String(recordEpoch)) return;
    if (document.activeElement === input) return;
    const betrag = findPairedBetragInput(input);
    if (!betrag || betrag.value.trim() === '') return;
    input.dataset.ubfEpoch = String(recordEpoch);
    fillAndVerifyVerwendungszweck(input, recordEpoch);
  }

  // Zeigt die Seite neben dem Feld noch die Paar-Fehlermeldung an?
  function vzErrorVisible(input) {
    let ancestor = input.parentElement;
    for (let i = 0; i < 3 && ancestor; i++) {
      for (const el of ancestor.children) {
        if (el.textContent.includes('Verwendungszweck-Nummer')) return true;
      }
      ancestor = ancestor.parentElement;
    }
    return false;
  }

  // Nach einem Datensatz-Wechsel lädt die Seite den Datensatz asynchron
  // nach und überschreibt dabei den Formular-Zustand — ein zu früh
  // getippter Wert geht dort wieder verloren, obwohl er im Feld sichtbar
  // bleibt. Darum: tippen, kurz warten, und solange die Paar-Fehlermeldung
  // neben dem Feld noch angezeigt wird, erneut tippen.
  async function fillAndVerifyVerwendungszweck(input, epoch) {
    for (const ms of [0, 800, 1600, 3200]) {
      if (ms) await delay(ms);
      if (recordEpoch !== epoch || !input.isConnected) return;
      if (document.activeElement === input) return;
      const value = input.value.trim() === ''
        ? DEFAULT_VERWENDUNGSZWECK
        : input.value;
      typeInputValue(input, value);
      await delay(400);
      if (recordEpoch !== epoch || !input.isConnected) return;
      if (!vzErrorVisible(input)) return;
    }
  }

  function processTextNode(node) {
    const text = node.nodeValue;
    if (!text || !/<(Nm|Ustrd)>/.test(text)) return;
    const parent = node.parentElement;
    if (!parent || parent.closest('.' + MARKER_CLASS)) return;
    if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' ||
        parent.tagName === 'TEXTAREA' || parent.isContentEditable) return;

    const replacement = buildReplacement(text);
    if (replacement) node.replaceWith(replacement);
  }

  function scan(root) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeValue && n.nodeValue.includes('<')) hits.push(n);
    }
    hits.forEach(processTextNode);
    enhanceVerwendungszweckInputs(root);
    attemptFill();
  }

  let scheduled = false;
  function scheduleScan() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      scan(document.body);
    });
  }

  scan(document.body);
  new MutationObserver(scheduleScan).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
})();
