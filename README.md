# Karteikarten — DHBW Lern-WebApp

Interaktive Lern-WebApp mit mehreren Fächern (DHBW, BWL Versicherung). Reines HTML/CSS/JS — **kein Build, kein Server**. Optimiert für iPhone & iPad.

## Fächer

Tippe oben auf den Fachtitel (▾), um das Fach zu wechseln (Tastatur: `F`). Jedes Fach hat einen **eigenen Lernstand**.

- **§ Versicherungsaufsichtsrecht** — 91 Karten in 10 Themenblöcken (C.1–C.10) + 16 Prüfungsfragen (Teil D)
- **σ Risikomanagement & Rückversicherung (Mattejat)** — 180 Karten in 19 Blöcken (Grundlagen → ART & Cat Bonds) + die große **Klausuraufgabe** (Quote + Summenexzedent + XL-Programm) als geführte Rechenkette in 12 Schritten

## Zwei Stapel je Fach

- **Karteikarten** — gefiltert nach Themenblöcken
- **Prüfungsfragen / Klausuraufgabe** — Klausurteil des Fachs

### Spezialfilter (Risikomanagement)

Unter den Themenblöcken gibt es zusätzliche Filter-Chips, kombinierbar mit den Blöcken:

- **🎯 Klausurrelevant** — vom Dozenten explizit markierte Inhalte
- **🧮 Rechenkarten** — Formel + Rechenweg + Interpretation
- **⚠️ Hinweise** — Stellen, an denen die Original-Unterlage unstimmig ist

## Als App installieren (PWA)

Die Seite ist eine **Progressive Web App**: In Safari **Teilen → Zum Home-Bildschirm** (iPhone/iPad) bzw. in Chrome/Edge **Installieren**. Danach startet sie wie eine native App (eigenes Icon, Vollbild) und funktioniert **komplett offline** — ein Service Worker hält alle Dateien und Schriften im Cache.

> Beim Veröffentlichen von Inhalts-Updates die `VERSION` in `sw.js` hochzählen, damit installierte Apps den neuen Stand laden.

## Zwei Modi

- **Lernen** — Karte antippen / Leertaste → Lösung aufdecken (Flip)
- **Prüfung** — eigene Antwort eintippen → „Lösung vergleichen” zeigt deine Antwort neben der Musterlösung

## Lernplanung (SM-2 / Anki-Stil)

Jede Karte wird einzeln terminiert. Nach dem Aufdecken bewertest du mit vier Buttons; darauf steht jeweils das **nächste Intervall** als Vorschau.

| Button | Neue Karte | Wiederholung | Ease |
|---|---|---|---|
| **Nochmal** | 1 Min | Reset auf 1 Min | −0,20 |
| **Schwer** | 8 Min | Intervall × 1,2 | −0,15 |
| **Gut** | 10 Min | Intervall × Ease | ±0 |
| **Einfach** | 15 Min | Intervall × Ease × 1,3 | +0,15 |

- **Ease** startet bei **2,5** und wird bei jeder Bewertung nachgeführt (Untergrenze 1,3). Sie steuert, wie stark „Gut“ und „Einfach“ das Intervall strecken.
- **Fälligkeit:** Nach der Bewertung bekommt die Karte ein Fälligkeitsdatum (`jetzt + Intervall`). Die Queue zeigt **fällige + neue Karten, nach Fälligkeit sortiert** (neue zuerst).
- **Nochmal** setzt das Intervall auf 1 Min und legt die Karte ein paar Plätze später erneut in die Sitzung.
- **Nichts fällig?** Dann erscheint ein **Countdown** bis zur nächsten fälligen Karte plus **„Vorziehen“**, um trotzdem vorab zu lernen. Läuft der Countdown ab, wird die fällige Karte automatisch geladen.
- Ein kleiner Chip auf der Karte zeigt den Status: **Neu**, **Fällig** oder das aktuelle **Intervall**.

Der Lernstand wird je **Fach und Stapel** lokal im Browser gespeichert (`localStorage`); bestehende Lernstände aus der Ein-Fach-Version werden beim ersten Start automatisch übernommen.

## Suche

