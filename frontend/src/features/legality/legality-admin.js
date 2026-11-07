// Unit Legality dashboard (admin): compiles every cawangan's Checklist Legality sheet —
// schools, CRM people, CRM phases and the six Progress Legality steps — through the
// Legality API (src/services/legalityApi.js). Uses the same access code as the user portal (index.html).
(function () {
  "use strict";

  var Api = window.LegalityApi;
  var API = Api.configured;
  var ALL = "*";
  var state = { data: null, loading: false, error: "", needKod: false };
  var listeners = [];

  var getKod = Api.getKod, setKod = Api.setKod;
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {}
    return null;
  }

  function changed() {
    listeners.forEach(function (f) { f(); });
    window.dispatchEvent(new Event("yosh:unitdata"));
  }

  function load(fresh) {
    if (!API) return;
    if (!getKod()) { state.needKod = true; changed(); return; }
    state.loading = true; state.error = ""; state.needKod = false;
    changed();
    var params = { action: "summary" };
    if (fresh) params.fresh = "1";
    Api.get(params)
      .then(function (d) { state.data = d; })
      .catch(function (e) {
        if (e.kod) { state.needKod = true; state.error = "Kod akses tidak sah."; return; }
        state.error = e.message || String(e);
      })
      .then(function () { state.loading = false; changed(); });
  }

  // ---------- Helpers ----------

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function sum(a) { return a.reduce(function (t, v) { return t + v; }, 0); }
  function pct(a, b) { return b ? Math.round((a / b) * 100) : 0; }

  function widget(cls, titleText, meta) {
    var w = el("section", "w " + cls);
    var h = el("div", "w-head");
    h.appendChild(el("h2", "w-title", titleText));
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

  function hbar(label, value, max, extra) {
    var row = el("div", "hbar");
    row.appendChild(el("span", "hbar-label", label)).title = label;
    var track = el("span", "hbar-track");
    track.appendChild(el("span", "hbar-fill")).style.width = (max ? Math.min(100, Math.round((value / max) * 100)) : 0) + "%";
    row.appendChild(track);
    row.appendChild(el("span", "hbar-value", String(value)));
    if (extra != null) row.appendChild(el("span", "hbar-extra", extra));
    return row;
  }

  // Schools (with their cawangan) for the chosen view.
  function schoolsFor(branch) {
    var out = [];
    state.data.cawangan.forEach(function (c) {
      if (branch !== ALL && c.id !== branch) return;
      c.schools.forEach(function (s) { out.push({ cawangan: c.id, s: s }); });
    });
    return out;
  }

  // ---------- Rendering ----------

  function kodBox(host) {
    // The login screen (components/gate.js) asks for the code again.
    if (window.YoshGate) { state.needKod = false; window.YoshGate.show(state.error ? "Kod akses telah ditukar. Masukkan kod baru." : ""); window.YoshGate.ready(function () { load(true); }); return; }
    var box = el("div", "empty");
    box.appendChild(el("p", "empty-title", "Masukkan kod akses Unit Legality"));
    box.appendChild(el("p", "empty-text", state.error || "Data legality dilindungi kod akses. Kod yang sama digunakan dalam borang Checklist Legality."));
    var row = el("div", "lgd-key");
    var input = el("input", "borang-input");
    input.placeholder = "Kod akses";
    input.setAttribute("aria-label", "Kod akses");
    input.autocomplete = "off";
    var go = el("button", "link-btn", "Masuk");
    go.type = "button";
    function submit() { var k = input.value.trim().toUpperCase(); if (k) { setKod(k); load(true); } }
    go.addEventListener("click", submit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    row.appendChild(input);
    row.appendChild(go);
    box.appendChild(row);
    host.appendChild(box);
  }

  function links(branch) {
    var box = el("div", "lgd-links");
    var a = el("a", "link-btn", "Buka portal user ↗");
    a.href = new URL("./" + (branch && branch !== ALL ? "#/" + encodeURIComponent(branch) : ""), location.href).href;
    a.target = "_blank"; a.rel = "noopener";
    box.appendChild(a);
    (state.data ? state.data.cawangan : []).forEach(function (c) {
      if (!c.url || (branch !== ALL && c.id !== branch)) return;
      var s = el("a", "link-btn", "Sheet " + c.id + " ↗");
      s.href = c.url; s.target = "_blank"; s.rel = "noopener";
      box.appendChild(s);
    });
    return box;
  }

  function view(body, branch) {
    body.textContent = "";
    var d = state.data;
    var items = d.items;
    var rows = schoolsFor(branch);
    var n = rows.length;
    var people = sum(rows.map(function (x) { return x.s.people; }));
    var aktif = sum(rows.map(function (x) { return x.s.aktif; }));
    var stepCount = items.map(function (it, i) { return rows.filter(function (x) { return x.s.progress[i]; }).length; });

    var grid = el("div", "dash-grid");
    grid.appendChild(stat("Sekolah", String(n), branch === ALL ? "Dalam " + d.cawangan.filter(function (c) { return c.schools.length; }).length + " cawangan" : "Cawangan " + branch, true));
    grid.appendChild(stat("Orang CRM", String(people), aktif + " ditanda Ada (CRM aktif)"));
    grid.appendChild(stat("Set Meeting", stepCount[0] + "/" + n, pct(stepCount[0], n) + "% sekolah sudah set tarikh meeting"));
    grid.appendChild(stat("Tarikh Mentoring", stepCount[3] + "/" + n, pct(stepCount[3], n) + "% sekolah sudah dapat tarikh program"));

    // Steps funnel
    var steps = widget("w-2 lgd-steps", "Progress mengikut langkah", "bilangan sekolah");
    var bars = el("div", "hbars");
    items.forEach(function (it, i) { bars.appendChild(hbar((i + 1) + ". " + it.short, stepCount[i], n, pct(stepCount[i], n) + "%")); });
    steps.appendChild(bars);
    grid.appendChild(steps);

    // CRM phase
    var phase = {};
    rows.forEach(function (x) { Object.keys(x.s.phase).forEach(function (k) { phase[k] = (phase[k] || 0) + x.s.phase[k]; }); });
    var keys = Object.keys(phase).sort();
    var ph = widget("w-2", "Phase CRM", people + " orang");
    var pb = el("div", "hbars");
    var withPhase = sum(keys.map(function (k) { return phase[k]; }));
    keys.forEach(function (k) { pb.appendChild(hbar(k, phase[k], people)); });
    if (people > withPhase) pb.appendChild(hbar("Belum ditetapkan", people - withPhase, people));
    if (!people) pb.appendChild(el("p", "empty-text", "Belum ada orang CRM."));
    ph.appendChild(pb);
    grid.appendChild(ph);

    // Per cawangan (only in the all view)
    if (branch === ALL) {
      var bw = widget("w-4", "Mengikut cawangan");
      var wrap = el("div", "tbl-wrap");
      var t = el("table", "mtable");
      var thead = el("thead"), tr = el("tr");
      ["Cawangan", "Sekolah", "CRM"].concat(items.map(function (it) { return it.short; })).forEach(function (h, i) {
        tr.appendChild(el("th", i ? "num" : null, h));
      });
      thead.appendChild(tr); t.appendChild(thead);
      var tb = el("tbody");
      d.cawangan.forEach(function (c) {
        var r = el("tr");
        r.appendChild(el("td", null, c.id));
        r.appendChild(el("td", "num", String(c.schools.length)));
        r.appendChild(el("td", "num", String(sum(c.schools.map(function (s) { return s.people; })))));
        items.forEach(function (it, i) {
          var k = c.schools.filter(function (s) { return s.progress[i]; }).length;
          r.appendChild(el("td", "num" + (k ? "" : " muted"), c.schools.length ? k + "/" + c.schools.length : "–"));
        });
        tb.appendChild(r);
      });
      t.appendChild(tb);
      wrap.appendChild(t);
      bw.appendChild(wrap);
      grid.appendChild(bw);
    }

    // Progress matrix (like the Progress Legality Sekolah table)
    var mw = widget("w-4", "Progress Legality Sekolah", n + " sekolah");
    if (!n) {
      mw.appendChild(el("p", "empty-text", "Belum ada sekolah untuk paparan ini."));
    } else {
      var mwrap = el("div", "lgd-matrix-wrap");
      var m = el("table", "lgd-matrix");
      var mh = el("tr");
      mh.appendChild(el("th", null, "Sekolah"));
      items.forEach(function (it) { mh.appendChild(el("th", null, it.label)).title = it.label; });
      mh.appendChild(el("th", null, "Jumlah"));
      var mhead = el("thead"); mhead.appendChild(mh); m.appendChild(mhead);
      var mb = el("tbody");
      rows.forEach(function (x) {
        var r = el("tr");
        var name = el("td", "lgd-school", x.s.name);
        if (branch === ALL) name.appendChild(el("small", null, x.cawangan));
        name.title = x.s.people + " orang CRM · " + x.s.programs + " program";
        r.appendChild(name);
        x.s.progress.forEach(function (v, i) {
          var td = el("td", v ? "is-yes" : "is-no");
          td.title = items[i].label + ": " + (v ? "Dah buat" : "Belum");
          td.setAttribute("aria-label", v ? "Dah buat" : "Belum");
          r.appendChild(td);
        });
        r.appendChild(el("td", "lgd-total", x.s.progress.filter(Boolean).length + "/" + items.length));
        mb.appendChild(r);
      });
      m.appendChild(mb);
      mwrap.appendChild(m);
      mw.appendChild(mwrap);
      var leg = el("div", "lgd-legend");
      [["#1fbf5b", "Dah buat"], ["#d93a3a", "Belum"]].forEach(function (l) {
        var s = el("span");
        s.appendChild(el("i")).style.background = l[0];
        s.appendChild(document.createTextNode(l[1]));
        leg.appendChild(s);
      });
      mw.appendChild(leg);
    }
    grid.appendChild(mw);

    body.appendChild(grid);
  }

  function render(panel) {
    panel.classList.add("dash");
    var host = el("div");
    panel.appendChild(host);

    function build() {
      host.textContent = "";
      var bar = el("div", "report-bar");
      var meta = el("p", "report-meta");
      bar.appendChild(meta);
      host.appendChild(bar);

      if (!API) {
        var e = el("div", "empty");
        e.appendChild(el("p", "empty-title", "Belum disambungkan"));
        e.appendChild(el("p", "empty-text", "Masukkan pautan Apps Script Legality dalam config.js (legalityApi)."));
        host.appendChild(e);
        return;
      }
      if (state.needKod) { host.appendChild(links(ALL)); kodBox(host); return; }
      if (state.loading && !state.data) { meta.textContent = "Mengumpul data semua cawangan…"; return; }
      if (state.error && !state.data) {
        host.appendChild(el("p", "report-warning", "Tidak dapat memuatkan data legality (" + state.error + ")."));
        return;
      }
      if (!state.data) return;

      var gen = new Date(state.data.generated);
      meta.textContent = state.loading ? "Mengemas kini…" :
        "Data dikemas kini " + gen.toLocaleString("ms-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

      var label = el("label", "month-pick");
      label.appendChild(el("span", null, "Cawangan"));
      var select = el("select");
      var all = el("option", null, "Semua cawangan");
      all.value = ALL;
      select.appendChild(all);
      state.data.cawangan.forEach(function (c) {
        var o = el("option", null, c.id + " · " + c.schools.length + " sekolah");
        o.value = c.id;
        select.appendChild(o);
      });
      var saved = store("legalityBranch");
      select.value = saved && state.data.cawangan.some(function (c) { return c.id === saved; }) ? saved : ALL;
      label.appendChild(select);

      var refresh = el("button", "link-btn", "Muat semula");
      refresh.type = "button";
      refresh.addEventListener("click", function () { load(true); });

      var tools = el("div", "report-tools");
      tools.appendChild(label);
      tools.appendChild(refresh);
      bar.appendChild(tools);

      var linkBox = el("div");
      host.appendChild(linkBox);
      var body = el("div");
      host.appendChild(body);
      function draw() {
        linkBox.textContent = "";
        linkBox.appendChild(links(select.value));
        view(body, select.value);
      }
      select.addEventListener("change", function () { store("legalityBranch", select.value); draw(); });
      draw();
    }

    listeners.push(build);
    build();
  }

  function totals() {
    if (!state.data) return { schools: 0, people: 0 };
    var rows = schoolsFor(ALL);
    return { schools: rows.length, people: sum(rows.map(function (x) { return x.s.people; })) };
  }

  window.UNIT_VIEWS = window.UNIT_VIEWS || {};
  window.UNIT_VIEWS.legality = {
    render: render,
    count: function () { return totals().schools; },
    describe: function () { var t = totals(); return t.schools + " sekolah · " + t.people + " CRM"; }
  };

  // Load once the admin has logged in (components/gate.js).
  if (window.YoshGate) window.YoshGate.ready(function () { load(false); }); else load(false);
})();
