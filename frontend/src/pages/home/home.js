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
