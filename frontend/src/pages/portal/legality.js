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
    input.focus();
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
      tools.appendChild(search);
      card.appendChild(tools);

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
      root.appendChild(addSchoolCard(d.cawangan, d.schools));
    }).catch(fail);
  }

  function addSchoolCard(cawangan, schools) {
    var card = el("section", "borang-card");
    card.appendChild(el("h2", "borang-section", "Tambah sekolah baru"));
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
    head.appendChild(el("h2", "borang-section", info.title));
    var badge = el("span", "lg-unsaved", "Belum disimpan");
    badge.hidden = true;
    head.appendChild(badge);
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
    function draw() { body.textContent = ""; RENDER[info.key](body, model, markDirty, draw); markDirty(); }
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
    crm: function (body, model, changed, redraw) {
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
        row.open = true;
        model.rows.push(row);
        redraw();
      });
      body.appendChild(add);

      function personCard(row) {
        var card = el("details", "lg-person");
        if (row.open) card.open = true;
        card.addEventListener("toggle", function () { row.open = card.open; });
        var sum = el("summary", "lg-person-sum");
        var name = el("span", "lg-person-name");
        var meta = el("span", "lg-person-meta");
        var done = el("span", "lg-progress");
        function refreshSummary() {
          name.textContent = row.w[C.nama] || (row.r == null ? "Orang baru" : "Belum diisi");
          name.classList.toggle("is-empty", !row.w[C.nama]);
          meta.textContent = [row.w[C.entiti], row.w[C.phase]].filter(String).join(" · ");
          var n = row.w.slice(C.check).filter(function (v) { return v === true; }).length;
          done.textContent = n + "/" + checks.length;
          done.style.setProperty("--p", Math.round(n / checks.length * 100) + "%");
        }
        refreshSummary();
        var left = el("span", "lg-person-left");
        left.appendChild(name); left.appendChild(meta);
        sum.appendChild(left); sum.appendChild(done);
        card.appendChild(sum);

        function ch() { refreshSummary(); changed(); }
        var inner = el("div", "lg-person-body");

        var basic = el("div", "lg-fields");
        basic.appendChild(textField("Entiti", row, C.entiti, { list: listId }, ch));
        basic.appendChild(textField("Nama", row, C.nama, {}, ch));
        basic.appendChild(textField("Nombor telefon", row, C.tel, { type: "tel" }, ch));
        basic.appendChild(textField("PIC CRM", row, C.pic, {}, ch));
        basic.appendChild(textField("Permanfaatan", row, C.perm, { wide: true }, ch));
        inner.appendChild(basic);
        inner.appendChild(checkField("Ada / Tiada (CRM aktif)", row, C.ada, ch, "is-solo"));

        inner.appendChild(el("h4", "lg-sub", "KPI CRM"));
        var k = el("div", "lg-fields");
        k.appendChild(selectField(kpi.headers[0] || "Kategori Cikgu", row, C.kat, kpi.kategori, ch));
        k.appendChild(selectField(kpi.headers[1] || "Phase", row, C.phase, kpi.phase, ch));
        k.appendChild(selectField(kpi.headers[2] || "Level CRM", row, C.level, kpi.level, ch));
        k.appendChild(textField(kpi.headers[3] || "Plan Tarikh Kelas Tambahan", row, C.tarikh, { type: "date" }, ch));
        k.appendChild(textField(kpi.headers[4] || "Nota", row, C.nota, {}, ch));
        k.appendChild(textField(kpi.headers[5] || "Collect Video Feedback", row, C.video, {}, ch));
        inner.appendChild(k);

        inner.appendChild(el("h4", "lg-sub", "Checklist hubungan"));
        var list = el("div", "lg-checklist");
        checks.forEach(function (label, j) { list.appendChild(checkField(label, row, C.check + j, ch)); });
        inner.appendChild(list);

        if (row.r == null) {
          inner.appendChild(button("link-btn lg-remove", "Buang orang baru ini", function () {
            model.rows.splice(model.rows.indexOf(row), 1);
            redraw();
          }));
        }
        card.appendChild(inner);
        return card;
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

  route();
})();
