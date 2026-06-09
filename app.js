/* =========================================================
   Karteikarten-WebApp — Logik (Vanilla JS, kein Build)
   Fächer: definiert in subjects.js (SUBJECTS)
   Decks:  je Fach Karteikarten + Prüfungsteil
   Modi:   Lernen (Halb-Flip, iPad-sicher) + Prüfung (eigene Antwort)
   Planung: SM-2 / Anki-Stil mit 4 Bewertungen, Ease & Fälligkeit
   ========================================================= */
(function () {
  "use strict";

  // ---------- SM-2 / Anki-Stil Parameter ----------
  var MIN = 60 * 1000;                                   // eine Minute in ms
  var NEW_STEPS = { again: 1, hard: 8, good: 10, easy: 15 }; // Startintervalle (Minuten) für neue Karten
  var EASE_START = 2.5;                                  // Start-Ease
  var EASE_MIN   = 1.3;                                  // Untergrenze
  var EASE_DELTA = { again: -0.20, hard: -0.15, good: 0, easy: 0.15 }; // Ease-Nudge je Bewertung
  var HARD_MULT  = 1.2;                                   // Schwer: Intervall × 1,2
  var EASY_BONUS = 1.3;                                   // Einfach: Intervall × Ease × 1,3
  var AGAIN_MIN  = 1;                                     // Nochmal: Reset auf 1 Minute

  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  // ---- Fächer ----
  var subjects = (typeof SUBJECTS !== "undefined" && SUBJECTS.length) ? SUBJECTS : [];
  if (!subjects.length) return;
  function subjById(id) { for (var i = 0; i < subjects.length; i++) if (subjects[i].id === id) return subjects[i]; return null; }

  // ---- State ----
  var subjectId = store.get("kk-subject", subjects[0].id);
  if (!subjById(subjectId)) subjectId = subjects[0].id;
  var deckKey = store.get("kk-deck", "cards");
  var mode = store.get("kk-mode", "learn");
  var filter = "all";
  var tagFilter = {};                                    // z. B. { klausur: true }
  var onlyDue = store.get("kk-onlydue", true);           // SRS: standardmäßig nur fällige Karten
  var deck = [], idx = 0, revealed = false, finished = false, animating = false;
  var sched = store.get("kk-sched-v1", {});              // "fach:deck:id" -> {ease, ivl(min), due(ms), reps, lapses, last}
  var answers = store.get("kk-answers", {});
  var countdownTimer = null;

  // Migration: alte Keys ohne Fach-Präfix ("cards:1") gehören zum ersten Fach
  (function migrate() {
    var legacy = subjects[0].id, changed = false;
    [sched, answers].forEach(function (obj) {
      Object.keys(obj).forEach(function (k) {
        if (/^(cards|exam):/.test(k)) { obj[legacy + ":" + k] = obj[k]; delete obj[k]; changed = true; }
      });
    });
    if (changed) { store.set("kk-sched-v1", sched); store.set("kk-answers", answers); }
  })();

  function subj() { return subjById(subjectId); }
  function decksOf(s) { return (s || subj()).decks; }
  function curDeckDef() { return decksOf()[deckKey] || decksOf().cards; }
  if (!decksOf()[deckKey]) deckKey = "cards";

  // ---- DOM ----
  var $ = function (s) { return document.querySelector(s); };
  var on = function (el, ev, fn) { if (el) el.addEventListener(ev, fn); }; // crash-sicher: nie null.addEventListener
  var filtersEl = $("#filters"), tagFiltersEl = $("#tagfilters"), stageEl = $("#stage"), barEl = $("#bar"), counterEl = $("#counter");
  var prevBtn = $("#prev"), flipBtn = $("#flip"), nextBtn = $("#next");
  var rateBtns = { again: $("#r-again"), hard: $("#r-hard"), good: $("#r-good"), easy: $("#r-easy") };
  var ivEls    = { again: $("#iv-again"), hard: $("#iv-hard"), good: $("#iv-good"), easy: $("#iv-easy") };
  var shuffleBtn = $("#shuffle"), dueBtn = $("#onlyUnknown"), resetBtn = $("#reset"), themeBtn = $("#theme");
  var deckSeg = $("#deckSeg"), modeSeg = $("#modeSeg");
  var brandBtn = $("#subjectBtn"), subjMenu = $("#subjectMenu");
  var sigilEl = $("#sigil"), titleEl = $("#subjTitle"), subEl = $("#subjSub");
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- Helpers ----
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
  function fmt(s, tag) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<" + tag + ">$1</" + tag + ">"); }
  function catDef(cat) { return (subj().cats || {})[cat] || { label: cat, color: "#15233c" }; }
  function cats() {
    var seen = [], set = {};
    (decksOf().cards.items || []).forEach(function (c) { if (!set[c.cat]) { set[c.cat] = 1; seen.push(c.cat); } });
    return seen;
  }
  function activeTags() { return Object.keys(tagFilter).filter(function (t) { return tagFilter[t]; }); }
  function scope() {
    var items = curDeckDef().items.slice();
    if (deckKey === "cards") {
      if (filter !== "all") items = items.filter(function (c) { return c.cat === filter; });
      var act = activeTags();
      if (act.length) items = items.filter(function (c) {
        var tg = c.tags || [];
        return act.every(function (t) { return tg.indexOf(t) >= 0; });
      });
    }
    return items;
  }
  function colorFor(c) { return deckKey === "exam" ? (curDeckDef().color || "#15233c") : catDef(c.cat).color; }
  function tagFor(c) {
    if (deckKey === "exam") return (curDeckDef().tagPrefix || "Prüfungsfrage") + " " + c.id;
    return c.cat + " · " + catDef(c.cat).label;
  }
  function ansKey(c) { return subjectId + ":" + deckKey + ":" + c.id; }
  function badgesHTML(c) {
    var defs = subj().tags;
    if (!defs || !c.tags || !c.tags.length) return "";
    var out = "";
    c.tags.forEach(function (t) { if (defs[t]) out += '<span class="badge" title="' + esc(defs[t].label) + '">' + defs[t].icon + "</span>"; });
    return out ? '<span class="badges">' + out + "</span>" : "";
  }
  function metaHTML(c) {
    return '<div class="meta"><span class="tag">' + esc(tagFor(c)) + "</span>" + badgesHTML(c) + '<span class="pos">#' + c.id + "</span></div>";
  }

  // ---------- Scheduling (SM-2) ----------
  function skey(c) { return subjectId + ":" + deckKey + ":" + c.id; }
  function getSched(c) { return sched[skey(c)] || null; }
  function isNew(c) { var s = getSched(c); return !s || !s.ivl; }
  function dueOf(c) { var s = getSched(c); return (s && s.ivl) ? s.due : 0; } // neue Karten => 0 (zuerst)
  function isDue(c) { var s = getSched(c); return !s || !s.ivl || s.due <= Date.now(); }
  function clampEase(e) { return e < EASE_MIN ? EASE_MIN : e; }

  // Vorschau: welches Intervall (Minuten) ergäbe diese Bewertung – ohne den Zustand zu ändern
  function nextIvl(c, rating) {
    if (rating === "again") return AGAIN_MIN;
    var s = getSched(c);
    if (!s || !s.ivl) return NEW_STEPS[rating];                       // neue Karte: feste Startintervalle
    var ease = clampEase((s.ease || EASE_START) + EASE_DELTA[rating]);
    if (rating === "hard") return s.ivl * HARD_MULT;
    if (rating === "good") return s.ivl * ease;
    return s.ivl * ease * EASY_BONUS;                                  // easy
  }

  // Bewertung anwenden: Ease nachführen, neues Intervall + Fälligkeit setzen, speichern
  function applyRating(c, rating) {
    var s = getSched(c) || { ease: EASE_START, ivl: 0, reps: 0, lapses: 0 };
    var wasNew = !s.ivl;
    s.ease = clampEase((s.ease || EASE_START) + EASE_DELTA[rating]);
    var ivl;
    if (rating === "again") { ivl = AGAIN_MIN; s.lapses = (s.lapses || 0) + 1; }
    else if (wasNew)        { ivl = NEW_STEPS[rating]; }
    else if (rating === "hard") ivl = s.ivl * HARD_MULT;
    else if (rating === "good") ivl = s.ivl * s.ease;
    else                        ivl = s.ivl * s.ease * EASY_BONUS;     // easy
    s.ivl = ivl;
    s.reps = (s.reps || 0) + 1;
    s.last = Date.now();
    s.due = Date.now() + Math.round(ivl * MIN);
    sched[skey(c)] = s;
    store.set("kk-sched-v1", sched);
  }

  // ---------- Zeit-Formatierung ----------
  function de(x) { var r = x < 10 ? Math.round(x * 10) / 10 : Math.round(x); return String(r).replace(".", ","); }
  function fmtIvl(min) {
    if (min < 1) return "<1 Min";
    if (min < 60) return Math.round(min) + " Min";
    var h = min / 60; if (h < 24) return de(h) + " Std";
    var d = h / 24;   if (d < 30) return de(d) + " Tg";
    var mo = d / 30;  if (mo < 12) return de(mo) + " Mon";
    return de(d / 365) + " J";
  }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function fmtCountdown(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var d = Math.floor(s / 86400); s -= d * 86400;
    var h = Math.floor(s / 3600);  s -= h * 3600;
    var m = Math.floor(s / 60);    s -= m * 60;
    if (d > 0) return d + " Tg " + pad(h) + ":" + pad(m) + ":" + pad(s);
    return pad(h) + ":" + pad(m) + ":" + pad(s);
  }

  // ---------- Queue ----------
  function buildDeck(shuffle) {
    var items = scope();
    var pool = onlyDue ? items.filter(isDue) : items.slice();
    pool.sort(function (a, b) { return dueOf(a) - dueOf(b); });        // nach Fälligkeit; neue (0) zuerst
    if (shuffle) for (var i = pool.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = pool[i]; pool[i] = pool[j]; pool[j] = t; }
    deck = pool;
    idx = 0; revealed = false; finished = deck.length === 0; animating = false;
  }

  // ---- Fach-Auswahl (Brand-Menü) ----
  function renderBrand() {
    var s = subj();
    if (sigilEl) sigilEl.textContent = s.sigil || "§";
    if (titleEl) titleEl.textContent = s.title;
    if (subEl) subEl.textContent = s.subtitle || "";
    document.title = s.title + " — Lernkarten";
  }
  function totalOf(s) {
    var n = 0; Object.keys(decksOf(s)).forEach(function (k) { n += (decksOf(s)[k].items || []).length; });
    return n;
  }
  function renderSubjectMenu() {
    if (!subjMenu) return;
    var html = '<div class="subject-head">Fach wählen</div>';
    subjects.forEach(function (s) {
      var act = s.id === subjectId;
      html += '<button type="button" class="subject-opt" role="option" data-s="' + s.id + '" aria-selected="' + act + '">' +
        '<span class="s-sigil">' + esc(s.sigil || "§") + "</span>" +
        '<span class="s-txt"><b>' + esc(s.title) + "</b><small>" + totalOf(s) + " Karten</small></span>" +
        (act ? '<span class="s-check">✓</span>' : "") +
      "</button>";
    });
    subjMenu.innerHTML = html;
    Array.prototype.forEach.call(subjMenu.querySelectorAll(".subject-opt"), function (b) {
      b.addEventListener("click", function () { setSubject(b.getAttribute("data-s")); closeMenu(); });
    });
  }
  function openMenu() { if (!subjMenu) return; renderSubjectMenu(); subjMenu.hidden = false; if (brandBtn) brandBtn.setAttribute("aria-expanded", "true"); }
  function closeMenu() { if (!subjMenu) return; subjMenu.hidden = true; if (brandBtn) brandBtn.setAttribute("aria-expanded", "false"); }
  function toggleMenu() { if (subjMenu) subjMenu.hidden ? openMenu() : closeMenu(); }
  function setSubject(id) {
    if (!subjById(id) || id === subjectId) return;
    saveField();
    subjectId = id; store.set("kk-subject", subjectId);
    if (!decksOf()[deckKey]) deckKey = "cards";
    filter = "all"; tagFilter = {};
    renderBrand(); syncDeckLabels();
    buildDeck(false); renderFilters(); render();
  }
  function cycleSubject() {
    var i = 0; subjects.forEach(function (s, k) { if (s.id === subjectId) i = k; });
    setSubject(subjects[(i + 1) % subjects.length].id);
  }

  // ---- Segmented controls + filters ----
  function syncDeckLabels() {
    if (!deckSeg) return;
    Array.prototype.forEach.call(deckSeg.children, function (b) {
      var d = decksOf()[b.getAttribute("data-deck")];
      b.style.display = d ? "" : "none";
      if (d && d.label) b.textContent = d.label;
    });
  }
  function syncSegs() {
    if (deckSeg) Array.prototype.forEach.call(deckSeg.children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-deck") === deckKey)); });
    if (modeSeg) Array.prototype.forEach.call(modeSeg.children, function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-mode") === mode)); });
  }
  function renderFilters() {
    renderCatFilters();
    renderTagFilters();
  }
  function renderCatFilters() {
    if (!filtersEl) return;
    if (deckKey !== "cards") { filtersEl.style.display = "none"; filtersEl.innerHTML = ""; return; }
    filtersEl.style.display = "";
    var all = decksOf().cards.items;
    var html = '<button class="chip" data-f="all" aria-pressed="' + (filter === "all") + '">Alle <span class="n">' + all.length + "</span></button>";
    cats().forEach(function (cat) {
      var n = all.filter(function (c) { return c.cat === cat; }).length;
      var on2 = filter === cat, col = catDef(cat).color;
      var st = on2 ? ' style="background:' + col + ";border-color:" + col + ';color:#fff"' : "";
      html += '<button class="chip" data-f="' + cat + '" aria-pressed="' + on2 + '"' + st + ">" + esc(catDef(cat).label) + ' <span class="n">' + n + "</span></button>";
    });
    filtersEl.innerHTML = html;
    Array.prototype.forEach.call(filtersEl.querySelectorAll(".chip"), function (b) {
      b.addEventListener("click", function () { filter = b.getAttribute("data-f"); buildDeck(false); renderFilters(); render(); });
    });
  }
  function renderTagFilters() {
    if (!tagFiltersEl) return;
    var defs = subj().tags;
    if (deckKey !== "cards" || !defs) { tagFiltersEl.style.display = "none"; tagFiltersEl.innerHTML = ""; return; }
    tagFiltersEl.style.display = "";
    var all = decksOf().cards.items, html = "";
    Object.keys(defs).forEach(function (t) {
      var n = all.filter(function (c) { return (c.tags || []).indexOf(t) >= 0; }).length;
      if (!n) return;
      html += '<button class="chip tagchip" data-t="' + t + '" aria-pressed="' + !!tagFilter[t] + '" title="' + esc(defs[t].hint || "") + '">' +
        defs[t].icon + " " + esc(defs[t].label) + ' <span class="n">' + n + "</span></button>";
    });
    tagFiltersEl.innerHTML = html;
    Array.prototype.forEach.call(tagFiltersEl.querySelectorAll(".tagchip"), function (b) {
      b.addEventListener("click", function () {
        var t = b.getAttribute("data-t");
        tagFilter[t] = !tagFilter[t];
        buildDeck(false); renderFilters(); render();
      });
    });
  }

  function renderProgress() {
    if (!barEl || !counterEl) return;
    var sc = scope(), now = Date.now();
    var planned = sc.filter(function (c) { var s = getSched(c); return s && s.ivl && s.due > now; }).length;
    barEl.style.width = (sc.length ? Math.round(planned / sc.length * 100) : 0) + "%";
    counterEl.innerHTML = finished
      ? "<b>" + planned + "</b> / " + sc.length + " geplant"
      : "Karte <b>" + (idx + 1) + "</b> / " + deck.length + " · " + planned + " geplant";
  }

  // ---- Status-Chip auf der Karte ----
  function chipHTML(c) {
    var s = getSched(c);
    if (!s || !s.ivl) return '<span class="srs-chip new">Neu</span>';
    if (s.due <= Date.now()) return '<span class="srs-chip due">Fällig</span>';
    return '<span class="srs-chip ok">Intervall ' + fmtIvl(s.ivl) + "</span>";
  }

  // ---- Intervall-Vorschau auf den Buttons ----
  function setIv(name, txt) { if (ivEls[name]) ivEls[name].textContent = txt; }
  function renderPreviews(c) {
    if (!c) { setIv("again", "–"); setIv("hard", "–"); setIv("good", "–"); setIv("easy", "–"); return; }
    setIv("again", fmtIvl(nextIvl(c, "again")));
    setIv("hard",  fmtIvl(nextIvl(c, "hard")));
    setIv("good",  fmtIvl(nextIvl(c, "good")));
    setIv("easy",  fmtIvl(nextIvl(c, "easy")));
  }

  // ---- Card content (single surface) ----
  function surfaceHTML(c, showAnswer) {
    if (!showAnswer) {
      return '<div class="surface">' +
        metaHTML(c) +
        chipHTML(c) +
        '<div class="role">Frage</div>' +
        '<div class="q">' + fmt(c.q, "mark") + "</div>" +
        '<div class="hint">Tippen oder <kbd>Leertaste</kbd> → Lösung</div>' +
      "</div>";
    }
    return '<div class="surface">' +
      metaHTML(c) +
      chipHTML(c) +
      '<div class="role ans">' + (deckKey === "exam" ? "Musterlösung" : "Antwort") + "</div>" +
      '<div class="a">' + fmt(c.a, "strong") + "</div>" +
      '<div class="hint"><kbd>1</kbd> Nochmal · <kbd>2</kbd> Schwer · <kbd>3</kbd> Gut · <kbd>4</kbd> Einfach</div>' +
    "</div>";
  }

  function render() {
    animating = false;
    stopCountdown();
    syncSegs();
    renderProgress();
    if (finished) { renderDone(); syncButtons(); return; }
    mode === "exam" ? renderExam() : renderLearn();
    syncButtons();
  }

  function renderLearn() {
    var c = deck[idx], col = colorFor(c);
    stageEl.innerHTML =
      '<div class="flipcard" id="card" style="--cat:' + col + '">' +
        surfaceHTML(c, revealed) +
      "</div>";
    var card = $("#card");
    if (card) card.addEventListener("click", function (e) { if (!e.target.closest("a")) flip(); });
    renderPreviews(c);
  }

  function renderExam() {
    var c = deck[idx], col = colorFor(c);
    var saved = answers[ansKey(c)] || "";
    var body;
    if (!revealed) {
      body =
        '<textarea class="exam-field" id="examField" placeholder="Deine Antwort hier eintippen … (Stichpunkte genügen)">' + esc(saved) + "</textarea>" +
        '<div class="hint">Tippe deine Antwort, dann <b>Lösung vergleichen</b>.</div>';
    } else {
      body =
        '<div class="reveal">' +
          '<div class="block mine"><div class="lab">Deine Antwort</div><div class="txt">' +
            (saved.trim() ? esc(saved) : "<em>(keine Antwort eingetippt)</em>") + "</div></div>" +
          '<div class="block model"><div class="lab">Musterlösung</div><div class="txt">' + fmt(c.a, "strong") + "</div></div>" +
          '<div class="hint"><kbd>1</kbd> Nochmal · <kbd>2</kbd> Schwer · <kbd>3</kbd> Gut · <kbd>4</kbd> Einfach</div>' +
        "</div>";
    }
    var role = deckKey === "exam" ? (curDeckDef().roleLabel || "Prüfungsfrage") : "Prüfungsfrage";
    stageEl.innerHTML =
      '<div class="examcard surface" id="card" style="--cat:' + col + '">' +
        metaHTML(c) +
        chipHTML(c) +
        '<div class="role">' + esc(role) + "</div>" +
        '<div class="q">' + fmt(c.q, "mark") + "</div>" +
        body +
      "</div>";
    var f = $("#examField");
    if (f) f.addEventListener("input", function () { answers[ansKey(c)] = f.value; });
    renderPreviews(c);
  }

  function renderDone() {
    renderPreviews(null);
    var sc = scope(), now = Date.now();
    var planned = sc.filter(function (c) { var s = getSched(c); return s && s.ivl && s.due > now; }).length;
    var dueLeft = sc.filter(isDue).length;
    var nextDue = Infinity;
    sc.forEach(function (c) { var s = getSched(c); if (s && s.ivl && s.due > now && s.due < nextDue) nextDue = s.due; });

    // 1) Auswahl ist leer
    if (sc.length === 0) {
      stageEl.innerHTML = '<div class="done"><h2>Keine Karten</h2><p>Diese Kombination aus Block und Filtern enthält nichts. Wähle einen anderen Block oder schalte einen Filter aus.</p></div>';
      return;
    }
    // 2) Es sind noch Karten fällig (z. B. nach Filter-/Moduswechsel)
    if (dueLeft > 0) {
      stageEl.innerHTML =
        '<div class="done"><h2>Bereit</h2><p>' + dueLeft + (dueLeft === 1 ? " Karte ist" : " Karten sind") + ' fällig.</p>' +
        '<div class="row center">' +
          '<button class="btn primary" id="d-go">Weiter lernen</button>' +
          '<button class="btn" id="d-shuffle">Mischen</button>' +
        "</div></div>";
      on($("#d-go"), "click", function () { buildDeck(false); render(); });
      on($("#d-shuffle"), "click", function () { buildDeck(true); render(); });
      return;
    }
    // 3) Nichts fällig → Pause-Panel mit Countdown + „Vorziehen"
    var heading = (planned === sc.length && sc.length > 0) ? "Alles terminiert 🎓" : "Nichts fällig";
    var cd = (nextDue === Infinity) ? "" :
      '<div class="count" id="count">' + fmtCountdown(nextDue - now) + "</div>" +
      "<p>bis zur nächsten fälligen Karte</p>";
    stageEl.innerHTML =
      '<div class="done"><h2>' + heading + "</h2>" +
        "<p>" + planned + " von " + sc.length + " Karten sind geplant.</p>" +
        cd +
        '<div class="row center">' +
          '<button class="btn primary" id="d-ahead">Vorziehen</button>' +
          '<button class="btn" id="d-reset">Zurücksetzen</button>' +
        "</div></div>";
    on($("#d-ahead"), "click", function () {
      onlyDue = false; store.set("kk-onlydue", false); syncDueBtn();
      buildDeck(false); render();
    });
    on($("#d-reset"), "click", resetCurrent);
    if (nextDue !== Infinity) startCountdown(nextDue);
  }

  // ---- Countdown ----
  function stopCountdown() { if (countdownTimer) { clearInterval(countdownTimer); countdownTimer = null; } }
  function startCountdown(when) {
    stopCountdown();
    countdownTimer = setInterval(function () {
      var rem = when - Date.now();
      if (rem <= 0) { stopCountdown(); buildDeck(false); render(); return; } // Karte ist jetzt fällig
      var el = $("#count"); if (el) el.textContent = fmtCountdown(rem);
    }, 1000);
  }

  // ---- Flip (Halb-Drehung, nur eine Fläche im DOM) ----
  function flip() {
    if (finished) return;
    if (mode === "exam") {
      saveField();
      revealed = !revealed;
      render();
      store.set("kk-answers", answers);
      return;
    }
    if (animating) return;
    revealed = !revealed;
    var card = $("#card");
    if (!card) { render(); return; }
    if (reduceMotion) { card.innerHTML = surfaceHTML(deck[idx], revealed); syncButtons(); return; }
    animating = true;
    card.style.transition = "transform .15s ease-in";
    card.style.transform = "rotateY(90deg)";
    setTimeout(function () {
      card.innerHTML = surfaceHTML(deck[idx], revealed);
      card.style.transition = "none";
      card.style.transform = "rotateY(-90deg)";
      void card.offsetWidth;          // reflow
      card.style.transition = "transform .15s ease-out";
      card.style.transform = "rotateY(0deg)";
      syncButtons();
      setTimeout(function () { animating = false; card.style.transition = ""; card.style.transform = ""; }, 170);
    }, 150);
  }

  function saveField() { var f = $("#examField"); if (f && deck[idx]) answers[ansKey(deck[idx])] = f.value; }

  // ---- Bewertung ----
  function rate(rating) {
    if (finished || !revealed) return;     // erst aufdecken, dann bewerten
    var c = deck[idx];
    if (!c) return;
    saveField();
    applyRating(c, rating);
    if (rating === "again") {
      // Karte später in dieser Sitzung erneut zeigen (Reset auf 1 Min wird sichtbar)
      deck.splice(idx, 1);
      deck.splice(Math.min(idx + 3, deck.length), 0, c);
      revealed = false;
      store.set("kk-answers", answers);
      render();
      return;
    }
    next();
  }

  function next() {
    if (finished) return;
    saveField(); store.set("kk-answers", answers);
    if (idx < deck.length - 1) { idx++; revealed = false; render(); }
    else { finished = true; render(); }
  }
  function prev() {
    if (finished) { if (!deck.length) return; finished = false; idx = deck.length - 1; revealed = false; render(); return; }
    saveField();
    if (idx > 0) { idx--; revealed = false; render(); }
  }

  function syncDueBtn() {
    if (!dueBtn) return;
    dueBtn.setAttribute("aria-pressed", String(onlyDue));
    dueBtn.textContent = onlyDue ? "Alle Karten" : "Nur fällige";
  }
  function syncButtons() {
    var canRate = revealed && !finished;
    if (prevBtn) prevBtn.disabled = (!finished && idx === 0) || (finished && deck.length === 0);
    if (nextBtn) nextBtn.disabled = finished;
    if (flipBtn) flipBtn.disabled = finished;
    ["again", "hard", "good", "easy"].forEach(function (k) { if (rateBtns[k]) rateBtns[k].disabled = !canRate; });
    if (flipBtn) flipBtn.textContent = mode === "exam"
      ? (revealed ? "Antwort ausblenden" : "Lösung vergleichen")
      : (revealed ? "Frage zeigen" : "Lösung zeigen");
  }

  function resetCurrent() {
    var name = subj().title + " — " + (curDeckDef().label || "Karteikarten");
    if (!confirm("Lernfortschritt für „" + name + "” zurücksetzen?")) return;
    var pre = subjectId + ":" + deckKey + ":";
    Object.keys(sched).forEach(function (k) { if (k.indexOf(pre) === 0) delete sched[k]; });
    store.set("kk-sched-v1", sched);
    onlyDue = true; store.set("kk-onlydue", true); syncDueBtn();
    buildDeck(false); renderFilters(); render();
  }

  // ---- Events ----
  on(prevBtn, "click", prev);
  on(nextBtn, "click", next);
  on(flipBtn, "click", flip);
  on(rateBtns.again, "click", function () { rate("again"); });
  on(rateBtns.hard,  "click", function () { rate("hard"); });
  on(rateBtns.good,  "click", function () { rate("good"); });
  on(rateBtns.easy,  "click", function () { rate("easy"); });
  on(shuffleBtn, "click", function () { saveField(); buildDeck(true); render(); });
  on(dueBtn, "click", function () { saveField(); onlyDue = !onlyDue; store.set("kk-onlydue", onlyDue); syncDueBtn(); buildDeck(false); render(); });
  on(resetBtn, "click", resetCurrent);

  on(brandBtn, "click", function (e) { e.stopPropagation(); toggleMenu(); });
  document.addEventListener("click", function (e) {
    if (subjMenu && !subjMenu.hidden && !e.target.closest("#subjectMenu") && !e.target.closest("#subjectBtn")) closeMenu();
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeMenu(); });

  if (deckSeg) Array.prototype.forEach.call(deckSeg.children, function (b) {
    b.addEventListener("click", function () {
      saveField();
      deckKey = b.getAttribute("data-deck"); store.set("kk-deck", deckKey);
      filter = "all"; tagFilter = {};
      buildDeck(false); renderFilters(); render();
    });
  });
  if (modeSeg) Array.prototype.forEach.call(modeSeg.children, function (b) {
    b.addEventListener("click", function () {
      saveField();
      mode = b.getAttribute("data-mode"); store.set("kk-mode", mode);
      revealed = false; render();
    });
  });

  // ---- Theme: Hell → Dunkel → OLED ----
  var THEMES = ["light", "dark", "oled"];
  function nextTheme(t) { var i = THEMES.indexOf(t); return THEMES[(i + 1) % THEMES.length]; }
  function updateThemeColor(t) {
    var c = t === "oled" ? "#000000" : (t === "dark" ? "#0f141b" : "#f1ece1");
    var m = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!m) { m = document.createElement("meta"); m.setAttribute("name", "theme-color"); document.head.appendChild(m); }
    m.setAttribute("content", c);
  }
  function applyTheme(t) {
    if (THEMES.indexOf(t) < 0) t = "light";
    document.documentElement.setAttribute("data-theme", t);
    var nx = nextTheme(t);
    var glyph = { light: "☀", dark: "☾", oled: "●" };   // Symbol = nächstes Design (was ein Tippen bewirkt)
    var label = { light: "Helles Design", dark: "Dunkles Design", oled: "OLED-Design" };
    if (themeBtn) { themeBtn.textContent = glyph[nx]; themeBtn.setAttribute("aria-label", label[nx] + " aktivieren"); }
    updateThemeColor(t);
    store.set("kk-theme", t);
  }
  on(themeBtn, "click", function () {
    applyTheme(nextTheme(document.documentElement.getAttribute("data-theme") || "light"));
  });

  // ---- Keyboard ----
  document.addEventListener("keydown", function (e) {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName || "")) return;
    var k = e.key;
    if (k === " " || k === "Enter") { e.preventDefault(); flip(); }
    else if (k === "ArrowRight") { e.preventDefault(); next(); }
    else if (k === "ArrowLeft") { e.preventDefault(); prev(); }
    else if (k === "1") rate("again");
    else if (k === "2") rate("hard");
    else if (k === "3") rate("good");
    else if (k === "4") rate("easy");
    else if (k.toLowerCase() === "s") { buildDeck(true); render(); }
    else if (k.toLowerCase() === "t" && themeBtn) themeBtn.click();
    else if (k.toLowerCase() === "f") cycleSubject();
  });

  // ---- Swipe (Touch) ----
  var tsx = 0, tsy = 0, tracking = false;
  if (stageEl) {
    stageEl.addEventListener("touchstart", function (e) {
      if (e.target.closest("textarea")) { tracking = false; return; }
      var t = e.changedTouches[0]; tsx = t.clientX; tsy = t.clientY; tracking = true;
    }, { passive: true });
    stageEl.addEventListener("touchend", function (e) {
      if (!tracking) return; tracking = false;
      var t = e.changedTouches[0], dx = t.clientX - tsx, dy = t.clientY - tsy;
      if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.6) { dx < 0 ? next() : prev(); }
    }, { passive: true });
  }

  // ---- Init ----
  applyTheme(store.get("kk-theme", (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light"));
  renderBrand();
  syncDeckLabels();
  syncDueBtn();
  buildDeck(false);
  renderFilters();
  render();
})();
