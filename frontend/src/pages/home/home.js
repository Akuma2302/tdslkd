// Utama (user portal home): quick actions, one card per ready module with links straight to its
// pages (the same items as the navbar dropdown), and the modules still to come in one small row.
// Everything comes from window.PORTAL_TABS (components/portalNav.js). No data is loaded here.
(function () {
  "use strict";

  // Old links like /#/TENGAH/SAS pointed at the legality form when it lived at the root.
  if (/^#\//.test(location.hash)) { location.replace("/legality/database" + location.hash); return; }

  var quick = document.getElementById("homeQuick");
  var grid = document.getElementById("homeGrid");
  var soonRow = document.getElementById("homeSoon");
  if (!grid) return;

  // The jobs people open the portal for most often.
  var QUICK = [
    { label: "Hantar program", hint: "Borang Program Sekolah", href: "/legality/program#borang" },
    { label: "Kemas kini CRM", hint: "Database Legality", href: "/legality/database" },
    { label: "Tambah alumni", hint: "Alumni Back to School", href: "/alumni" }
  ];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function link(cls, text, href) { var a = el("a", cls, text); a.href = href; return a; }

  if (quick) {
    QUICK.forEach(function (q) {
      var a = link("home-quick-btn", null, q.href);
      a.appendChild(el("span", "home-quick-label", q.label));
      a.appendChild(el("span", "home-quick-hint", q.hint));
      a.appendChild(el("span", "home-quick-go", "→"));
      quick.appendChild(a);
    });
  }

  var tabs = (window.PORTAL_TABS || []).filter(function (t) { return !t.home; });
  var ready = tabs.filter(function (t) { return t.status === "Aktif"; });
  var soon = tabs.filter(function (t) { return t.status !== "Aktif"; });

  ready.forEach(function (t) {
    var card = el("article", "home-card");
    var top = el("div", "home-card-top");
    var title = el("h2", "home-title");
    title.appendChild(link("home-title-link", t.title || t.label, t.href));
    top.appendChild(title);
    top.appendChild(el("span", "home-status", t.status));
    card.appendChild(top);
    card.appendChild(el("p", "home-desc", t.short || t.desc || ""));

    // Straight to each page of the module (Database, Program, Panduan…)
    var links = el("div", "home-links");
    (t.menu || []).forEach(function (m) {
      if (m.soon) {
        var s = m.href ? link("home-link is-soon", null, m.href) : el("span", "home-link is-soon");
        s.appendChild(document.createTextNode(m.label));
        s.appendChild(el("small", null, "Akan datang"));
        links.appendChild(s);
      } else {
        links.appendChild(link("home-link", m.label + " →", m.href));
      }
    });
    card.appendChild(links);
    grid.appendChild(card);
  });

  if (soonRow && soon.length) {
    soonRow.appendChild(el("span", "home-soon-label", "Akan datang"));
    soon.forEach(function (t) { soonRow.appendChild(link("home-soon-chip", t.title || t.label, t.href)); });
    soonRow.hidden = false;
  }
})();