Lupe oben rechts (oder `/`): durchsucht Frage **und** Antwort des aktuellen Stapels, kombinierbar mit Block- und Spezialfiltern. Während der Suche werden alle Treffer gezeigt (auch nicht fällige).

## Statistik, Sicherung & Rückgängig

Das Balken-Symbol oben rechts öffnet das Panel **Statistik & Daten**:

- **Lernstand** des Fachs (gesamt / neu / fällig / geplant, je Stapel)
- **Fällig in den nächsten 7 Tagen** und **Aktivität** der letzten 7 Tage inkl. **Lern-Serie** 🔥
- **Export/Import**: Der Lernstand liegt nur im Browser (`localStorage`). Die Export-Datei (JSON) enthält Planung, Prüfungs-Antworten und Aktivität **aller Fächer** — damit ziehst du z. B. vom iPhone aufs iPad um.

**↶ Rückgängig** (oder `Z`) nimmt die letzte Bewertung zurück — falls man sich vertippt hat.

## Bedienung

- **Nur fällige / Alle Karten** umschalten · **Mischen** · **Zurücksetzen** (setzt die Planung des aktuellen Stapels zurück)
- **Wischen** links/rechts zum Blättern (Touch)
- Tastatur: `Leertaste` aufdecken · `← →` blättern · `1`–`4` bewerten · `Z` rückgängig · `/` suchen · `S` Mischen · `T` Design · `F` Fach wechseln
- Drei Designs per Tipp auf das Symbol oben rechts: **Hell → Dunkel → OLED**

### OLED-Darkmode

Eigenes Design mit **echtem Schwarz (#000)** für Seite und Karten, damit die Pixel auf OLED-Displays abschalten. Nur winzige Bedienelemente behalten einen Hauch Grau, damit sie auf Schwarz sichtbar bleiben.

## Dateien

`index.html` · `styles.css` · `app.js` · `subjects.js` (Fächer-Manifest) · `cards.js` (Aufsichtsrecht) · `cards-risiko.js` (Risikomanagement) · `manifest.webmanifest` + `sw.js` + `icons/` (PWA)

## Auf GitHub Pages veröffentlichen

1. Repository anlegen (z. B. `versicherungsaufsicht-karten`).
1. Alle Dateien (inkl. `icons/`-Ordner) ins **Repo-Root** hochladen (`index.html` muss im Root liegen).
1. **Settings → Pages → Source: „Deploy from a branch” → `main` / `/ (root)` → Save**.
1. Nach ein paar Minuten: `https://<benutzername>.github.io/<repo>/`.

Lokal testen: `index.html` einfach im Browser öffnen.

## Inhalt ändern / neues Fach hinzufügen

Karten liegen als Listen `{ id, cat, label, q, a, tags? }` in `cards.js` bzw. `cards-risiko.js`.
In `q`/`a` markiert `**Text**` Schlüsselbegriffe (Frage = Leuchtmarker, Antwort = fett).
`tags` (optional) verknüpft eine Karte mit den Spezialfiltern des Fachs.

**Neues Fach:** eine Datei `cards-<fach>.js` mit den Karten-Arrays anlegen, in `index.html` **vor** `subjects.js` einbinden und in `subjects.js` einen Eintrag in `SUBJECTS` ergänzen (Titel, Sigil, Blöcke mit Farben, Decks, optional Tag-Definitionen). Mehr ist nicht nötig — Menü, Filter und Lernstand kommen automatisch.

## Planungs-Parameter anpassen

Die Werte stehen gebündelt oben in `app.js`:

```js
var NEW_STEPS = { again: 1, hard: 8, good: 10, easy: 15 }; // Startintervalle (Min)
var EASE_START = 2.5;   // Start-Ease
var EASE_MIN   = 1.3;   // Untergrenze
var EASE_DELTA = { again: -0.20, hard: -0.15, good: 0, easy: 0.15 };
var HARD_MULT  = 1.2;   // Schwer: × 1,2
var EASY_BONUS = 1.3;   // Einfach: × Ease × 1,3
var AGAIN_MIN  = 1;     // Nochmal: Reset (Min)
```
