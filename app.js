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

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  var realUnits = units.filter(function (u) { return !u.overview; });

  units.forEach(function (u) {
    var i = realUnits.indexOf(u);
    var tab = el("button", "tab");
    tab.type = "button";
    tab.id = "tab-" + u.id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", "panel-" + u.id);
    tab.setAttribute("aria-selected", "false");
    tab.tabIndex = -1;
    tab.dataset.unit = u.id;
    tab.appendChild(el("span", "tab-num", u.overview ? "✦" : pad(i + 1)));
    tab.appendChild(el("span", "tab-name", u.name.replace(/^Unit\s+/i, "")));
    tablist.appendChild(tab);

    var panel = el("section", "panel");
    panel.id = "panel-" + u.id;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", "tab-" + u.id);
    panel.tabIndex = 0;
    panel.hidden = true;

    var head = el("div", "panel-head");
    head.appendChild(el("p", "eyebrow", u.overview
      ? realUnits.length + " Unit"
      : "Unit " + pad(i + 1) + " / " + pad(realUnits.length)));
    head.appendChild(el("h1", "panel-title", u.name));
    if (u.summary) head.appendChild(el("p", "panel-summary", u.summary));
    panel.appendChild(head);

    if (u.overview) {
      var list = el("div", "unit-grid");
      realUnits.forEach(function (r, n) {
        var link = el("a", "unit-link");
        link.href = "#" + r.id;
        link.appendChild(el("span", "unit-link-num", pad(n + 1)));
        link.appendChild(el("span", "unit-link-name", r.name));
        link.appendChild(el("span", "unit-link-arrow", "→"));
        list.appendChild(link);
      });
      panel.appendChild(list);
    }

    if (u.sections && u.sections.length) {
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
    } else if (!u.overview) {
      var empty = el("div", "empty");
      empty.appendChild(el("p", "empty-title", "Belum ada butiran"));
      empty.appendChild(el("p", "empty-text", "Kandungan " + u.name + " akan dimasukkan di sini."));
      panel.appendChild(empty);
    }
    panels.appendChild(panel);
  });

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
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length;
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
})();
