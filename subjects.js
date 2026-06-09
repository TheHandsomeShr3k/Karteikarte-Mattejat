// =========================================================
// Fächer-Manifest — hier neue Fächer registrieren.
// Jedes Fach: id, title, subtitle, sigil, cats (Block -> Label/Farbe),
// optional tags (Filter-Definitionen) und decks (cards/exam).
// Die items-Variablen kommen aus cards.js bzw. cards-<fach>.js
// (Skripte müssen in index.html VOR subjects.js geladen sein).
// =========================================================

const SUBJECTS = [
  {
    id: "aufsicht",
    title: "Versicherungsaufsichtsrecht",
    short: "Aufsichtsrecht",
    subtitle: "DHBW · BWL Versicherung · Lernkarten",
    sigil: "§",
    cats: {
      "C.1":  { label: "Grundlagen",        color: "#3f6fb0" },
      "C.2":  { label: "Behörden & Quellen", color: "#7a5bb0" },
      "C.3":  { label: "Solvency II",       color: "#1f8a8a" },
      "C.4":  { label: "Zulassung",         color: "#c0612e" },
      "C.5":  { label: "Organisation",      color: "#2e8b6b" },
      "C.6":  { label: "Laufende Aufsicht", color: "#b0463f" },
      "C.7":  { label: "Vertrieb",          color: "#a8852a" },
      "C.8":  { label: "Jahresbericht",     color: "#4f7d3a" },
      "C.9":  { label: "Beispiel-Fälle",    color: "#a14d86" },
      "C.10": { label: "Detailwissen",      color: "#5b6b8c" }
    },
    decks: {
      cards: { label: "Karteikarten", items: (typeof FLASHCARDS !== "undefined" ? FLASHCARDS : []), cats: true },
      exam:  { label: "Prüfungsfragen", items: (typeof EXAMQS !== "undefined" ? EXAMQS : []), cats: false,
               color: "#15233c", tagPrefix: "Prüfungsfrage", roleLabel: "Prüfungsfrage" }
    }
  },
  {
    id: "laue-alt",
    title: "Laue/Alternativ",
    short: "Laue/Alternativ",
    subtitle: "Aufsichtsrecht & Vertrieb · ausführliche Karten",
    sigil: "⚖",
    cats: {
      "A": { label: "Grundlagen",                color: "#3f6fb0" },
      "B": { label: "Aufbau der Aufsicht",       color: "#7a5bb0" },
      "C": { label: "Rechtsquellen & Solvency II", color: "#1f8a8a" },
      "D": { label: "Versicherungsgeschäfte",    color: "#a14d86" },
      "E": { label: "Zulassungsaufsicht",        color: "#c0612e" },
      "F": { label: "Laufende Aufsicht",         color: "#b0463f" },
      "G": { label: "Vertrieb",                  color: "#a8852a" },
      "H": { label: "Jahresbericht 2024",        color: "#4f7d3a" }
    },
    decks: {
      cards: { label: "Karteikarten", items: (typeof LAUE_CARDS !== "undefined" ? LAUE_CARDS : []), cats: true }
    }
  },
  {
    id: "risiko",
    title: "Risikomanagement & Rückversicherung",
    short: "Risikomanagement",
    subtitle: "DHBW · Mattejat · Lernkarten",
    sigil: "σ",
    tags: {
      klausur: { icon: "🎯", label: "Klausurrelevant", hint: "vom Dozenten markiert" },
      rechnen: { icon: "🧮", label: "Rechenkarten",    hint: "Formel + Rechnung" },
      achtung: { icon: "⚠️", label: "Hinweise",        hint: "Unstimmigkeit in der Unterlage" }
    },
    cats: {
      "A": { label: "Grundlagen",          color: "#3f6fb0" },
      "B": { label: "Risikoarten",         color: "#b0463f" },
      "C": { label: "RM-Prozess",          color: "#2e8b6b" },
      "D": { label: "Risikomaße",          color: "#7a5bb0" },
      "E": { label: "Rahmen & Stakeholder", color: "#5b6b8c" },
      "F": { label: "Solvency II",         color: "#1f8a8a" },
      "G": { label: "Vt. Risiken",         color: "#c0612e" },
      "H": { label: "Liquidität & SchwaRü", color: "#4f7d3a" },
      "I": { label: "RV-Fachbegriffe",     color: "#a14d86" },
      "J": { label: "Magischer Würfel",    color: "#a8852a" },
      "K": { label: "Funktionen der RV",   color: "#2f6f8f" },
      "L": { label: "Proportionale RV",    color: "#8a6d3b" },
      "M": { label: "Nicht-prop. RV",      color: "#8c4f5b" },
      "N": { label: "Fakultative RV",      color: "#5e8c4f" },
      "O": { label: "GuV-Quoten",          color: "#b07a2a" },
      "P": { label: "NatCat",              color: "#4f6db0" },
      "Q": { label: "RV-Politik",          color: "#8c5b3a" },
      "R": { label: "ART & Cat Bonds",     color: "#6d4fb0" },
      "Z": { label: "Roter Faden",         color: "#15233c" }
    },
    decks: {
      cards: { label: "Karteikarten", items: (typeof RISK_CARDS !== "undefined" ? RISK_CARDS : []), cats: true },
      exam:  { label: "Klausuraufgabe", items: (typeof RISK_EXAM !== "undefined" ? RISK_EXAM : []), cats: false,
               color: "#7d2f3f", tagPrefix: "Klausuraufgabe · Schritt", roleLabel: "Aufgabenschritt" }
    }
  }
];
