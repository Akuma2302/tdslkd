(function () {
  "use strict";

  var units = window.UNITS || [];
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Intro (src/components/intro.js) ---------- */
  // When the intro closes, put keyboard focus on the open tab.
  window.addEventListener("yosh:introclosed", function () {
    var active = document.querySelector('.tab[aria-selected="true"]');
    if (active) active.focus({ preventScroll: true });
  });

  /* ---------- Tabs ---------- */
  var tablist = document.getElementById("tabs");
  var panels = document.getElementById("panels");
  var SVG = "http://www.w3.org/2000/svg";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  // Line icons for the sidebar (24×24, stroke = currentColor). Unit views can use them too (window.SIDE_ICON).
  var UNIT_ICONS = {
    overall: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
    murabbi: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    mutarabbi: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M22 11h-6",
    legality: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10M9 12l2 2 4-4",
    virality: "M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14",
    tls: "M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5",
    _: "M4 4h16v16H4z"
  };
  function icon(d) {
    var s = document.createElementNS(SVG, "svg");
    s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "18"); s.setAttribute("height", "18");
    s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor"); s.setAttribute("stroke-width", "1.8");
    s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round"); s.setAttribute("aria-hidden", "true");
    s.setAttribute("class", "tab-icon");
    var p = document.createElementNS(SVG, "path"); p.setAttribute("d", d); s.appendChild(p);
    return s;
  }
  window.SIDE_ICON = icon;
  var views = window.UNIT_VIEWS || {};
  function count(u) {
    var v = views[u.id];
    return (u.sections || []).length + (v && v.count ? v.count() : 0);
  }
  function describe(u) {
    var v = views[u.id];
    if (v && v.describe && v.count()) return v.describe();
    return count(u) ? count(u) + " bahagian" : "Belum diisi";
  }
  function shortName(u) { return u.name.replace(/^Unit\s+/i, ""); }
  function longDate(d) {
    return d.toLocaleDateString("ms-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }

  var realUnits = units.filter(function (u) { return !u.overview; });

  function widget(cls, title, meta) {
    var w = el("section", "w " + cls);
    var h = el("div", "w-head");
    h.appendChild(el("h2", "w-title", title));
    if (meta) h.appendChild(el("span", "w-meta", meta));
    w.appendChild(h);
    return w;
  }

  function stat(label, value, note, lead) {
    var w = el("section", "w w-1 stat" + (lead ? " stat-lead" : ""));
    w.appendChild(el("h2", "stat-label", label));
    w.appendChild(el("p", "stat-value", value));
    w.appendChild(el("p", "stat-note", note));
    return w;
  }

  function textRow(row, name, sub) {
    var text = el("span", "row-text");
    text.appendChild(el("span", "row-name", name));
    if (sub) text.appendChild(el("span", "row-sub", sub));
    row.appendChild(text);
  }

  // Every figure on the Overall tab is counted from units.js, never typed in by hand.
  function renderDashboard(panel, u) {
    var n = realUnits.length;
    var filled = realUnits.filter(function (r) { return count(r) > 0; }).length;
    var total = realUnits.reduce(function (sum, r) { return sum + count(r); }, 0);
    var most = realUnits.reduce(function (m, r) { return Math.max(m, count(r)); }, 0);
    var pct = n ? Math.round((filled / n) * 100) : 0;

    var grid = el("div", "dash-grid");

    grid.appendChild(stat("Jumlah Unit", String(n), "Dalam sistem pasukan", true));
    grid.appendChild(stat("Unit Berisi", String(filled), "Daripada " + n + " unit"));
    grid.appendChild(stat("Belum Diisi", String(n - filled), "Menunggu butiran"));
    grid.appendChild(stat("Jumlah Kandungan", String(total), "Merentas semua unit"));
    (u.stats || []).forEach(function (s) { grid.appendChild(stat(s.label, s.value, s.note || "")); });

    // Sections per unit; hatched bars are units with nothing in them yet.
    var chart = widget("w-2", "Kandungan Mengikut Unit", total + " kandungan");
    var bars = el("div", "bars");
    realUnits.forEach(function (r) {
      var c = count(r);
      var bar = el("div", "bar");
      bar.title = r.name + ": " + (c ? describe(r) : "belum diisi");
      if (c) bar.appendChild(el("span", "bar-count", String(c)));
      var pill = el("span", "bar-pill" + (c ? "" : " is-empty"));
      pill.style.height = (c ? 30 + 50 * (c / most) : 58) + "%";
      bar.appendChild(pill);
      bar.appendChild(el("span", "bar-label", shortName(r).slice(0, 3).toUpperCase()));
      bars.appendChild(bar);
    });
    chart.appendChild(bars);
    grid.appendChild(chart);

    var notice = widget("w-1", "Makluman");
    if (count(u)) {
      notice.appendChild(el("p", "notice-title", u.sections[0].title));
      var body = el("div", "notice-body");
      body.innerHTML = u.sections[0].body || "";
      notice.appendChild(body);
      if (count(u) > 1) notice.appendChild(el("p", "notice-more", "+" + (count(u) - 1) + " makluman lagi"));
    } else {
      notice.appendChild(el("p", "w-empty", "Belum ada makluman."));
    }
    grid.appendChild(notice);

    var list = widget("w-1", "Unit", n + " unit");
    var rows = el("div", "rows");
    realUnits.forEach(function (r, i) {
      var row = el("a", "row");
      row.href = "#" + r.id;
      row.appendChild(el("span", "badge", pad(i + 1)));
      textRow(row, r.name, describe(r));
      rows.appendChild(row);
    });
    list.appendChild(rows);
    grid.appendChild(list);

    var members = u.members || [];
    var team = widget("w-2", "Ahli Pasukan", members.length ? members.length + " ahli" : "");
    if (members.length) {
      var mrows = el("div", "rows");
      members.forEach(function (m) {
        var row = el("div", "row");
        var initials = m.name.split(/\s+/).slice(0, 2).map(function (p) { return p.charAt(0); }).join("").toUpperCase();
        row.appendChild(el("span", "badge", initials));
        textRow(row, m.name, m.role);
        if (m.unit) row.appendChild(el("span", "chip", m.unit));
        mrows.appendChild(row);
      });
      team.appendChild(mrows);
    } else {
      team.appendChild(el("p", "w-empty", "Belum ada ahli disenaraikan."));
    }
    grid.appendChild(team);

    var prog = widget("w-1", "Kelengkapan");
    var gauge = el("div", "gauge");
    var svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("viewBox", "0 0 200 112");
    svg.setAttribute("aria-hidden", "true");
    ["gauge-track", "gauge-fill"].forEach(function (cls) {
      if (cls === "gauge-fill" && !pct) return;
      var arc = document.createElementNS(SVG, "path");
      arc.setAttribute("d", "M 18 100 A 82 82 0 0 1 182 100");
      arc.setAttribute("fill", "none");
      arc.setAttribute("stroke-width", "22");
      arc.setAttribute("stroke-linecap", "round");
      arc.setAttribute("class", cls);
      if (cls === "gauge-fill") {
        arc.setAttribute("pathLength", "100");
        arc.setAttribute("stroke-dasharray", pct + " 100");
      }
      svg.appendChild(arc);
    });
    gauge.appendChild(svg);
    var read = el("div", "gauge-read");
    read.appendChild(el("p", "gauge-value", pct + "%"));
    read.appendChild(el("p", "gauge-label", "Unit berisi"));
    gauge.appendChild(read);
    prog.appendChild(gauge);
    var legend = el("div", "legend");
    [["Berisi", ""], ["Belum diisi", " is-empty"]].forEach(function (l) {
      var item = el("span");
      item.appendChild(el("i", "swatch" + l[1]));
      item.appendChild(document.createTextNode(l[0]));
      legend.appendChild(item);
    });
    prog.appendChild(legend);
    grid.appendChild(prog);

    var clock = widget("w-1 clock", "Masa Sekarang");
    var time = el("p", "clock-time");
    var day = el("p", "clock-date");
    clock.appendChild(time);
    clock.appendChild(day);
    function tick() {
      var d = new Date();
      time.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
      day.textContent = longDate(d);
    }
    tick();
    setInterval(tick, 1000);
    grid.appendChild(clock);

    panel.appendChild(grid);
  }

  units.forEach(function (u) {
    var i = realUnits.indexOf(u);

    if (u.overview) tablist.appendChild(el("p", "tab-group", "Menu"));
    else if (i === 0) tablist.appendChild(el("p", "tab-group", "Unit"));

    var tab = el("button", "tab");
    tab.type = "button";
    tab.id = "tab-" + u.id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "panel-" + u.id);
    tab.setAttribute("aria-selected", "false");
    tab.tabIndex = -1;
    tab.dataset.unit = u.id;
    tab.appendChild(icon(UNIT_ICONS[u.id] || UNIT_ICONS._));
    tab.appendChild(el("span", "tab-name", shortName(u)));
    tablist.appendChild(tab);

    var panel = el("section", "panel");
    panel.id = "panel-" + u.id;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", "tab-" + u.id);
    panel.tabIndex = 0;
    panel.hidden = true;

    var head = el("div", "panel-head");
    if (!u.overview) head.appendChild(el("p", "eyebrow", "Unit " + pad(i + 1) + " / " + pad(realUnits.length)));
    head.appendChild(el("h1", "panel-title", u.name));
    var summary = u.summary || (u.overview ? "Ringkasan semua unit dalam sistem pasukan." : "");
    if (summary) head.appendChild(el("p", "panel-summary", summary));
    panel.appendChild(head);

    if (u.overview) {
      panel.classList.add("dash");
      renderDashboard(panel, u);
    } else if (views[u.id]) {
      views[u.id].render(panel);
    } else if ((u.sections || []).length) {
      var grid = el("div", "section-grid");
      u.sections.forEach(function (s) {
        var card = el("article", "card");
        card.appendChild(el("h2", "card-title", s.title));
        var body = el("div", "card-body");
        body.innerHTML = s.body || "";
        card.appendChild(body);
        grid.appendChild(card);
      });
      panel.appendChild(grid);
    } else {
      var empty = el("div", "empty");
      empty.appendChild(el("p", "empty-title", "Belum ada butiran"));
      empty.appendChild(el("p", "empty-text", "Kandungan " + u.name + " akan dimasukkan di sini."));
      panel.appendChild(empty);
    }
    panels.appendChild(panel);
  });

  // Unit data that loads later (e.g. live form answers) re-draws the Overall figures.
  window.addEventListener("yosh:unitdata", function () {
    units.filter(function (u) { return u.overview; }).forEach(function (u) {
      var panel = document.getElementById("panel-" + u.id);
      var old = panel && panel.querySelector(".dash-grid");
      if (!old) return;
      old.remove();
      renderDashboard(panel, u);
    });
  });

  document.getElementById("topDate").textContent = longDate(new Date());

  var tabs = Array.prototype.slice.call(tablist.querySelectorAll(".tab"));

  function select(id, opts) {
    opts = opts || {};
    id = String(id || "").split("/")[0];   // "#legality/program": unit, then a sub-tab the unit view reads itself
    var found = units.some(function (u) { return u.id === id; });
    if (!found) id = units[0] && units[0].id;
    if (!id) return;
    tabs.forEach(function (t) {
      var on = t.dataset.unit === id;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      document.getElementById("panel-" + t.dataset.unit).hidden = !on;
      if (on) {
        if (opts.focus) t.focus();
        t.scrollIntoView({ block: "nearest", inline: "center", behavior: reduced ? "auto" : "smooth" });
      }
    });
    if (opts.push !== false && location.hash.split("/")[0] !== "#" + id) {
      history.replaceState(null, "", "#" + id);
    }
    var u = units.filter(function (x) { return x.id === id; })[0];
    document.title = u.name + " — Yosh Junior";
    // Extra sidebar groups of the open unit (e.g. Legality: Cawangan picker + its sub-tabs)
    var sideSub = document.getElementById("sideSub");
    if (sideSub && sideSub.dataset.unit !== id) {
      sideSub.textContent = "";
      sideSub.dataset.unit = id;
      if (views[id] && views[id].sidebar) views[id].sidebar(sideSub);
    }
  }

  // Phones: the menu button at the top right opens the unit list under the header.
  var side = document.querySelector(".side");
  var menuBtn = document.getElementById("menuBtn");
  function setMenu(open) {
    if (!menuBtn) return;
    side.classList.toggle("menu-open", open);
    menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
  }
  if (menuBtn) {
    menuBtn.addEventListener("click", function () { setMenu(!side.classList.contains("menu-open")); });
    document.addEventListener("click", function (e) { if (!side.contains(e.target)) setMenu(false); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && side.classList.contains("menu-open")) { setMenu(false); menuBtn.focus(); } });
  }

  tablist.addEventListener("click", function (e) {
    var t = e.target.closest(".tab");
    if (t) { select(t.dataset.unit); setMenu(false); window.scrollTo(0, 0); }
  });

  tablist.addEventListener("keydown", function (e) {
    var i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    var next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(tabs[next].dataset.unit, { focus: true });
  });

  document.getElementById("brand").addEventListener("click", function (e) {
    e.preventDefault();
    if (units[0]) select(units[0].id);
    window.scrollTo(0, 0);
  });

  window.addEventListener("hashchange", function () {
    select(location.hash.slice(1), { push: false });
    window.scrollTo(0, 0);
  });

  select(location.hash.slice(1));

  /* ---------- Search ---------- */
  var searchBox = document.getElementById("search");
  var searchInput = document.getElementById("searchInput");
  var searchResults = document.getElementById("searchResults");

  // Wide screens: the search sits at the top of the sidebar; phones keep it in the top bar.
  var sideSearch = document.getElementById("sideSearch");
  var topbar = document.querySelector(".topbar");
  var wideMq = window.matchMedia("(min-width: 601px)");
  function placeSearch() {
    var target = wideMq.matches && sideSearch ? sideSearch : topbar;
    if (target && searchBox.parentNode !== target) target.insertBefore(searchBox, target.firstChild);
  }
  placeSearch();
  if (wideMq.addEventListener) wideMq.addEventListener("change", placeSearch); else wideMq.addListener(placeSearch);

  var index = [];
  units.forEach(function (u) {
    index.push({ label: u.name, hint: u.overview ? "Menu" : "Unit", id: u.id });
    (u.sections || []).forEach(function (s) {
      index.push({ label: s.title, hint: u.name, id: u.id });
    });
  });

  function closeSearch() { searchResults.hidden = true; searchResults.textContent = ""; }

  function go(id) {
    searchInput.value = "";
    closeSearch();
    searchInput.blur();
    select(id);
    window.scrollTo(0, 0);
  }

  function runSearch() {
    var q = searchInput.value.trim().toLowerCase();
    searchResults.textContent = "";
    if (!q) { closeSearch(); return []; }
    var hits = index.filter(function (it) { return it.label.toLowerCase().indexOf(q) > -1; }).slice(0, 6);
    hits.forEach(function (it, n) {
      var b = el("button", "search-result" + (n ? "" : " first"));
      b.type = "button";
      b.appendChild(el("span", null, it.label));
      b.appendChild(el("small", null, it.hint));
      b.addEventListener("click", function () { go(it.id); });
      searchResults.appendChild(b);
    });
    if (!hits.length) searchResults.appendChild(el("p", "search-none", "Tiada padanan."));
    searchResults.hidden = false;
    return hits;
  }

  searchInput.addEventListener("input", runSearch);
  searchInput.addEventListener("focus", runSearch);
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      var hits = runSearch();
      if (hits.length) go(hits[0].id);
    } else if (e.key === "Escape") {
      searchInput.value = "";
      closeSearch();
      searchInput.blur();
    }
  });
  document.addEventListener("click", function (e) {
    if (!searchBox.contains(e.target)) closeSearch();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "/" || document.getElementById("intro") || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    e.preventDefault();
    searchInput.focus();
  });
})();
