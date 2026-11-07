// Portal navbar for members, shared by every user page (index.html, legality.html, alumni.html…):
// logo on the left, menu with dropdowns in the middle, "Log keluar" on the right; a ☰ menu on phones.
// The same list also feeds the cards on the Utama page (pages/home/home.js).
//
// To add a page: add an item to the right menu below and create the page with <body data-tab="id">
// and <header class="site-nav" id="siteNav"></header>. Items with soon: true show "Akan datang".
(function () {
  "use strict";

  var TABS = [
    { id: "utama", label: "Utama", href: "./", home: true },
    {
      id: "legality", label: "Legality", status: "Aktif",
      title: "Database Legality", href: "legality.html",
      desc: "Checklist legality setiap sekolah mengikut cawangan: CRM cikgu dan KPI hubungan, progress legality " +
            "(meeting, pembentangan, surat kerjasama, tarikh mentoring, survey), program, analisa dan perancangan.",
      source: "Sheet Checklist Legality setiap cawangan",
      menu: [
        { id: "legality", label: "Database Legality", href: "legality.html", hint: "CRM, KPI dan progress sekolah ikut cawangan" },
        { label: "Panduan Legality", soon: true, hint: "Langkah dan SOP urusan legality sekolah" }
      ]
    },
    {
      id: "alumni", label: "Alumni", status: "Aktif",
      title: "Alumni Back to School", href: "alumni.html",
      desc: "Senarai alumni yang turun ke sekolah: sekolah dan PIC yang dihubungi, program yang dibawa, " +
            "progress (PM cikgu hingga reporting) dan status reporting, mengikut cawangan.",
      source: "Sheet Alumni Back to School",
      menu: [
        { id: "alumni", label: "Database Alumni", href: "alumni.html", hint: "Alumni Back to School ikut cawangan" },
        { label: "Panduan Alumni", soon: true, hint: "Cara susun program Alumni Back to School" }
      ]
    },
    {
      id: "pentajmikan", label: "Pentajmikan", status: "Akan datang",
      title: "Pentajmikan", href: "pentajmikan.html",
      desc: "Modul pentajmikan sedang disediakan.",
      source: "",
      menu: [
        { id: "pentajmikan", label: "Database Pentajmikan", href: "pentajmikan.html", soon: true, hint: "Sedang disediakan" },
        { label: "Panduan Pentajmikan", soon: true, hint: "Sedang disediakan" }
      ]
    },
    {
      id: "pembinaan", label: "Pembinaan", status: "Akan datang",
      title: "Pembinaan", href: "pembinaan.html",
      desc: "Modul pembinaan sedang disediakan.",
      source: "",
      menu: [
        { id: "pembinaan", label: "Database Pembinaan", href: "pembinaan.html", soon: true, hint: "Sedang disediakan" },
        { label: "Panduan Pembinaan", soon: true, hint: "Sedang disediakan" }
      ]
    }
  ];
  window.PORTAL_TABS = TABS;

  var host = document.getElementById("siteNav");
  if (!host) return;
  var current = document.body.getAttribute("data-tab");

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  var bar = el("div", "site-nav-inner");

  var brand = el("a", "site-brand");
  brand.href = "./";
  brand.setAttribute("aria-label", "Yosh Junior — Utama");
  var logo = el("img");
  logo.src = "assets/images/logo.png";
  logo.alt = "Yosh Junior";
  brand.appendChild(logo);
  bar.appendChild(brand);

  var burger = el("button", "site-burger");
  burger.type = "button";
  burger.setAttribute("aria-label", "Menu");
  burger.setAttribute("aria-expanded", "false");
  burger.setAttribute("aria-controls", "siteMenu");
  burger.innerHTML = "<span></span><span></span><span></span>";
  bar.appendChild(burger);

  var menu = el("ul", "site-menu");
  menu.id = "siteMenu";
  var openItem = null;

  function closeAll() {
    if (openItem) { openItem.classList.remove("is-open"); openItem.querySelector(".site-link").setAttribute("aria-expanded", "false"); openItem = null; }
  }

  TABS.forEach(function (t, i) {
    var li = el("li", "site-item");
    var active = t.id === current || (t.menu || []).some(function (m) { return m.id && m.id === current; });
    if (active) li.classList.add("is-active");

    if (!t.menu) {
      var a = el("a", "site-link", t.label);
      a.href = t.href;
      if (active) a.setAttribute("aria-current", "page");
      li.appendChild(a);
      menu.appendChild(li);
      return;
    }

    var hoverAt = 0;
    var btn = el("button", "site-link");
    btn.type = "button";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "siteDrop" + i);
    btn.appendChild(document.createTextNode(t.label));
    btn.appendChild(el("span", "site-caret"));
    li.appendChild(btn);

    var drop = el("div", "site-drop");
    drop.id = "siteDrop" + i;
    var list = el("ul", "site-drop-list");
    t.menu.forEach(function (m) {
      var item = el("li");
      var link = el(m.soon && !m.href ? "span" : "a", "site-drop-link" + (m.soon ? " is-soon" : "") + (m.id === current ? " is-current" : ""));
      if (link.tagName === "A") link.href = m.href;
      if (link.tagName === "SPAN") link.setAttribute("aria-disabled", "true");
      var text = el("span", "site-drop-text");
      text.appendChild(el("span", "site-drop-label", m.label));
      if (m.hint) text.appendChild(el("span", "site-drop-hint", m.hint));
      link.appendChild(text);
      if (m.soon) link.appendChild(el("span", "site-soon", "Akan datang"));
      item.appendChild(link);
      list.appendChild(item);
    });
    drop.appendChild(list);
    li.appendChild(drop);

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      // A click right after hover opened it keeps it open instead of closing it again.
      var wasOpen = li.classList.contains("is-open") && Date.now() - hoverAt > 400;
      closeAll();
      if (!wasOpen) { li.classList.add("is-open"); btn.setAttribute("aria-expanded", "true"); openItem = li; }
    });
    // Desktop: open on hover too.
    li.addEventListener("mouseenter", function () {
      if (window.matchMedia("(min-width: 861px)").matches) { hoverAt = Date.now(); closeAll(); li.classList.add("is-open"); btn.setAttribute("aria-expanded", "true"); openItem = li; }
    });
    li.addEventListener("mouseleave", function () {
      if (window.matchMedia("(min-width: 861px)").matches && openItem === li) closeAll();
    });
    menu.appendChild(li);
  });
  bar.appendChild(menu);

  var out = el("button", "site-logout", "Log keluar");
  out.type = "button";
  out.setAttribute("data-logout", "");
  bar.appendChild(out);

  host.appendChild(bar);

  burger.addEventListener("click", function () {
    var open = host.classList.toggle("is-menu-open");
    burger.setAttribute("aria-expanded", open ? "true" : "false");
  });
  document.addEventListener("click", function (e) { if (!host.contains(e.target)) closeAll(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeAll(); host.classList.remove("is-menu-open"); burger.setAttribute("aria-expanded", "false"); }
  });
  window.addEventListener("scroll", function () { host.classList.toggle("is-scrolled", window.scrollY > 8); }, { passive: true });
})();
