// App shell for members, shared by every user page (index.html, legality/database.html, alumni.html…):
//   · a small top bar: logo (or ← back + page title inside a page), and on wide screens the same links as the tabs
//   · on phones a bottom tab bar: Utama · Sekolah · Hantar · Alumni · Lagi ("Lagi" opens a sheet with the rest and
//     Log keluar). A page can swap the tabs for its own (the school page uses Minggu ini · Cikgu · Rancangan).
// The same list (PORTAL_TABS) also feeds the Utama page (pages/home/home.js).
//
// Page API (window.YoshShell):
//   setTitle(title, back)        back: a URL / hash, or a function; null = logo again
//   setTabs(items, active)       items: [{ id, label, icon, onClick }]; null = the app tabs again
//   setActive(id) · setDot(id, tone)   tone: "bad" | "warn" | "" — a small dot on a tab
//
// To add a page: add it to TABS / MORE below and create the page with <body data-tab="id">
// and <header class="site-nav" id="siteNav"></header>.
(function () {
  "use strict";

  var TABS = [
    { id: "utama", label: "Utama", href: "/", home: true },
    {
      id: "legality", label: "Legality", status: "Aktif",
      title: "Legality", href: "/legality/database",
      short: "CRM cikgu, progress legality dan program sekolah ikut cawangan.",
      desc: "Checklist legality setiap sekolah mengikut cawangan: CRM cikgu dan KPI hubungan, progress legality " +
            "(meeting, pembentangan, surat kerjasama, tarikh mentoring, survey), program, analisa dan perancangan.",
      source: "Sheet Checklist Legality setiap cawangan",
      menu: [
        { id: "legality", label: "Database Legality", href: "/legality/database", hint: "CRM, KPI dan progress sekolah ikut cawangan" },
        { id: "program", label: "Program Sekolah", href: "/legality/program", hint: "Hantar maklumat program ke group Telegram cawangan" },
        { id: "legality-panduan", label: "Panduan Legality", href: "/legality/panduan", hint: "Level CRM cikgu dan fasa sekolah" }
      ]
    },
    {
      id: "alumni", label: "Alumni", status: "Aktif",
      title: "Alumni Back to School", href: "/alumni",
      short: "Alumni yang turun ke sekolah, program dibawa dan status reporting.",
      desc: "Senarai alumni yang turun ke sekolah: sekolah dan PIC yang dihubungi, program yang dibawa, " +
            "progress (PM cikgu hingga reporting) dan status reporting, mengikut cawangan.",
      source: "Sheet Alumni Back to School",
      menu: [
        { id: "alumni", label: "Database Alumni", href: "/alumni", hint: "Alumni Back to School ikut cawangan" },
        { label: "Panduan Alumni", soon: true, hint: "Cara susun program Alumni Back to School" }
      ]
    },
    {
      id: "pentajmikan", label: "Pentajmikan", status: "Akan datang",
      title: "Pentajmikan", href: "/pentajmikan",
      short: "Sedang disediakan.", desc: "Modul pentajmikan sedang disediakan.", source: "",
      menu: [
        { id: "pentajmikan", label: "Database Pentajmikan", href: "/pentajmikan", soon: true, hint: "Sedang disediakan" },
        { label: "Panduan Pentajmikan", soon: true, hint: "Sedang disediakan" }
      ]
    },
    {
      id: "pembinaan", label: "Pembinaan", status: "Akan datang",
      title: "Pembinaan", href: "/pembinaan",
      short: "Sedang disediakan.", desc: "Modul pembinaan sedang disediakan.", source: "",
      menu: [
        { id: "pembinaan", label: "Database Pembinaan", href: "/pembinaan", soon: true, hint: "Sedang disediakan" },
        { label: "Panduan Pembinaan", soon: true, hint: "Sedang disediakan" }
      ]
    }
  ];
  window.PORTAL_TABS = TABS;

  // ---------- Icons (24×24 outline, stroke = currentColor) ----------
  var P = {
    home: "M4 11 12 4l8 7M6 9.5V20h12V9.5M10 20v-5h4v5",
    sekolah: "M3 21h18M5 21V9l7-5 7 5v12M9 21v-5h6v5M10 10h4",
    hantar: "M12 5v14M5 12h14",
    alumni: "M2 9l10-5 10 5-10 5L2 9Zm4 2.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5",
    lagi: "M5 12h.01M12 12h.01M19 12h.01",
    minggu: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4M8 14h3",
    cikgu: "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c0-3 2.7-5 6-5s6 2 6 5M16 5.5a3 3 0 0 1 0 5.5M18 15c2 .5 3 2 3 5",
    rancangan: "M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15M15 6v15",
    back: "M15 5l-7 7 7 7",
    keluar: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10",
    panduan: "M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4zM9 8h6M9 12h4",
    chevron: "M9 6l6 6-6 6",
    cari: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4",
    tambah: "M12 5v14M5 12h14",
    simpan: "M5 13l4 4 10-10"
  };
  function icon(name, cls) {
    var ns = "http://www.w3.org/2000/svg";
    var s = document.createElementNS(ns, "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    s.setAttribute("class", "ab-icon" + (cls ? " " + cls : ""));
    var p = document.createElementNS(ns, "path");
    p.setAttribute("d", P[name] || P.lagi);
    p.setAttribute("fill", "none");
    p.setAttribute("stroke", "currentColor");
    p.setAttribute("stroke-width", name === "lagi" ? "3.2" : "1.8");
    p.setAttribute("stroke-linecap", "round");
    p.setAttribute("stroke-linejoin", "round");
    s.appendChild(p);
    return s;
  }
  window.YOSH_ICON = icon;

  // Chips for a short <select> (up to 6 choices): the select stays (hidden) and keeps the value, so the page's
  // own "change" handler does the saving. Tapping the chosen chip again clears it ("—").
  window.YoshChips = function (select, max) {
    var opts = Array.prototype.filter.call(select.options, function (o) { return o.value !== ""; });
    if (!opts.length || opts.length > (max || 6)) return null;
    var group = document.createElement("div");
    group.className = "yc-chips";
    group.setAttribute("role", "radiogroup");
    var lab = select.parentNode && select.parentNode.querySelector("label");
    if (lab) group.setAttribute("aria-label", lab.textContent);
    function paint() {
      Array.prototype.forEach.call(group.children, function (b) {
        var on = b.dataset.value === select.value;
        b.classList.toggle("is-on", on);
        b.setAttribute("aria-checked", on ? "true" : "false");
      });
    }
    opts.forEach(function (o) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "yc-chip";
      b.setAttribute("role", "radio");
      b.dataset.value = o.value;
      b.textContent = o.textContent;
      b.addEventListener("click", function () {
        select.value = select.value === o.value ? "" : o.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        paint();
      });
      group.appendChild(b);
    });
    select.classList.add("yc-hidden");
    select.tabIndex = -1;
    select.setAttribute("aria-hidden", "true");
    select.parentNode.insertBefore(group, select.nextSibling);
    select.addEventListener("change", paint);
    paint();
    return group;
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var host = document.getElementById("siteNav");
  if (!host) return;
  var current = document.body.getAttribute("data-tab");

  // The app tabs, and which page each one is "home" for
  var APP = [
    { id: "utama", label: "Utama", icon: "home", href: "/", pages: ["utama"] },
    { id: "sekolah", label: "Sekolah", icon: "sekolah", href: "/legality/database", pages: ["legality"] },
    { id: "hantar", label: "Hantar", icon: "hantar", href: "/legality/program", pages: ["program"], wide: "Hantar program" },
    { id: "alumni", label: "Alumni", icon: "alumni", href: "/alumni", pages: ["alumni"] },
    { id: "lagi", label: "Lagi", icon: "lagi", pages: ["pentajmikan", "pembinaan", "legality-panduan"] }
  ];
  var MORE = [
    { label: "Panduan Legality", href: "/legality/panduan", icon: "panduan" },
    { label: "Pentajmikan", href: "/pentajmikan", soon: true, icon: "panduan" },
    { label: "Pembinaan", href: "/pembinaan", soon: true, icon: "panduan" }
  ];
  function appActive() {
    var t = APP.filter(function (a) { return a.pages.indexOf(current) > -1; })[0];
    return t ? t.id : "";
  }

  document.body.classList.add("app-shell");

  // ---------- Top bar ----------
  var bar = el("div", "ab-bar");
  var back = el("button", "ab-back");
  back.type = "button";
  back.setAttribute("aria-label", "Kembali");
  back.appendChild(icon("back"));
  back.hidden = true;
  bar.appendChild(back);

  var brand = el("a", "ab-brand");
  brand.href = "/";
  brand.setAttribute("aria-label", "Yosh Junior — Utama");
  var logo = el("img");
  logo.src = "/assets/images/logo.png";
  logo.alt = "Yosh Junior";
  brand.appendChild(logo);
  bar.appendChild(brand);
  var title = el("span", "ab-title");
  title.hidden = true;
  bar.appendChild(title);

  // Wide screens: the same destinations as links in the bar
  var links = el("nav", "ab-links");
  links.setAttribute("aria-label", "Menu utama");
  bar.appendChild(links);

  var out = el("button", "ab-logout", "Log keluar");
  out.type = "button";
  out.setAttribute("data-logout", "");
  bar.appendChild(out);
  host.appendChild(bar);

  // ---------- Bottom tab bar (phones) ----------
  var tabbar = el("nav", "ab-tabbar");
  tabbar.setAttribute("aria-label", "Navigasi");
  document.body.appendChild(tabbar);

  // ---------- "Lagi" sheet ----------
  var sheet = el("div", "ab-sheet");
  sheet.hidden = true;
  var panel = el("div", "ab-sheet-panel");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("aria-label", "Lagi");
  panel.appendChild(el("span", "ab-sheet-grip"));
  panel.appendChild(el("p", "ab-sheet-title", "Lagi"));
  var list = el("div", "ab-sheet-list");
  MORE.forEach(function (m) {
    var a = el("a", "ab-sheet-item");
    a.href = m.href;
    a.appendChild(icon(m.icon));
    a.appendChild(el("span", "ab-sheet-label", m.label));
    if (m.soon) a.appendChild(el("span", "ab-soon", "Akan datang"));
    list.appendChild(a);
  });
  var lo = el("button", "ab-sheet-item is-danger");
  lo.type = "button";
  lo.setAttribute("data-logout", "");
  lo.appendChild(icon("keluar"));
  lo.appendChild(el("span", "ab-sheet-label", "Log keluar"));
  list.appendChild(lo);
  panel.appendChild(list);
  sheet.appendChild(panel);
  document.body.appendChild(sheet);
  function openSheet(on) {
    sheet.hidden = !on;
    document.body.classList.toggle("ab-sheet-open", on);
    if (on) { var f = sheet.querySelector(".ab-sheet-item"); if (f) f.focus(); }
  }
  sheet.addEventListener("click", function (e) { if (e.target === sheet) openSheet(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !sheet.hidden) openSheet(false); });

  // ---------- Drawing the tabs ----------
  var custom = null, activeId = appActive(), dots = {};
  function drawTabs() {
    tabbar.textContent = "";
    links.textContent = "";
    var items = custom || APP;
    tabbar.classList.toggle("is-custom", !!custom);
    items.forEach(function (t) {
      var on = t.id === activeId;
      var b = el(t.href && !custom ? "a" : "button", "ab-tab" + (on ? " is-on" : ""));
      if (b.tagName === "A") b.href = t.href; else b.type = "button";
      if (on) b.setAttribute("aria-current", "page");
      var ic = el("span", "ab-tab-icon");
      ic.appendChild(icon(t.icon));
      if (dots[t.id]) ic.appendChild(el("i", "ab-dot " + dots[t.id]));
      b.appendChild(ic);
      b.appendChild(el("span", "ab-tab-label", t.label));
      b.addEventListener("click", function (e) {
        if (t.id === "lagi" && !custom) { e.preventDefault(); openSheet(true); return; }
        if (t.onClick) { e.preventDefault(); t.onClick(); }
      });
      tabbar.appendChild(b);
    });
    // Wide-screen links are always the app destinations
    APP.forEach(function (t) {
      if (t.id === "lagi") {
        var m = el("button", "ab-link", "Lagi");
        m.type = "button";
        m.addEventListener("click", function () { openSheet(true); });
        if (appActive() === "lagi") m.classList.add("is-on");
        links.appendChild(m);
        return;
      }
      var a = el("a", "ab-link" + (appActive() === t.id ? " is-on" : ""), t.wide || t.label);
      a.href = t.href;
      links.appendChild(a);
    });
  }
  drawTabs();

  var backTo = null;
  back.addEventListener("click", function () {
    if (typeof backTo === "function") backTo();
    else if (backTo) location.href = backTo;
  });

  window.YoshShell = {
    setTitle: function (text, to) {
      backTo = to || null;
      back.hidden = !to;
      title.hidden = !text;
      title.textContent = text || "";
      brand.hidden = !!text;
      host.classList.toggle("has-title", !!text);
    },
    setTabs: function (items, active) {
      custom = items || null;
      dots = {};
      activeId = custom ? (active || (items[0] && items[0].id)) : appActive();
      drawTabs();
    },
    setActive: function (id) { activeId = id; drawTabs(); },
    setDot: function (id, tone) {
      if ((dots[id] || "") === (tone || "")) return;
      if (tone) dots[id] = tone; else delete dots[id];
      drawTabs();
    },
    icon: icon
  };

  window.addEventListener("scroll", function () { host.classList.toggle("is-scrolled", window.scrollY > 8); }, { passive: true });
})();
