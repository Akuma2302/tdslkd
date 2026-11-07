// Checklist Legality (user side): pick a cawangan, pick a school, then view and update each part of
// that school's tab in the cawangan's Google Sheet, through src/services/legalityApi.js.
(function () {
  "use strict";

  var Api = window.LegalityApi;
  var API = Api.configured;
  var root = document.getElementById("root");
  var crumbs = document.getElementById("crumbs");
  var toastEl = document.getElementById("toast");

  // Column order of each section, matching SECTIONS in backend/legality/Legality.gs.
  var COLS = {
    crm: [2, 3, 4, 5, 6, 7].concat(seq(8, 30)),
    alumni: [2],
    program: [1, 2, 3, 4, 7],
    analisa: [1],
    planning: [1, 2],
    modul: [1, 2, 3, 4],
    peluang: [1, 2, 3]
  };
  // CRM value positions.
  var C = { entiti: 0, ada: 1, nama: 2, tel: 3, perm: 4, pic: 5, kat: 6, phase: 7, level: 8, tarikh: 9, nota: 10, video: 11, check: 12 };
  var SECTION_INFO = [
    { key: "crm", title: "CRM Sekolah", short: "CRM" },
    { key: "alumni", title: "Alumni Sekolah", short: "Alumni" },
    { key: "program", title: "Program Yang Telah Berjalan", short: "Program" },
    { key: "analisa", title: "Analisa Situasi Semasa", short: "Analisa" },
    { key: "planning", title: "Planning Legality", short: "Planning" },
    { key: "modul", title: "Modul Program Tahun Depan", short: "Modul" },
    { key: "peluang", title: "Peluang Lain Tahun Depan", short: "Peluang" }
  ];

  var state = { cawangan: null, sekolah: null, school: null, dirty: {} };

  function seq(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function button(cls, label, onClick) {
    var b = el("button", cls, label);
    b.type = "button";
    if (onClick) b.addEventListener("click", onClick);
    return b;
  }

  function message(title, body, tone) {
    root.textContent = "";
    var box = el("div", "borang-card borang-message" + (tone ? " " + tone : ""));
    box.appendChild(el("h2", "borang-message-title", title));
    if (body) box.appendChild(el("p", null, body));
    root.appendChild(box);
    return box;
  }

  var toastTimer;
  function toast(msg, tone) {
    toastEl.textContent = msg;
    toastEl.className = "lg-toast" + (tone ? " " + tone : "");
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3500);
  }

  // ---------- API (src/services/legalityApi.js) ----------

  var getKod = Api.getKod, setKod = Api.setKod, get = Api.get, post = Api.post;

  function askKod(wrong) {
    // The login screen (components/gate.js) handles the code; fall back to an inline box without it.
    if (window.YoshGate) { root.textContent = ""; window.YoshGate.show(wrong ? "Kod akses telah ditukar. Masukkan kod baru." : ""); window.YoshGate.ready(route); return; }
    root.textContent = "";
    var card = el("section", "borang-card");
    card.appendChild(el("h2", "borang-section", "Kod akses"));
    card.appendChild(el("p", "lg-lead", "Masukkan kod akses Unit Legality. Anda hanya perlu memasukkannya sekali pada peranti ini."));
    var f = el("div", "borang-field");
    var input = el("input", "borang-input");
    input.id = "kodAkses";
    input.autocomplete = "off";
    input.autocapitalize = "characters";
    input.spellcheck = false;
    var lab = el("label", "borang-label", "Kod akses");
    lab.htmlFor = input.id;
    var err = el("p", "borang-error", wrong ? "Kod tidak sah. Semak dengan pentadbir Unit Legality." : "");
    f.appendChild(lab); f.appendChild(input); f.appendChild(err);
    card.appendChild(f);
    var go = button("borang-submit lg-btn-sm", "Masuk", submit);
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    function submit() {
      var k = input.value.trim().toUpperCase();
      if (!k) { err.textContent = "Masukkan kod akses."; return; }
      setKod(k);
      route();
    }
    var actions = el("div", "lg-actions");
    actions.appendChild(go);
    card.appendChild(actions);
    root.appendChild(card);
    // Wait for the intro to close before taking keyboard focus.
    if (document.body.classList.contains("locked")) window.addEventListener("yosh:introclosed", function () { input.focus(); }, { once: true });
    else input.focus();
  }

  // ---------- Routing: #/ · #/CAWANGAN · #/CAWANGAN/SEKOLAH ----------

  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/").map(decodeURIComponent).filter(String);
    state.cawangan = parts[0] || null;
    state.sekolah = parts[1] || null;
    renderCrumbs();
    if (!API) {
      message("Borang belum disambungkan", "Pentadbir perlu memasukkan pautan Apps Script Legality dalam src/config/config.js. Lihat backend/legality/README.md.", "warn");
      return;
    }
    if (!getKod()) return askKod(false);
    if (!state.cawangan) return showCawangan();
    if (!state.sekolah) return showSchools();
    return showSchool();
  }

  function go(hash) {
    if (anyDirty() && !confirm("Ada perubahan yang belum disimpan. Tinggalkan halaman ini?")) return;
    state.dirty = {};
    location.hash = hash;
  }

  window.addEventListener("hashchange", function () { state.dirty = {}; route(); });
  window.addEventListener("beforeunload", function (e) {
    if (anyDirty()) { e.preventDefault(); e.returnValue = ""; }
  });

  function anyDirty() { return Object.keys(state.dirty).some(function (k) { return state.dirty[k]; }); }

  function renderCrumbs() {
    crumbs.textContent = "";
    var items = [["Cawangan", "#/"]];
    if (state.cawangan) items.push([state.cawangan, "#/" + encodeURIComponent(state.cawangan)]);
    if (state.sekolah) items.push([state.sekolah, null]);
    items.forEach(function (it, i) {
      if (i) crumbs.appendChild(el("span", "lg-crumb-sep", "›"));
      if (it[1] && i < items.length - 1) {
        var a = el("a", "lg-crumb", it[0]);
        a.href = it[1];
        a.addEventListener("click", function (e) { e.preventDefault(); go(it[1]); });
        crumbs.appendChild(a);
      } else {
        crumbs.appendChild(el("span", "lg-crumb is-current", it[0]));
      }
    });
  }

  // ---------- Step 1: cawangan ----------

  function showCawangan() {
    root.textContent = "";
    root.appendChild(el("p", "borang-status", "Memuatkan cawangan…"));
    get({ action: "cawangan" }).then(function (d) {
      root.textContent = "";
      var card = el("section", "borang-card");
      card.appendChild(el("h2", "borang-section", "Pilih cawangan"));
      card.appendChild(el("p", "lg-lead", "Pilih cawangan yang anda ingin kemas kini."));
      var grid = el("div", "lg-grid");
      var last = null;
      try { last = localStorage.getItem("legality:cawangan"); } catch (e) {}
      d.cawangan.forEach(function (c) {
        var b = button("lg-tile" + (c.id === last ? " is-last" : ""), null, function () {
          try { localStorage.setItem("legality:cawangan", c.id); } catch (e) {}
          go("#/" + encodeURIComponent(c.id));
        });
        b.appendChild(el("span", "lg-tile-name", c.id));
        b.appendChild(el("span", "lg-tile-meta", c.ready ? (c.id === last ? "Terakhir dibuka" : "Buka") : "Belum disediakan"));
        if (!c.ready) b.disabled = true;
        grid.appendChild(b);
      });
      card.appendChild(grid);
      root.appendChild(card);
    }).catch(fail);
  }

  // ---------- Step 2: schools ----------

  function showSchools() {
    root.textContent = "";
    root.appendChild(el("p", "borang-status", "Memuatkan sekolah " + state.cawangan + "…"));
    get({ action: "schools", cawangan: state.cawangan }).then(function (d) {
      root.textContent = "";
      var card = el("section", "borang-card");
      card.appendChild(el("h2", "borang-section", "Sekolah · " + d.cawangan));

      var tools = el("div", "lg-tools");
      var search = el("input", "borang-input lg-search");
      search.type = "search";
      search.placeholder = "Cari sekolah";
      search.setAttribute("aria-label", "Cari sekolah");
      var addBtn = button("lg-add-btn", "+ Tambah sekolah");
      var searchRow = el("div", "lg-search-row");
      searchRow.appendChild(search);
      searchRow.appendChild(addBtn);
      tools.appendChild(searchRow);
      card.appendChild(tools);
      // The add-school form opens right under the search bar.
      var addCard = addSchoolCard(d.cawangan, d.schools);
      addCard.hidden = true;
      card.appendChild(addCard);
      addBtn.addEventListener("click", function () {
        addCard.hidden = !addCard.hidden;
        addBtn.classList.toggle("is-open", !addCard.hidden);
        if (!addCard.hidden) addCard.querySelector("input").focus();
      });

      var grid = el("div", "lg-grid");
      function draw() {
        grid.textContent = "";
        var q = search.value.trim().toLowerCase();
        var shown = d.schools.filter(function (s) { return !q || s.name.toLowerCase().indexOf(q) > -1; });
        shown.forEach(function (s) {
          var b = button("lg-tile", null, function () { go("#/" + encodeURIComponent(d.cawangan) + "/" + encodeURIComponent(s.name)); });
          b.appendChild(el("span", "lg-tile-name", s.name));
          b.appendChild(el("span", "lg-tile-meta", (s.people ? s.people + " orang CRM" : "Belum ada CRM") +
            (d.steps ? " · Progress " + (s.progress || 0) + "/" + d.steps : "")));
          grid.appendChild(b);
        });
        if (!shown.length) grid.appendChild(el("p", "lg-empty", d.schools.length ? "Tiada sekolah sepadan." : "Belum ada sekolah untuk cawangan ini."));
      }
      search.addEventListener("input", draw);
      draw();
      card.appendChild(grid);
      root.appendChild(card);
    }).catch(fail);
  }

  function addSchoolCard(cawangan, schools) {
    var card = el("div", "lg-addbox");
    var f = el("div", "borang-field");
    var lab = el("label", "borang-label", "Nama ringkas sekolah (contoh: SMKA JB)");
    var input = el("input", "borang-input");
    input.id = "newSchool";
    input.maxLength = 40;
    lab.htmlFor = input.id;
    var err = el("p", "borang-error");
    f.appendChild(lab); f.appendChild(input); f.appendChild(err);
    f.appendChild(el("p", "borang-hint", "Tab baru dibuat dalam sheet " + cawangan + " daripada template, dan terus muncul dalam CRM & Program."));
    card.appendChild(f);
    var add = button("borang-submit lg-btn-sm", "Tambah sekolah", function () {
      var name = input.value.trim().toUpperCase();
      err.textContent = "";
      if (!name) { err.textContent = "Masukkan nama sekolah."; input.focus(); return; }
      if (schools.some(function (s) { return s.name === name; })) { err.textContent = "Sekolah ini sudah ada."; return; }
      add.disabled = true; add.textContent = "Menambah…";
      post({ action: "addSchool", cawangan: cawangan, sekolah: name }).then(function (d) {
        toast("Sekolah " + d.sekolah + " ditambah.", "ok");
        go("#/" + encodeURIComponent(cawangan) + "/" + encodeURIComponent(d.sekolah));
      }).catch(function (e) {
        err.textContent = e.message || String(e);
        add.disabled = false; add.textContent = "Tambah sekolah";
      });
    });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); add.click(); } });
    var actions = el("div", "lg-actions");
    actions.appendChild(add);
    card.appendChild(actions);
    return card;
  }

  // ---------- Step 3: one school ----------

  function showSchool() {
    root.textContent = "";
    root.appendChild(el("p", "borang-status", "Memuatkan " + state.sekolah + "…"));
    get({ action: "school", cawangan: state.cawangan, sekolah: state.sekolah }).then(function (d) {
      state.school = d;
      root.textContent = "";
      var nav = el("nav", "lg-sectnav");
      nav.setAttribute("aria-label", "Bahagian");
      [{ key: "progress", short: "Progress" }].concat(SECTION_INFO).forEach(function (s) {
        var a = el("a", "lg-chip", s.short);
        a.href = "#sec-" + s.key;
        a.addEventListener("click", function (e) {
          e.preventDefault();
          document.getElementById("sec-" + s.key).scrollIntoView({ behavior: "smooth", block: "start" });
        });
        nav.appendChild(a);
      });
      root.appendChild(nav);
      if (d.progress) root.appendChild(progressCard(d.progress));
      SECTION_INFO.forEach(function (s) { root.appendChild(sectionCard(s)); });
    }).catch(fail);
  }

  function fail(e) {
    if (e && e.kod) return askKod(true);
    message("Tidak dapat dimuatkan", (e && e.message) || String(e), "warn");
    var again = button("link-btn", "Cuba lagi", route);
    root.firstChild.appendChild(again);
  }

  // Builds the card for one section, with its own Simpan button.
  function sectionCard(info) {
    var card = el("section", "borang-card lg-section");
    card.id = "sec-" + info.key;
    var head = el("div", "lg-section-head");
    var titleWrap = el("div", "lg-section-title");
    titleWrap.appendChild(el("h2", "borang-section", info.title));
    var badge = el("span", "lg-unsaved", "Belum disimpan");
    badge.hidden = true;
    titleWrap.appendChild(badge);
    head.appendChild(titleWrap);
    var headTools = el("div", "lg-section-tools");   // "+ Tambah …" sits here, top right of the section
    head.appendChild(headTools);
    card.appendChild(head);

    var body = el("div", "lg-section-body");
    card.appendChild(body);

    var status = el("p", "borang-error-summary");
    status.hidden = true;
    var save = button("borang-submit lg-btn-sm", "Simpan " + info.short);
    var actions = el("div", "lg-actions");
    actions.appendChild(status);
    actions.appendChild(save);
    card.appendChild(actions);

    var model = makeModel(info.key, state.school.sections[info.key].rows);
    function markDirty() {
      var d = isDirty(model);
      state.dirty[info.key] = d;
      badge.hidden = !d;
    }
    function draw() {
      body.textContent = "";
      headTools.textContent = "";
      RENDER[info.key](body, model, markDirty, draw, function () { save.click(); });
      // Move the section's "+ Tambah …" button up beside the title, and show the new entry once added.
      var add = body.querySelector(":scope > .lg-add");
      if (add) {
        add.className = "lg-add-btn";
        headTools.appendChild(add);
        add.addEventListener("click", function () {
          var items = body.querySelectorAll(".lg-row");
          var last = items[items.length - 1];
          if (!last) return;
          last.scrollIntoView({ behavior: "smooth", block: "center" });
          var first = last.querySelector("input:not([type=checkbox]), textarea, select");
          if (first) first.focus({ preventScroll: true });
        });
      }
      markDirty();
    }
    draw();

    save.addEventListener("click", function () {
      var payload = diff(info.key, model);
      if (!payload.edits.length && !payload.adds.length) { toast("Tiada perubahan untuk disimpan."); return; }
      status.hidden = true;
      save.disabled = true; save.textContent = "Menyimpan…";
      post({ action: "save", cawangan: state.cawangan, sekolah: state.sekolah, section: info.key,
             edits: payload.edits, adds: payload.adds })
        .then(function (d) {
          model = makeModel(info.key, d.data.rows);
          draw();
          toast(info.short + " disimpan.", "ok");
        })
        .catch(function (e) {
          status.hidden = false;
          status.textContent = "Belum disimpan: " + (e.message || e);
        })
        .then(function () { save.disabled = false; save.textContent = "Simpan " + info.short; });
    });
    return card;
  }

  // Progress Legality: six milestones, each simply done or not done.
  function progressCard(p) {
    var card = el("section", "borang-card lg-section");
    card.id = "sec-progress";
    var head = el("div", "lg-section-head");
    head.appendChild(el("h2", "borang-section", "Progress Legality"));
    var badge = el("span", "lg-unsaved", "Belum disimpan");
    badge.hidden = true;
    head.appendChild(badge);
    card.appendChild(head);
    card.appendChild(el("p", "lg-lead", "Tandakan langkah yang sudah dibuat untuk sekolah ini."));

    var orig = p.values.slice();
    var work = p.values.slice();
    var list = el("ol", "lg-steps");
    var count = el("p", "lg-steps-count");
    var boxes = [];
    p.items.forEach(function (it, i) {
      var li = el("li", "lg-step");
      var lab = el("label", "lg-step-label");
      var cb = el("input");
      cb.type = "checkbox";
      cb.checked = work[i];
      cb.addEventListener("change", function () { work[i] = cb.checked; refresh(); });
      boxes.push(cb);
      lab.appendChild(cb);
      var txt = el("span", "lg-step-text");
      txt.appendChild(el("span", "lg-step-num", String(i + 1)));
      txt.appendChild(el("span", null, it.label));
      lab.appendChild(txt);
      lab.appendChild(el("span", "lg-step-state"));
      li.appendChild(lab);
      list.appendChild(li);
    });
    function refresh() {
      var done = work.filter(Boolean).length;
      count.textContent = done + " / " + work.length + " langkah selesai";
      Array.prototype.forEach.call(list.children, function (li, i) {
        li.classList.toggle("is-done", work[i]);
        li.querySelector(".lg-step-state").textContent = work[i] ? "Dah buat" : "Belum";
      });
      var dirty = work.some(function (v, i) { return v !== orig[i]; });
      state.dirty.progress = dirty;
      badge.hidden = !dirty;
    }
    card.appendChild(count);
    card.appendChild(list);

    var status = el("p", "borang-error-summary");
    status.hidden = true;
    var save = button("borang-submit lg-btn-sm", "Simpan Progress", function () {
      if (!state.dirty.progress) { toast("Tiada perubahan untuk disimpan."); return; }
      status.hidden = true;
      save.disabled = true; save.textContent = "Menyimpan…";
      post({ action: "saveProgress", cawangan: state.cawangan, sekolah: state.sekolah, values: work, old: orig })
        .then(function (d) {
          orig = d.values.slice(); work = d.values.slice();
          boxes.forEach(function (cb, i) { cb.checked = work[i]; });
          refresh();
          toast("Progress disimpan.", "ok");
        })
        .catch(function (e) { status.hidden = false; status.textContent = "Belum disimpan: " + (e.message || e); })
        .then(function () { save.disabled = false; save.textContent = "Simpan Progress"; });
    });
    var actions = el("div", "lg-actions");
    actions.appendChild(status);
    actions.appendChild(save);
    card.appendChild(actions);
    refresh();
    return card;
  }

  // A model row: { r, v: original values, w: working values, lock, group } — new rows have r = null.
  function makeModel(key, rows) {
    return {
      key: key,
      rows: rows.map(function (row) {
        return { r: row.r, v: row.v.slice(), w: row.v.slice(), lock: row.lock || [], group: row.group };
      })
    };
  }

  function blankRow(key) {
    var w = COLS[key].map(function (c, i) {
      if (key === "crm" && (i === C.ada || i >= C.check)) return false;
      if (key === "program" && i === 4) return false;
      return "";
    });
    return { r: null, v: w.slice(), w: w, lock: [], isNew: true };
  }

  function hasContent(vals, key) {
    return vals.some(function (v, i) { return v !== "" && v !== false && !(key === "crm" && i === C.entiti); });
  }

  function isDirty(model) {
    return model.rows.some(function (row) {
      if (row.r == null) return hasContent(row.w, model.key) || (model.key === "crm" && row.w[C.entiti] !== "");
      return row.w.some(function (v, i) { return v !== row.v[i]; });
    });
  }

  function diff(key, model) {
    var edits = [], adds = [];
    model.rows.forEach(function (row) {
      if (row.r == null) {
        if (hasContent(row.w, key) || (key === "crm" && row.w[C.entiti] !== "")) adds.push(row.w);
        return;
      }
      row.w.forEach(function (val, i) {
        if (val !== row.v[i] && !row.lock[i]) edits.push({ r: row.r, c: COLS[key][i], old: row.v[i], val: val });
      });
    });
    return { edits: edits, adds: adds };
  }

  // ---------- Small field builders ----------

  var uid = 0;
  function textField(label, row, i, opts, onChange) {
    opts = opts || {};
    var box = el("div", "lg-field" + (opts.wide ? " is-wide" : ""));
    var id = "f" + (++uid);
    var lab = el("label", "lg-label", label);
    lab.htmlFor = id;
    var input;
    if (opts.long) { input = el("textarea", "borang-input"); input.rows = opts.rows || 3; }
    else { input = el("input", "borang-input"); input.type = opts.type || "text"; }
    if (opts.list) input.setAttribute("list", opts.list);
    input.id = id;
    input.value = row.w[i] == null ? "" : row.w[i];
    if (row.lock[i]) { input.disabled = true; input.title = "Sel ini sebahagian sel bercantum dalam sheet."; }
    input.addEventListener("input", function () { row.w[i] = input.value; onChange(); });
    box.appendChild(lab);
    box.appendChild(input);
    return box;
  }

  function selectField(label, row, i, options, onChange) {
    var box = el("div", "lg-field borang-field");
    var id = "f" + (++uid);
    var lab = el("label", "lg-label", label);
    lab.htmlFor = id;
    var s = el("select");
    s.id = id;
    var all = options.slice();
    if (row.w[i] && all.indexOf(row.w[i]) < 0) all.unshift(row.w[i]);
    s.appendChild(new Option("—", ""));
    all.forEach(function (o) { s.appendChild(new Option(o, o)); });
    s.value = row.w[i] || "";
    s.addEventListener("change", function () { row.w[i] = s.value; onChange(); });
    box.appendChild(lab);
    box.appendChild(s);
    return box;
  }

  function checkField(label, row, i, onChange, cls) {
    var lab = el("label", "lg-check" + (cls ? " " + cls : ""));
    var cb = el("input");
    cb.type = "checkbox";
    cb.checked = row.w[i] === true;
    cb.addEventListener("change", function () { row.w[i] = cb.checked; onChange(); });
    lab.appendChild(cb);
    lab.appendChild(el("span", null, label));
    return lab;
  }

  // ---------- Section renderers ----------

  var RENDER = {
    crm: function (body, model, changed, redraw, saveNow) {
      var kpi = state.school.kpi;
      var listId = "entiti-list";
      if (!document.getElementById(listId)) {
        var dl = el("datalist");
        dl.id = listId;
        kpi.entiti.forEach(function (o) { dl.appendChild(new Option(o)); });
        document.body.appendChild(dl);
      }
      var checks = kpi.headers.slice(C.check - 6);

      // Slots that are completely blank are hidden; "Tambah orang" fills them.
      var visible = model.rows.filter(function (row) {
        return row.r == null || row.w[C.entiti] !== "" || hasContent(row.w, "crm");
      });
      var groups = [["High", "High Priority"], ["Low", "Low Priority"], ["", "Baru"]];
      groups.forEach(function (g) {
        var rows = visible.filter(function (row) {
          return g[0] ? row.group === g[0] && row.r != null : row.r == null || (row.group !== "High" && row.group !== "Low");
        });
        if (!rows.length) return;
        body.appendChild(el("h3", "lg-group", g[1]));
        rows.forEach(function (row) { body.appendChild(personCard(row)); });
      });

      var add = button("lg-add", "+ Tambah orang CRM", function () {
        var row = blankRow("crm");
        model.rows.push(row);
        redraw();
        openPerson(row, true);
      });
      body.appendChild(add);

      function summaryOf(row) {
        var n = row.w.slice(C.check).filter(function (v) { return v === true; }).length;
        return {
          name: row.w[C.nama] || (row.r == null ? "Orang baru" : "Belum diisi"),
          empty: !row.w[C.nama],
          meta: [row.w[C.entiti], row.w[C.phase]].filter(String).join(" · "),
          done: n
        };
      }

      // One line per person in the list; tapping it opens the popup with all the details.
      function personCard(row) {
        var sm = summaryOf(row);
        var card = button("lg-person lg-person-btn", null, function () { openPerson(row, false); });
        var left = el("span", "lg-person-left");
        var name = el("span", "lg-person-name" + (sm.empty ? " is-empty" : ""), sm.name);
        left.appendChild(name);
        left.appendChild(el("span", "lg-person-meta", sm.meta));
        card.appendChild(left);
        var done = el("span", "lg-progress", sm.done + "/" + checks.length);
        done.style.setProperty("--p", Math.round(sm.done / checks.length * 100) + "%");
        card.appendChild(done);
        card.appendChild(el("span", "lg-person-go", "›"));
        if (row.r == null) card.classList.add("is-new");
        return card;
      }

      function openPerson(row, isNew) {
        var modal;
        function ch() {
          var sm = summaryOf(row);
          modal.setTitle(sm.name, sm.empty);
          modal.setSubtitle([sm.meta, sm.done + "/" + checks.length + " checklist"].filter(String).join(" · "));
          changed();
        }
        var inner = el("div", "ym-form");

        inner.appendChild(el("h3", "ym-sec", "Maklumat"));
        var basic = el("div", "lg-fields");
        basic.appendChild(textField("Entiti", row, C.entiti, { list: listId }, ch));
        basic.appendChild(textField("Nama", row, C.nama, {}, ch));
        basic.appendChild(textField("Nombor telefon", row, C.tel, { type: "tel" }, ch));
        basic.appendChild(textField("PIC CRM", row, C.pic, {}, ch));
        basic.appendChild(textField("Permanfaatan", row, C.perm, { wide: true }, ch));
        inner.appendChild(basic);
        inner.appendChild(checkField("Ada / Tiada (CRM aktif)", row, C.ada, ch, "is-solo"));

        inner.appendChild(el("h3", "ym-sec", "KPI CRM"));
        var k = el("div", "lg-fields");
        k.appendChild(selectField(kpi.headers[0] || "Kategori Cikgu", row, C.kat, kpi.kategori, ch));
        k.appendChild(selectField(kpi.headers[1] || "Phase", row, C.phase, kpi.phase, ch));
        k.appendChild(selectField(kpi.headers[2] || "Level CRM", row, C.level, kpi.level, ch));
        k.appendChild(textField(kpi.headers[3] || "Plan Tarikh Kelas Tambahan", row, C.tarikh, { type: "date" }, ch));
        k.appendChild(textField(kpi.headers[4] || "Nota", row, C.nota, {}, ch));
        k.appendChild(textField(kpi.headers[5] || "Collect Video Feedback", row, C.video, {}, ch));
        inner.appendChild(k);

        inner.appendChild(el("h3", "ym-sec", "Checklist hubungan"));
        var list = el("div", "lg-checklist");
        checks.forEach(function (label, j) { list.appendChild(checkField(label, row, C.check + j, ch)); });
        inner.appendChild(list);

        if (row.r == null) {
          inner.appendChild(button("link-btn lg-remove", "Buang orang baru ini", function () {
            model.rows.splice(model.rows.indexOf(row), 1);
            modal.close();
          }));
        }

        var sm = summaryOf(row);
        modal = window.YoshModal.open({
          title: sm.name, titleEmpty: sm.empty,
          subtitle: [sm.meta, sm.done + "/" + checks.length + " checklist"].filter(String).join(" · "),
          body: inner,
          focusFirst: isNew,
          actions: [{ label: "Simpan CRM", primary: true, onClick: function (m) { m.close(); saveNow(); } }],
          onClose: redraw
        });
      }
    },

    alumni: function (body, model, changed) {
      var row = model.rows[0];
      if (!row) return body.appendChild(el("p", "lg-empty", "Bahagian ini tiada dalam tab sekolah."));
      body.appendChild(textField("Nama alumni & maklumat", row, 0, { long: true, rows: 6, wide: true }, changed));
    },

    analisa: function (body, model, changed) {
      var row = model.rows[0];
      if (!row) return body.appendChild(el("p", "lg-empty", "Bahagian ini tiada dalam tab sekolah."));
      body.appendChild(textField("Analisa situasi semasa sekolah", row, 0, { long: true, rows: 6, wide: true }, changed));
    },

    planning: function (body, model, changed) {
      var any = false;
      model.rows.forEach(function (row) {
        if (row.lock[1]) return;
        any = true;
        var label = row.v[0] || "Catatan";
        body.appendChild(textField(label, row, 1, { long: true, rows: 2, wide: true }, changed));
      });
      if (!any) body.appendChild(el("p", "lg-empty", "Bahagian ini tiada dalam tab sekolah."));
      body.appendChild(imageGallery("planning"));
    },

    program: tableSection([
      { i: 0, label: "Nama program" }, { i: 1, label: "Tarikh" }, { i: 2, label: "Niche" },
      { i: 3, label: "Penglibatan", long: true, wide: true }, { i: 4, label: "Reporting", check: true }
    ], "+ Tambah program", "Belum ada program direkodkan."),

    modul: tableSection([
      { i: 0, label: "Nama program" }, { i: 1, label: "Tarikh" }, { i: 2, label: "Niche" },
      { i: 3, label: "Short brief pelaksanaan", long: true, wide: true }
    ], "+ Tambah modul", "Belum ada modul untuk tahun depan."),

    peluang: tableSection([
      { i: 0, label: "Peluang" }, { i: 1, label: "Tarikh" },
      { i: 2, label: "Permanfaatan", long: true, wide: true }
    ], "+ Tambah peluang", "Belum ada peluang direkodkan.")
  };

  // ---------- Images (Planning) ----------
  // Pictures upload straight away (no Simpan needed) to Google Drive through the Apps Script.

  // Shrinks a photo to at most 1600px and turns it into JPEG, so phone photos upload quickly.
  function shrinkImage(file) {
    return new Promise(function (resolve, reject) {
      if (file.type === "image/gif") {
        var fr = new FileReader();
        fr.onload = function () { resolve({ mime: file.type, data: String(fr.result).split(",")[1], name: file.name }); };
        fr.onerror = function () { reject(new Error("Gambar tidak dapat dibaca.")); };
        return fr.readAsDataURL(file);
      }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var max = 1600, w = img.naturalWidth, h = img.naturalHeight;
        var k = Math.min(1, max / Math.max(w, h));
        var c = document.createElement("canvas");
        c.width = Math.round(w * k); c.height = Math.round(h * k);
        var g = c.getContext("2d");
        g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
        g.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        var name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
        resolve({ mime: "image/jpeg", data: c.toDataURL("image/jpeg", 0.85).split(",")[1], name: name });
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("Fail ini bukan gambar yang boleh dibaca.")); };
      img.src = url;
    });
  }

  function imageGallery(section) {
    var wrap = el("div", "lg-gallery");
    var head = el("div", "lg-gallery-head");
    head.appendChild(el("h4", "lg-sub", "Gambar"));
    var pick = el("input");
    pick.type = "file"; pick.accept = "image/*"; pick.multiple = true; pick.hidden = true;
    var addBtn = button("lg-add-btn", "+ Muat naik gambar", function () { pick.click(); });
    head.appendChild(addBtn);
    head.appendChild(pick);
    wrap.appendChild(head);
    var grid = el("div", "lg-gallery-grid");
    wrap.appendChild(grid);
    var note = el("p", "lg-gallery-note");
    wrap.appendChild(note);

    function mine() { return (state.school.images || []).filter(function (im) { return im.section === section; }); }

    function draw(pending) {
      grid.textContent = "";
      mine().forEach(function (im) {
        var fig = el("figure", "lg-thumb");
        var open = button("lg-thumb-open", null, function () { viewImage(im); });
        open.setAttribute("aria-label", "Lihat " + im.name);
        var img = el("img");
        img.alt = im.name;
        // Drive may need a moment to make the thumbnail of a new upload, so try once more before giving up.
        var tries = 0;
        img.onerror = function () {
          if (tries++ < 2) setTimeout(function () { img.src = im.thumb + "&r=" + tries; }, 2500);
          else fig.classList.add("is-broken");
        };
        img.src = im.thumb;
        open.appendChild(img);
        fig.appendChild(open);
        var del = button("lg-thumb-del", "×", function () {
          if (!confirm("Buang gambar \"" + im.name + "\"? Ia akan dipindah ke Bin Google Drive.")) return;
          fig.classList.add("is-busy");
          post({ action: "deleteImage", cawangan: state.cawangan, sekolah: state.sekolah, id: im.id })
            .then(function (d) { state.school.images = d.images; draw(); toast("Gambar dibuang.", "ok"); })
            .catch(function (e) { fig.classList.remove("is-busy"); toast("Tidak dapat buang: " + (e.message || e), "warn"); });
        });
        del.setAttribute("aria-label", "Buang " + im.name);
        fig.appendChild(del);
        grid.appendChild(fig);
      });
      for (var i = 0; i < (pending || 0); i++) grid.appendChild(el("div", "lg-thumb is-loading", "Memuat naik…"));
      if (!grid.children.length) grid.appendChild(el("p", "lg-empty", "Belum ada gambar. Contohnya gambar timeline, carta atau dokumen."));
    }
    draw();

    pick.addEventListener("change", function () {
      var files = Array.prototype.slice.call(pick.files || []);
      pick.value = "";
      if (!files.length) return;
      var left = files.length, failed = [];
      addBtn.disabled = true;
      note.textContent = "";
      draw(left);
      // One at a time keeps each request small and the order as chosen.
      files.reduce(function (chain, file) {
        return chain.then(function () {
          return shrinkImage(file)
            .then(function (g) {
              return post({ action: "uploadImage", cawangan: state.cawangan, sekolah: state.sekolah, section: section,
                            name: g.name, mime: g.mime, data: g.data });
            })
            .then(function (d) { state.school.images = d.images; })
            .catch(function (e) { failed.push(file.name + ": " + (e.message || e)); })
            .then(function () { left--; draw(left); });
        });
      }, Promise.resolve()).then(function () {
        addBtn.disabled = false;
        if (failed.length) { note.textContent = "Tidak dimuat naik — " + failed.join("; "); toast("Sebahagian gambar gagal dimuat naik.", "warn"); }
        else toast(files.length > 1 ? files.length + " gambar dimuat naik." : "Gambar dimuat naik.", "ok");
      });
    });
    return wrap;
  }

  function viewImage(im) {
    var box = el("div", "lg-viewer");
    var img = el("img");
    img.alt = im.name;
    img.src = im.thumb;                       // already loaded for the grid, so it shows at once
    var big = new Image();
    big.onload = function () { if (big.naturalWidth > img.naturalWidth) img.src = big.src; };
    big.src = im.full;                        // swap in the sharper copy if Drive has one
    box.appendChild(img);
    window.YoshModal.open({
      title: im.name, subtitle: im.date ? "Dimuat naik " + im.date : "",
      body: box,
      actions: [{ label: "Buka di Drive", primary: true, onClick: function () { window.open(im.url, "_blank", "noopener"); } }]
    });
  }

  // Rows with content are shown as editable cards; empty rows stay hidden until "Tambah" is used.
  function tableSection(fields, addLabel, emptyText) {
    return function (body, model, changed, redraw) {
      var key = model.key;
      var rows = model.rows.filter(function (row) { return row.r == null || row.shown || hasContent(row.v, key); });
      rows.forEach(function (row, n) {
        var card = el("div", "lg-row");
        card.appendChild(el("span", "lg-row-num", String(n + 1)));
        var f = el("div", "lg-fields");
        fields.forEach(function (fd) {
          if (fd.check) f.appendChild(checkField(fd.label, row, fd.i, changed, "is-solo"));
          else f.appendChild(textField(fd.label, row, fd.i, { long: fd.long, wide: fd.wide, rows: 2 }, changed));
        });
        card.appendChild(f);
        if (row.r == null) {
          card.appendChild(button("link-btn lg-remove", "Buang", function () {
            model.rows.splice(model.rows.indexOf(row), 1);
            redraw();
          }));
        }
        body.appendChild(card);
      });
      if (!rows.length) body.appendChild(el("p", "lg-empty", emptyText));
      body.appendChild(button("lg-add", addLabel, function () {
        // Reuse an empty row of the sheet first so the tab doesn't grow needlessly.
        var spare = model.rows.filter(function (row) {
          return row.r != null && !row.shown && !hasContent(row.v, key) && !row.lock.some(Boolean);
        })[0];
        if (spare) spare.shown = true; else model.rows.push(blankRow(key));
        redraw();
      }));
    };
  }

  // Start once the visitor has logged in (components/gate.js).
  if (window.YoshGate) window.YoshGate.ready(route); else route();
})();
