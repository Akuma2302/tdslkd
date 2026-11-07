// Utama (user portal home): one card per portal tab with a short description of its data and a link.
// The cards come from window.PORTAL_TABS (components/portalNav.js). No data is loaded here.
(function () {
  "use strict";

  // Old links like /#/TENGAH/SAS pointed at the legality form when it lived at the root.
  if (/^#\//.test(location.hash)) { location.replace("legality.html" + location.hash); return; }

  var grid = document.getElementById("homeGrid");
  if (!grid) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function pad(n) { return n < 10 ? "0" + n : String(n); }

  var tabs = (window.PORTAL_TABS || []).filter(function (t) { return !t.home; });
  tabs.forEach(function (t, i) {
    var ready = t.status === "Aktif";
    var card = el("a", "home-card" + (ready ? "" : " is-soon"));
    card.href = t.href;

    var top = el("div", "home-card-top");
    top.appendChild(el("span", "home-num", pad(i + 1)));
    top.appendChild(el("span", "home-status", t.status || ""));
    card.appendChild(top);

    card.appendChild(el("h2", "home-title", t.title || t.label));
    card.appendChild(el("p", "home-desc", t.desc || ""));

    var foot = el("div", "home-foot");
    foot.appendChild(el("span", "home-source", t.source || ""));
    foot.appendChild(el("span", "home-open", (ready ? "Buka " : "Lihat ") + t.label + " →"));
    card.appendChild(foot);

    grid.appendChild(card);
  });
})();
