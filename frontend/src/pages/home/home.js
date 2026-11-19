// Utama (user portal home, app style), two views on one page:
//   ·  (no hash)   greeting with today's date, two big actions (Hantar program, Cari sekolah), the next 3
//                  programmes ("Program akan datang") with "Lihat semua", and the units as a list
//   ·  #program    every programme still to come, grouped by month, with a filter:
//                  Semua · Hari ini · Minggu ini · Bulan ini · Tahun ini
// Programmes come from the Program sheet (backend upcomingPrograms, GET action "upcoming"); the last copy is
// kept in this browser and shown at once. The units come from window.PORTAL_TABS (layout/appShell.js).
(function () {
  "use strict";

  // Old links like /#/TENGAH/SAS pointed at the legality form when it lived at the root.
  if (/^#\//.test(location.hash)) { location.replace("/legality/database" + location.hash); return; }

  var root = document.getElementById("homeRoot");
  if (!root) return;
  var icon = window.YOSH_ICON || function () { return document.createTextNode(""); };
  var SHOW_ON_HOME = 3;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function link(cls, href) { var a = el("a", cls); a.href = href; return a; }

  // ---------- Formatting ----------
  // "PROGRAM KEPIMPINAN pelajar" → "Program kepimpinan pelajar"
  function sentence(s) {
    s = String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  // "NEGERI SEMBILAN" → "Negeri Sembilan"
  function titleCase(s) { return sentence(s).replace(/(^|\s)(\S)/g, function (m, a, c) { return a + c.toUpperCase(); }); }
  var BULAN = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
  var BULAN_PENUH = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai", "Ogos", "September", "Oktober", "November", "Disember"];
  var HARI = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  function dateOf(ymd) { var p = String(ymd).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function ymdOf(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function dayText(a, b) {
    var x = dateOf(a), y = dateOf(b || a);
    if (!b || a === b) return HARI[x.getDay()] + ", " + x.getDate() + " " + BULAN[x.getMonth()] + " " + x.getFullYear();
    if (x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth()) return x.getDate() + "–" + y.getDate() + " " + BULAN[x.getMonth()] + " " + x.getFullYear();
    return x.getDate() + " " + BULAN[x.getMonth()] + " – " + y.getDate() + " " + BULAN[y.getMonth()] + " " + y.getFullYear();
  }
  function startOfToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function whenTag(p) {
    var now = startOfToday();
    var d = Math.round((dateOf(p.mula) - now) / 86400000);
    if (d < 0) return { text: "Sedang berjalan", hot: true };
    if (d === 0) return { text: "Hari ini", hot: true };
    if (d === 1) return { text: "Esok", hot: true };
    if (d < 7) return { text: "Dalam " + d + " hari", hot: false };
    return null;
  }
  function placeText(p) {
    return [String(p.sekolah || "").trim(), p.negeri ? titleCase(p.negeri) : ""].filter(String).join(", ");
  }

  // One programme card
  function card(p) {
    var x = dateOf(p.mula);
    var row = el("article", "hm-prog");
    var cal = el("div", "hm-prog-date");
    cal.appendChild(el("span", "hm-prog-day", String(x.getDate())));
    cal.appendChild(el("span", "hm-prog-mon", BULAN[x.getMonth()]));
    row.appendChild(cal);
    var body = el("div", "hm-prog-body");
    var top = el("div", "hm-prog-top");
    top.appendChild(el("h3", "hm-prog-name", sentence(p.nama)));
    var tag = whenTag(p);
    if (tag) top.appendChild(el("span", "hm-prog-tag" + (tag.hot ? " is-hot" : ""), tag.text));
    body.appendChild(top);
    var meta = el("dl", "hm-prog-meta");
    [["Tarikh", dayText(p.mula, p.tamat)], ["Masa", p.masa || "—"], ["Tempat", placeText(p) || "—"]].forEach(function (m) {
      var line = el("div", "hm-prog-line");
      line.appendChild(el("dt", null, m[0]));
      line.appendChild(el("dd", null, m[1]));
      meta.appendChild(line);
    });
    body.appendChild(meta);
    var foot = el("div", "hm-prog-foot");
    if (p.jenis) foot.appendChild(el("span", "hm-prog-chip", p.jenis));
    if (p.cawangan) foot.appendChild(el("span", "hm-prog-chip", p.cawangan));
    if (foot.children.length) body.appendChild(foot);
    row.appendChild(body);
    return row;
  }

  // ---------- Data ----------
  var MEMO = "legality:memo:upcoming";
  var data = null, loadFailed = false;
  try { data = JSON.parse(localStorage.getItem(MEMO) || "null"); } catch (e) {}
  function programs() { return (data && data.programs) || []; }
  function loadData() {
    var Api = window.LegalityApi;
    if (!Api || !Api.configured) return;
    Api.get({ action: "upcoming" }).then(function (d) {
      data = d; loadFailed = false;
      try { localStorage.setItem(MEMO, JSON.stringify(d)); } catch (e) {}
      draw();
    }).catch(function () { loadFailed = true; draw(); });
  }

  // ---------- View 1: Utama ----------
  function drawHome() {
    if (window.YoshShell) window.YoshShell.setTitle(null);
    root.textContent = "";
    var today = new Date().toLocaleDateString("ms-MY", { weekday: "long", day: "numeric", month: "long" });
    var head = el("header", "hm-head");
    head.appendChild(el("p", "hm-date", today));
    head.appendChild(el("h1", "hm-hello", "Assalamualaikum"));
    root.appendChild(head);

    var actions = el("div", "hm-actions");
    [
      { label: "Hantar program", hint: "Ke group Telegram cawangan", href: "/legality/program", icon: "hantar", main: true },
      { label: "Cari sekolah", hint: "Database Legality", href: "/legality/database#/cari", icon: "sekolah" }
    ].forEach(function (q) {
      var a = link("hm-action" + (q.main ? " is-main" : ""), q.href);
      var ic = el("span", "hm-action-icon");
      ic.appendChild(icon(q.icon));
      a.appendChild(ic);
      a.appendChild(el("span", "hm-action-label", q.label));
      a.appendChild(el("span", "hm-action-hint", q.hint));
      actions.appendChild(a);
    });
    root.appendChild(actions);

    // Program akan datang: the next 3, then "Lihat semua"
    var board = el("section", "hm-board");
    var bh = el("div", "hm-board-head");
    bh.appendChild(el("h2", "hm-board-title", "Program akan datang"));
    var all = programs();
    if (all.length) bh.appendChild(el("span", "hm-board-count", all.length + " program"));
    board.appendChild(bh);
    var list = el("div", "hm-board-list");
    if (!data) list.appendChild(el("p", "hm-board-empty", loadFailed ? "Tidak dapat memuatkan program. Cuba muat semula halaman." : "Memuatkan…"));
    else if (!all.length) list.appendChild(el("p", "hm-board-empty", "Tiada program akan datang buat masa ini."));
    all.slice(0, SHOW_ON_HOME).forEach(function (p) { list.appendChild(card(p)); });
    board.appendChild(list);
    if (all.length > SHOW_ON_HOME) {
      var full = link("hm-board-all", "#program");
      full.appendChild(el("span", null, "Lihat semua program (" + all.length + ")"));
      full.appendChild(icon("chevron"));
      board.appendChild(full);
    }
    root.appendChild(board);

    root.appendChild(el("p", "app-label", "Unit"));
    var units = el("div", "app-list");
    var ICONS = { legality: "sekolah", alumni: "alumni", pentajmikan: "panduan", pembinaan: "panduan" };
    (window.PORTAL_TABS || []).filter(function (t) { return !t.home; }).forEach(function (t) {
      var ready = t.status === "Aktif";
      var row = link("app-row" + (ready ? "" : " is-soon"), t.href);
      var ic = el("span", "app-row-icon");
      ic.appendChild(icon(ICONS[t.id] || "panduan"));
      row.appendChild(ic);
      var txt = el("span", "app-row-text");
      txt.appendChild(el("span", "app-row-title", t.title || t.label));
      txt.appendChild(el("span", "app-row-sub", ready ? t.short : "Akan datang"));
      row.appendChild(txt);
      if (ready) { var ch = el("span", "app-row-go"); ch.appendChild(icon("chevron")); row.appendChild(ch); }
      units.appendChild(row);
    });
    root.appendChild(units);
  }

  // ---------- View 2: every programme, with a period filter ----------
  // A programme is in a period when its days (mula–tamat) overlap the period.
  var FILTERS = [
    { id: "semua", label: "Semua" },
    { id: "hari", label: "Hari ini" },
    { id: "minggu", label: "Minggu ini" },
    { id: "bulan", label: "Bulan ini" },
    { id: "tahun", label: "Tahun ini" }
  ];
  var filter = "semua";
  try { filter = sessionStorage.getItem("hm:filter") || "semua"; } catch (e) {}
  function period(id) {
    var t = startOfToday(), a = new Date(t), b = new Date(t);
    if (id === "minggu") { var dow = (t.getDay() + 6) % 7; a.setDate(t.getDate() - dow); b = new Date(a); b.setDate(a.getDate() + 6); }   // Isnin–Ahad
    else if (id === "bulan") { a = new Date(t.getFullYear(), t.getMonth(), 1); b = new Date(t.getFullYear(), t.getMonth() + 1, 0); }
    else if (id === "tahun") { a = new Date(t.getFullYear(), 0, 1); b = new Date(t.getFullYear(), 11, 31); }
    else if (id === "semua") return null;
    return [ymdOf(a), ymdOf(b)];
  }
  function inPeriod(p, id) {
    var r = period(id);
    return !r || (p.mula <= r[1] && (p.tamat || p.mula) >= r[0]);
  }
  function drawAll() {
    if (window.YoshShell) window.YoshShell.setTitle("Program akan datang", function () { location.hash = ""; });
    root.textContent = "";
    root.appendChild(el("h1", "app-h1", "Program akan datang"));
    var all = programs();
    var lead = el("p", "app-lead");
    root.appendChild(lead);

    var chips = el("div", "hm-filter");
    chips.setAttribute("role", "tablist");
    chips.setAttribute("aria-label", "Tapis ikut tempoh");
    FILTERS.forEach(function (f) {
      var n = all.filter(function (p) { return inPeriod(p, f.id); }).length;
      var b = el("button", "hm-filter-chip" + (f.id === filter ? " is-on" : ""));
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", f.id === filter ? "true" : "false");
      b.appendChild(document.createTextNode(f.label));
      b.appendChild(el("span", "hm-filter-n", String(n)));
      b.addEventListener("click", function () {
        filter = f.id;
        try { sessionStorage.setItem("hm:filter", filter); } catch (e) {}
        drawAll();
      });
      chips.appendChild(b);
    });
    root.appendChild(chips);

    var shown = all.filter(function (p) { return inPeriod(p, filter); });
    var r = period(filter);
    lead.textContent = shown.length + " program" + (r ? " · " + (r[0] === r[1] ? dayText(r[0]) : dayText(r[0], r[1])) : "");

    if (!data) { root.appendChild(el("p", "hm-board-empty", loadFailed ? "Tidak dapat memuatkan program. Cuba muat semula halaman." : "Memuatkan…")); return; }
    if (!shown.length) { root.appendChild(el("p", "hm-board-empty", "Tiada program untuk tempoh ini.")); return; }
    // Grouped by the month the programme starts in
    var lastKey = "";
    var list = null;
    shown.forEach(function (p) {
      var x = dateOf(p.mula), key = x.getFullYear() + "-" + x.getMonth();
      if (key !== lastKey) {
        lastKey = key;
        root.appendChild(el("p", "app-label hm-month", BULAN_PENUH[x.getMonth()] + " " + x.getFullYear()));
        list = el("div", "hm-board-list");
        root.appendChild(list);
      }
      list.appendChild(card(p));
    });
  }

  function draw() {
    if (location.hash === "#program") drawAll(); else drawHome();
  }
  window.addEventListener("hashchange", function () { draw(); window.scrollTo(0, 0); });
  draw();
  if (window.YoshGate) window.YoshGate.ready(loadData); else loadData();
})();
