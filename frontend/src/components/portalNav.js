// Portal tabs for members, shared by every user page (index.html, pentajmikan.html, pembinaan.html…).
// To add a tab: add an entry here and create its page with <body data-tab="id"> and <nav id="portalTabs">.
(function () {
  "use strict";

  var TABS = [
    { id: "legality",    label: "Database Legality", href: "./" },
    { id: "pentajmikan", label: "Pentajmikan",       href: "pentajmikan.html" },
    { id: "pembinaan",   label: "Pembinaan",         href: "pembinaan.html" }
  ];

  var nav = document.getElementById("portalTabs");
  if (!nav) return;
  var current = document.body.getAttribute("data-tab");
  nav.textContent = "";
  TABS.forEach(function (t) {
    var a = document.createElement("a");
    a.className = "up-tab" + (t.id === current ? " is-active" : "");
    a.href = t.href;
    a.textContent = t.label;
    if (t.id === current) a.setAttribute("aria-current", "page");
    nav.appendChild(a);
  });
})();
