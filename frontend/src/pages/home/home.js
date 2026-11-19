// Utama (user portal home, app style): greeting with today's date, two big actions (Hantar program,
// Cari sekolah) and the units as a list (the ones still to come greyed out).
// Everything comes from window.PORTAL_TABS (components/portalNav.js). No data is loaded here.
(function () {
  "use strict";

  // Old links like /#/TENGAH/SAS pointed at the legality form when it lived at the root.
  if (/^#\//.test(location.hash)) { location.replace("/legality/database" + location.hash); return; }

  var root = document.getElementById("homeRoot");
  if (!root) return;
  var icon = window.YOSH_ICON || function () { return document.createTextNode(""); };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function link(cls, href) { var a = el("a", cls); a.href = href; return a; }

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

  // ---------- Program akan datang (bulletin) ----------
  // Programmes still to come or running today, soonest first, from the Program sheet (backend upcomingPrograms).
  // The last copy is kept in this browser and shown at once; refreshed when the page opens.
  var board = el("section", "hm-board");
  var boardHead = el("div", "hm-board-head");
  boardHead.appendChild(el("h2", "hm-board-title", "Program akan datang"));
  var boardCount = el("span", "hm-board-count");
  boardHead.appendChild(boardCount);
  board.appendChild(boardHead);
  var boardList = el("div", "hm-board-list");
  boardList.appendChild(el("p", "hm-board-empty", "Memuatkan…"));
  board.appendChild(boardList);
  root.appendChild(board);

  // "PROGRAM KEPIMPINAN pelajar" → "Program kepimpinan pelajar"
  function sentence(s) {
    s = String(s || "").trim().replace(/\s+/g, " ").toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  var BULAN = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
  var HARI = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  function dateOf(ymd) { var p = ymd.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dayText(a, b) {
    var x = dateOf(a), y = dateOf(b || a);
    var one = HARI[x.getDay()] + ", " + x.getDate() + " " + BULAN[x.getMonth()] + " " + x.getFullYear();
    if (!b || a === b) return one;
    if (x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth()) return x.getDate() + "–" + y.getDate() + " " + BULAN[x.getMonth()] + " " + x.getFullYear();
    return x.getDate() + " " + BULAN[x.getMonth()] + " – " + y.getDate() + " " + BULAN[y.getMonth()] + " " + y.getFullYear();
  }
  function whenTag(p) {
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var d = Math.round((dateOf(p.mula) - now) / 86400000);
    if (d <= 0) return { text: dateOf(p.tamat) > now || d === 0 ? "Hari ini" : "Sedang berjalan", hot: true };
    if (d === 1) return { text: "Esok", hot: true };
    if (d < 7) return { text: "Dalam " + d + " hari", hot: false };
    return null;
  }
  function placeText(p) {
    var negeri = String(p.negeri || "").trim();
    return [String(p.sekolah || "").trim(), negeri ? sentence(negeri).replace(/\b(\w)/g, function (c) { return c.toUpperCase(); }) : ""].filter(String).join(", ");
  }
  function drawBoard(d) {
    boardList.textContent = "";
    var list = (d && d.programs) || [];
    boardCount.textContent = d && d.total ? d.total + " program" : "";
    if (!list.length) { boardList.appendChild(el("p", "hm-board-empty", "Tiada program akan datang buat masa ini.")); return; }
    list.forEach(function (p) {
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
      boardList.appendChild(row);
    });
  }
  var MEMO = "legality:memo:upcoming";
  try { var m = JSON.parse(localStorage.getItem(MEMO) || "null"); if (m) drawBoard(m); } catch (e) {}
  function loadBoard() {
    var Api = window.LegalityApi;
    if (!Api || !Api.configured) { board.hidden = true; return; }
    Api.get({ action: "upcoming" }).then(function (d) {
      try { localStorage.setItem(MEMO, JSON.stringify(d)); } catch (e) {}
      drawBoard(d);
    }).catch(function () {
      if (!boardList.querySelector(".hm-prog")) { boardList.textContent = ""; boardList.appendChild(el("p", "hm-board-empty", "Tidak dapat memuatkan program. Cuba muat semula halaman.")); }
    });
  }
  if (window.YoshGate) window.YoshGate.ready(loadBoard); else loadBoard();

  root.appendChild(el("p", "app-label", "Unit"));
  var list = el("div", "app-list");
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
    list.appendChild(row);
  });
  root.appendChild(list);
})();
