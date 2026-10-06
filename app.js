(function () {
  "use strict";

  var units = window.UNITS || [];
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Intro ---------- */
  var intro = document.getElementById("intro");
  var enterBtn = document.getElementById("introEnter");
  var logo = document.getElementById("introLogo");
  var logoWrap = document.getElementById("introLogoWrap");

  function logoMissing() { logoWrap.classList.add("no-logo"); }
  if (logo.complete && logo.naturalWidth === 0) logoMissing();
  logo.addEventListener("error", logoMissing);

  function seen() {
    try { return sessionStorage.getItem("introSeen") === "1"; } catch (e) { return false; }
  }

  function closeIntro(instant) {
    if (!intro || intro.classList.contains("out")) return;
    try { sessionStorage.setItem("introSeen", "1"); } catch (e) {}
    document.removeEventListener("keydown", onIntroKey);
    document.body.classList.remove("locked");
    if (instant) { intro.remove(); intro = null; return; }
    intro.classList.add("out");
    setTimeout(function () {
      if (intro) { intro.remove(); intro = null; }
      var active = document.querySelector('.tab[aria-selected="true"]');
      if (active) active.focus({ preventScroll: true });
    }, 1150);
  }

  function onIntroKey(e) {
    if (e.key === "Enter" && intro.classList.contains("ready")) {
      e.preventDefault();
      closeIntro(reduced);
    }
  }

  if (seen()) {
    closeIntro(true);
  } else {
    requestAnimationFrame(function () { intro.classList.add("on"); });
    setTimeout(function () { intro.classList.add("sub"); }, reduced ? 0 : 900);
    setTimeout(function () {
      intro.classList.add("ready");
      enterBtn.focus({ preventScroll: true });
    }, reduced ? 0 : 2200);
    enterBtn.addEventListener("click", function () { closeIntro(reduced); });
    document.addEventListener("keydown", onIntroKey);
  }

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
  function count(u) { return (u.sections || []).length; }
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
    grid.appendChild(stat("Jumlah Bahagian", String(total), "Merentas semua unit"));
    (u.stats || []).forEach(function (s) { grid.appendChild(stat(s.label, s.value, s.note || "")); });

    // Sections per unit; hatched bars are units with nothing in them yet.
    var chart = widget("w-2", "Bahagian Mengikut Unit", total + " bahagian");
    var bars = el("div", "bars");
    realUnits.forEach(function (r) {
      var c = count(r);
      var bar = el("div", "bar");
      bar.title = r.name + ": " + (c ? c + " bahagian" : "belum diisi");
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
      textRow(row, r.name, count(r) ? count(r) + " bahagian" : "Belum diisi");
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
    tab.appendChild(el("span", "tab-num", u.overview ? "✦" : pad(i + 1)));
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
    } else if (count(u)) {
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

  document.getElementById("topDate").textContent = longDate(new Date());

  var tabs = Array.prototype.slice.call(tablist.querySelectorAll(".tab"));

  function select(id, opts) {
    opts = opts || {};
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
    if (opts.push !== false && location.hash !== "#" + id) {
      history.replaceState(null, "", "#" + id);
    }
    var u = units.filter(function (x) { return x.id === id; })[0];
    document.title = u.name + " — Yosh Junior";
  }

  tablist.addEventListener("click", function (e) {
    var t = e.target.closest(".tab");
    if (t) { select(t.dataset.unit); window.scrollTo(0, 0); }
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
    if (e.key !== "/" || intro || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
    e.preventDefault();
    searchInput.focus();
  });
})();
