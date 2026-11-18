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

  // Shown in the top zone, in this order, under the progress cards; the rest stay under "Data sekolah".
  var TOP_SECTIONS = ["planning", "analisa"];
  function sectionInfo(key) { return SECTION_INFO.filter(function (s) { return s.key === key; })[0]; }

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

  // ---------- Show the last copy at once, then refresh quietly ----------
  // Each school list / school page is kept in this browser. On the next visit it is drawn straight away and
  // replaced when the fresh copy arrives (unless the person has started editing).
  function memoKey(q) { return "legality:memo:" + q.action + ":" + (q.cawangan || "") + ":" + (q.sekolah || ""); }
  function memoGet(q) {
    try { var s = localStorage.getItem(memoKey(q)); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  function memoPut(q, d) {
    try { localStorage.setItem(memoKey(q), JSON.stringify(d)); } catch (e) {}
  }
  // ---------- Saving without waiting ----------
  // Progress semasa, PIC and Fasa are shown as saved at once and sent in the background; if the server refuses,
  // undo() puts the edit back as unsaved and the reason is shown. After every save the copy kept in this browser
  // is updated, and a few seconds later the school is read once quietly so the server cache is warm again.
  var pendingSaves = 0, warmTimer = 0;
  function schoolQ() { return { action: "school", cawangan: state.cawangan, sekolah: state.sekolah }; }
  function saved(q, school) {
    if (school) memoPut(q, school);
    clearTimeout(warmTimer);
    warmTimer = setTimeout(function () {
      if (pendingSaves) return;
      get(q).then(function (d) { memoPut(q, d); }).catch(function () {});
    }, 4000);
  }
  function bgSave(body, onOk, undo) {
    var q = schoolQ(), school = state.school;
    pendingSaves++;
    return post(body)
      .then(function (d) { if (onOk) onOk(d); saved(q, school); })
      .catch(function (e) {
        if (undo) undo(e);   // back to "Belum disimpan", whatever the reason
        if (e && e.kod) { relogin(); return; }
        toast("Belum disimpan: " + ((e && e.message) || e), "warn");
      })
      .then(function () { pendingSaves--; });
  }
  // The access code was refused while saving (changed by admin, or this browser lost it): ask for it again over
  // the page, keeping everything typed; afterwards the person presses Simpan again.
  function relogin() {
    if (!window.YoshGate) { toast("Kod akses tidak sah. Muat semula halaman dan masukkan kod.", "warn"); return; }
    window.YoshGate.show("Sesi tamat. Masukkan kod akses semula — apa yang anda isi tidak hilang.");
    window.YoshGate.ready(function () {
      toast("Dah log masuk semula. Tekan Simpan sekali lagi untuk bahagian yang bertanda Belum disimpan.", "ok");
    });
  }

  // ---------- Pre-load the school pages ----------
  // When a cawangan's school list is shown, every school page of it is fetched quietly (two at a time) and kept in
  // this browser, so opening any school is instant. At most once an hour per cawangan on this device; skipped when
  // the browser asks to save data. The server answers these from its warm cache (warmCache trigger).
  var PREFETCH_EVERY = 60 * 60 * 1000, prefetching = {};
  function prefetchSchools(cawangan, names) {
    var key = "legality:prefetch:" + cawangan, last = 0;
    try { last = +(localStorage.getItem(key) || 0); } catch (e) {}
    if (prefetching[cawangan] || Date.now() - last < PREFETCH_EVERY) return;
    if (navigator.connection && navigator.connection.saveData) return;
    prefetching[cawangan] = true;
    var queue = names.slice(), running = 0, ok = 0;
    function next() {
      if (!queue.length) {
        if (!running) {
          prefetching[cawangan] = false;
          if (ok) { try { localStorage.setItem(key, String(Date.now())); } catch (e) {} }
        }
        return;
      }
      var q = { action: "school", cawangan: cawangan, sekolah: queue.shift() };
      running++;
      get(q).then(function (d) { memoPut(q, d); ok++; }).catch(function () {})
        .then(function () { running--; next(); });
    }
    next(); next();
  }

  var refreshPill = null;
  function refreshing(on) {
    if (on && !refreshPill) {
      refreshPill = el("div", "lg-refreshing", "Mengemas kini…");
      refreshPill.setAttribute("role", "status");
      document.body.appendChild(refreshPill);
    } else if (!on && refreshPill) { refreshPill.remove(); refreshPill = null; }
  }
  // draw(d, fromMemo) renders the page; returns nothing. The fresh copy is drawn only if it differs from what is
  // shown, the person is still on the same page, and nothing has been edited yet.
  function load(q, statusText, draw) {
    var here = location.hash;
    var memo = memoGet(q);
    refreshing(false);
    if (memo) { draw(memo, true); refreshing(true); }
    else { root.textContent = ""; root.appendChild(el("p", "borang-status", statusText)); }
    get(q).then(function (d) {
      if (location.hash !== here) return;
      refreshing(false);
      memoPut(q, d);
      if (memo && JSON.stringify(memo) === JSON.stringify(d)) return;
      if (pendingSaves) return;   // a save of this page is still on its way; its own result is what counts
      if (memo && anyDirty()) { toast("Ada data lebih baharu di sheet. Simpan perubahan anda, kemudian muat semula halaman.", "warn"); return; }
      var typing = document.activeElement;
      if (memo && typing && root.contains(typing) && /^(INPUT|TEXTAREA|SELECT)$/.test(typing.tagName) && typing.value) return;   // do not wipe what is being typed
      var y = window.scrollY;
      draw(d, false);
      if (memo) window.scrollTo(0, y);
    }).catch(function (e) {
      refreshing(false);
      if (location.hash !== here) return;
      if (memo && !(e && e.kod)) { toast("Tidak dapat mengemas kini. Data yang dipaparkan mungkin lama.", "warn"); return; }
      fail(e);
    });
  }

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
    if (anyDirty() || pendingSaves) { e.preventDefault(); e.returnValue = ""; }   // edits, or a save still being sent
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
    load({ action: "cawangan" }, "Memuatkan cawangan…", function (d) {
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
    });
  }

  // ---------- Step 2: schools ----------

  function showSchools() {
    if (saveBar) { saveBar.remove(); saveBar = null; document.body.classList.remove("has-savebar"); }
    load({ action: "schools", cawangan: state.cawangan }, "Memuatkan sekolah " + state.cawangan + "…", function (d) {
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
            (d.fasaMax ? " · Fasa " + (s.fasa || 0) : "")));
          grid.appendChild(b);
        });
        if (!shown.length) grid.appendChild(el("p", "lg-empty", d.schools.length ? "Tiada sekolah sepadan." : "Belum ada sekolah untuk cawangan ini."));
      }
      search.addEventListener("input", draw);
      draw();
      card.appendChild(grid);
      root.appendChild(card);
      // Opened from the Program form's "+ Tambah sekolah": open the add form, with the typed name if any.
      var want = new URLSearchParams(location.search).get("tambah");
      if (want !== null) {
        history.replaceState(null, "", location.pathname + location.hash);
        addBtn.click();
        if (want && want !== "1") addCard.querySelector("input").value = want.toUpperCase().slice(0, 40);
        addCard.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      prefetchSchools(d.cawangan, d.schools.map(function (s) { return s.name; }));
    });
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
    load({ action: "school", cawangan: state.cawangan, sekolah: state.sekolah }, "Memuatkan " + state.sekolah + "…", function (d) {
      state.school = d;
      state.dirty = {};
      root.textContent = "";

      // Sticky chips (with a status dot each), the summary card, then two zones:
      // "Tindakan minggu ini" (open) and "Data sekolah" (each part folded to one line until opened).
      var nav = el("nav", "lg-sectnav");
      nav.setAttribute("aria-label", "Bahagian");
      root.appendChild(nav);
      var summary = el("section", "borang-card lg-overview");
      summary.id = "sec-ringkasan";
      root.appendChild(summary);

      root.appendChild(zoneLabel("Tindakan minggu ini", "Dikemas kini setiap minggu"));
      if (d.weekly) root.appendChild(weeklyCard(d.weekly));
      if (d.progress) root.appendChild(noteCard(d.progress.note || { text: "", updated: "" }));
      if (d.fasa) root.appendChild(fasaCard(d.fasa));
      // Planning, then Analisa, right under the progress cards (worked on together each week).
      TOP_SECTIONS.forEach(function (k) { root.appendChild(foldable(sectionCard(sectionInfo(k)), k)); });

      root.appendChild(zoneLabel("Data sekolah", "Tekan untuk buka"));
      root.appendChild(foldable(picCard(d.pic || []), "pic"));
      SECTION_INFO.forEach(function (s) {
        if (TOP_SECTIONS.indexOf(s.key) < 0) root.appendChild(foldable(sectionCard(s), s.key));
      });

      // Parts the Legality bot checks (it tags the PIC when they are empty or out of date)
      ["semasa", "planning", "peluang"].forEach(function (k) {
        var t = document.querySelector("#sec-" + k + " .lg-section-title") || document.querySelector("#sec-" + k + " .lg-section-head");
        if (!t) return;
        var tag = el("span", "lg-bot-tag", "🤖 Disemak bot");
        tag.title = k === "semasa" ? "Bot mengingatkan PIC jika tidak dikemas kini 7 hari atau lebih"
                                   : "Bot tag PIC dalam group jika bahagian ini kosong";
        t.appendChild(tag);
      });
      root.appendChild(schoolNav());

      buildNav(nav);
      buildSaveBar();
      schoolChanged();
    });
  }

  // ---------- Floating save bar: shown while any part has unsaved changes ----------
  var SAVE_LABELS = { semasa: "Progress semasa", progress: "Fasa", pic: "PIC", crm: "CRM", alumni: "Alumni",
                      program: "Program", analisa: "Analisa", planning: "Planning", modul: "Modul", peluang: "Peluang" };
  var saveBar = null;
  function dirtyKeys() { return Object.keys(state.dirty).filter(function (k) { return state.dirty[k]; }); }
  function buildSaveBar() {
    if (saveBar) saveBar.remove();
    saveBar = el("div", "lg-savebar");
    saveBar.setAttribute("role", "region");
    saveBar.setAttribute("aria-label", "Perubahan belum disimpan");
    var text = el("span", "lg-savebar-text");
    var undo = button("lg-savebar-undo", "Buang", function () {
      var keys = dirtyKeys();
      if (!keys.length) return;
      if (!window.confirm("Buang perubahan yang belum disimpan (" + keys.map(function (k) { return SAVE_LABELS[k] || k; }).join(", ") + ")?")) return;
      state.dirty = {};
      showSchool();
    });
    var all = button("lg-savebar-save", "Simpan semua", function () {
      dirtyKeys().forEach(function (k) {
        var b = document.querySelector("#sec-" + k + " .lg-actions .borang-submit");
        if (b && !b.disabled) b.click();
      });
    });
    var btns = el("div", "lg-savebar-btns");
    btns.appendChild(undo);
    btns.appendChild(all);
    saveBar.appendChild(text);
    saveBar.appendChild(btns);
    saveBar.paint = function () {
      var keys = dirtyKeys();
      saveBar.classList.toggle("is-on", keys.length > 0);
      document.body.classList.toggle("has-savebar", keys.length > 0);
      text.textContent = keys.length + " bahagian belum disimpan · " + keys.map(function (k) { return SAVE_LABELS[k] || k; }).join(", ");
    };
    document.body.appendChild(saveBar);
    saveBar.paint();
  }
  function paintSaveBar() { if (saveBar && document.body.contains(saveBar)) saveBar.paint(); }
  document.addEventListener("input", function () { setTimeout(paintSaveBar); });
  document.addEventListener("change", function () { setTimeout(paintSaveBar); });
  document.addEventListener("click", function () { setTimeout(paintSaveBar, 50); });

  // Bottom of the school page: back to the list, and the previous / next school of the same cawangan.
  function schoolNav() {
    var nav = el("nav", "lg-schoolnav");
    nav.setAttribute("aria-label", "Sekolah lain");
    var back = el("a", "lg-schoolnav-back", "← Semua sekolah " + state.cawangan);
    back.href = "#/" + encodeURIComponent(state.cawangan);
    nav.appendChild(back);
    var pn = el("div", "lg-schoolnav-pn");
    nav.appendChild(pn);
    var here = state.sekolah, cw = state.cawangan;
    get({ action: "schoolList", cawangan: cw }).then(function (d) {
      if (state.sekolah !== here) return;
      var list = d.schools || [];
      var i = list.indexOf(here);
      if (i < 0 || list.length < 2) return;
      [[list[(i - 1 + list.length) % list.length], "‹ ", ""], [list[(i + 1) % list.length], "", " ›"]].forEach(function (x) {
        var a = el("a", "lg-schoolnav-link", x[1] + x[0] + x[2]);
        a.href = "#/" + encodeURIComponent(cw) + "/" + encodeURIComponent(x[0]);
        a.addEventListener("click", function () { window.scrollTo(0, 0); });
        pn.appendChild(a);
      });
    }).catch(function () {});
    return nav;
  }

  function zoneLabel(title, hint) {
    var z = el("div", "lg-zone");
    z.appendChild(el("span", "lg-zone-title", title));
    z.appendChild(el("span", "lg-zone-hint", hint));
    return z;
  }

  // ---------- School overview: what the PIC needs to know and do, at a glance ----------

  function filled(v) { var t = String(v == null ? "" : v).trim(); return t !== "" && v !== false && !/^\*?\s*(tulis|isi)\b/i.test(t); }
  function rowsOf(key) { return (state.school.sections[key] || { rows: [] }).rows; }
  function countRows(key, col) { return rowsOf(key).filter(function (r) { return filled(r.v[col]); }).length; }
  function crmCounts() {
    var people = 0, aktif = 0;
    rowsOf("crm").forEach(function (r) {
      if (!filled(r.v[C.nama]) && r.v[C.ada] !== true) return;
      people++;
      if (r.v[C.ada] === true) aktif++;
    });
    return { people: people, aktif: aktif };
  }
  // Same rules as the Legality bot (backend sectionFilled): Planning needs a Perkara written;
  // Peluang needs its first column written.
  function planningFilled() { return countRows("planning", 0) > 0; }
  function peluangFilled() { return rowsOf("peluang").some(function (r) { return filled(r.v[0]); }); }
  function daysSince(iso) { return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : -1; }
  function agoText(iso) {
    var min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    return min < 60 ? "baru tadi" : min < 1440 ? Math.floor(min / 60) + " jam lepas" : Math.floor(min / 1440) + " hari lepas";
  }
  function noteInfo() {
    var n = (state.school.progress && state.school.progress.note) || {};
    var has = !!(n.text && n.updated);
    var days = has ? daysSince(n.updated) : -1;
    return { note: n, has: has, days: days, stale: !has || days >= 7 };
  }
  function weeklyDone() {
    var w = state.school.weekly;
    return !w || w.items.every(function (it) { return it.done; });
  }

  // Things the PIC should do now: [{ text, key, label }]
  function todoList() {
    var out = [];
    var ni = noteInfo();
    if (ni.stale) out.push({ key: "semasa", label: "Kemas kini",
      text: ni.has ? "Progress semasa tidak dikemas kini " + ni.days + " hari" : "Progress semasa belum pernah ditulis" });
    var w = state.school.weekly;
    if (w) w.items.forEach(function (it) {
      if (!it.done) out.push({ key: "mingguan", label: "Muat naik", text: it.label + " minggu ini belum ditanda" + (w.week.lastDay ? " (hari terakhir)" : "") });
    });
    if (!planningFilled()) out.push({ key: "planning", label: "Isi", text: "Planning Legality masih kosong" });
    if (!peluangFilled()) out.push({ key: "peluang", label: "Isi", text: "Peluang Lain Tahun Depan masih kosong" });
    if (!(state.school.pic || []).some(function (p) { return p.username; })) out.push({ key: "pic", label: "Tambah PIC", text: "PIC Legality belum ditetapkan" });
    return out;
  }

  // Status dot of each chip: "ok" (done), "warn" (to do / not saved), "bad" (needs action), "" (empty, optional)
  function sectionStatus(key) {
    if (state.dirty[key]) return "warn";
    switch (key) {
      case "ringkasan": return todoList().length ? "bad" : "ok";
      case "mingguan": return weeklyDone() ? "ok" : (state.school.weekly.week.lastDay ? "bad" : "warn");
      case "semasa": return noteInfo().stale ? "bad" : "ok";
      case "progress": return state.school.fasa && fasaLevel(state.school.fasa.phases, state.school.fasa.values) === state.school.fasa.phases.length ? "ok" : "warn";
      case "pic": return (state.school.pic || []).some(function (p) { return p.username; }) ? "ok" : "bad";
      case "crm": return crmCounts().people ? "ok" : "warn";
      case "planning": return planningFilled() ? "ok" : "bad";
      case "peluang": return peluangFilled() ? "ok" : "bad";
      default: return countRows(key, 0) ? "ok" : "";
    }
  }
  // One-line summary shown on a folded section
  function sectionMeta(key) {
    switch (key) {
      case "pic":
        var u = (state.school.pic || []).filter(function (p) { return p.username; }).map(function (p) { return "@" + p.username; });
        return u.length ? u.join(" ") : "Belum ditetapkan";
      case "crm": var c = crmCounts(); return c.people ? c.people + " orang · " + c.aktif + " aktif" : "Belum ada orang";
      case "alumni": var na = rowsOf("alumni").length ? parseAlumni(rowsOf("alumni")[0].v[0]).length : 0;
        return na ? na + " alumni" : "Tiada alumni";
      case "program": return countRows("program", 0) + " program";
      case "planning": return planningFilled() ? countRows("planning", 0) + " perkara" : "Kosong · bot akan tag PIC";
      case "peluang": return peluangFilled() ? countRows("peluang", 0) + " peluang" : "Kosong · bot akan tag PIC";
      default: var n = countRows(key, 0); return n ? n + " baris" : "Kosong";
    }
  }

  function goTo(key) {
    var sec = document.getElementById("sec-" + key);
    if (!sec) return;
    if (sec.openFold) sec.openFold(true);
    sec.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderSummary() {
    var box = document.getElementById("sec-ringkasan");
    if (!box) return;
    var d = state.school;
    box.textContent = "";

    var top = el("div", "lg-ov-top");
    var name = el("div");
    name.appendChild(el("h2", "lg-ov-name", d.sekolah));
    name.appendChild(el("p", "lg-ov-sub", "Cawangan " + d.cawangan));
    top.appendChild(name);
    var tags = el("div", "lg-ov-tags");
    var n = (d.progress && d.progress.note) || {};
    var st = n.status || "";
    tags.appendChild(el("span", "lg-ov-tag is-jenis", n.jenis ? "Jenis " + n.jenis : "Jenis —"));
    tags.appendChild(el("span", "lg-ov-tag " + (st === "Legal with B&W" ? "is-ok" : st === "Legal w/o B&W" ? "is-mid" : st === "Tidak Legal" ? "is-no" : "is-empty"), st || "Status belum ditetapkan"));
    var lock = el("span", "lg-ov-lock", "🔒");
    lock.title = "Jenis dan Status Legality ditetapkan oleh admin";
    tags.appendChild(lock);
    top.appendChild(tags);
    box.appendChild(top);

    var meta = el("div", "lg-ov-meta");
    var picLine = el("span", "lg-ov-pic");
    picLine.appendChild(document.createTextNode("PIC "));
    var pics = (d.pic || []).filter(function (p) { return p.username; });
    if (!pics.length) picLine.appendChild(el("span", "lg-ov-none", "belum ditetapkan"));
    pics.forEach(function (p) {
      var a = el("a", "lg-ov-tg", "@" + p.username);
      a.href = "https://t.me/" + encodeURIComponent(p.username); a.target = "_blank"; a.rel = "noopener";
      a.title = p.nama || "";
      picLine.appendChild(a);
    });
    var editPic = button("lg-ov-edit", "✏️", function () { goTo("pic"); });
    editPic.setAttribute("aria-label", "Ubah PIC Legality");
    picLine.appendChild(editPic);
    meta.appendChild(picLine);
    var ni = noteInfo();
    meta.appendChild(el("span", "lg-ov-when" + (ni.stale ? " is-stale" : ""),
      ni.has ? "Progress dikemas kini " + agoText(n.updated) : "Progress belum pernah dikemas kini"));
    box.appendChild(meta);

    var stats = el("div", "lg-ov-stats");
    var fz = d.fasa || { phases: [], values: [] };
    var level = fasaLevel(fz.phases, fz.values);
    var s1 = el("div", "lg-ov-stat");
    s1.appendChild(el("span", "lg-ov-label", "Fasa legality"));
    s1.appendChild(el("strong", "lg-ov-num", "Fasa " + level + " / " + fz.phases.length));
    var bar = el("div", "lg-ov-steps");
    fz.phases.forEach(function (f, i) { bar.appendChild(el("i", i < level ? "is-done" : "")); });
    s1.appendChild(bar);
    if (fz.phases[level]) s1.appendChild(el("span", "lg-ov-small", "Seterusnya: " + fz.phases[level].name));
    stats.appendChild(s1);
    if (d.weekly) {
      var s2 = el("div", "lg-ov-stat");
      s2.appendChild(el("span", "lg-ov-label", "Mingguan · " + d.weekly.week.label));
      var wd = weeklyDone();
      s2.appendChild(el("strong", "lg-ov-num " + (wd ? "is-ok" : "is-warn"), wd ? "✓ Selesai" : "Belum"));
      s2.appendChild(el("span", "lg-ov-small", d.weekly.items.map(function (it) { return it.label; }).join(", ")));
      stats.appendChild(s2);
    }
    var cc = crmCounts();
    var s3 = el("div", "lg-ov-stat");
    s3.appendChild(el("span", "lg-ov-label", "CRM"));
    s3.appendChild(el("strong", "lg-ov-num", cc.people + " orang"));
    s3.appendChild(el("span", "lg-ov-small", cc.aktif + " aktif"));
    stats.appendChild(s3);
    box.appendChild(stats);

    var todo = todoList();
    var act = el("div", "lg-ov-todo" + (todo.length ? "" : " is-clear"));
    if (!todo.length) {
      act.appendChild(el("p", "lg-ov-todo-title", "✓ Tiada tindakan tertunggak. Teruskan!"));
    } else {
      act.appendChild(el("p", "lg-ov-todo-title", "⚠️ Perlu tindakan (" + todo.length + ")"));
      todo.forEach(function (t) {
        var row = el("div", "lg-ov-todo-row");
        row.appendChild(el("span", null, t.text));
        row.appendChild(button("lg-ov-go", t.label, function () { goTo(t.key); }));
        act.appendChild(row);
      });
    }
    box.appendChild(act);
  }

  var NAV = [], navTimer = 0, navObserver = null;
  function buildNav(nav) {
    var items = [{ key: "ringkasan", short: "Ringkasan" }]
      .concat(state.school.weekly ? [{ key: "mingguan", short: "Mingguan" }] : [])
      .concat([{ key: "semasa", short: "Progress" }, { key: "progress", short: "Fasa" }])
      .concat(TOP_SECTIONS.map(sectionInfo))
      .concat([{ key: "pic", short: "PIC" }])
      .concat(SECTION_INFO.filter(function (s) { return TOP_SECTIONS.indexOf(s.key) < 0; }));
    NAV = items.map(function (s) {
      var a = el("a", "lg-chip");
      a.href = "#sec-" + s.key;
      var dot = el("i", "lg-dot");
      a.appendChild(dot);
      a.appendChild(document.createTextNode(s.short));
      a.addEventListener("click", function (e) { e.preventDefault(); goTo(s.key); });
      nav.appendChild(a);
      return { key: s.key, a: a, dot: dot };
    });
    // Keep the chips just under the site navbar, and mark the chip of the part being read.
    var site = document.getElementById("siteNav");
    function place() { nav.style.top = (site ? site.offsetHeight : 0) + "px"; }
    place();
    window.addEventListener("resize", place);
    if ("IntersectionObserver" in window) {
      var seen = {};
      if (navObserver) navObserver.disconnect();
      var io = navObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { seen[en.target.id] = en.isIntersecting ? en.boundingClientRect.top : null; });
        var best = null;
        Object.keys(seen).forEach(function (id) { if (seen[id] != null && (best == null || seen[id] < seen[best])) best = id; });
        NAV.forEach(function (n) {
          var on = "sec-" + n.key === best;
          n.a.classList.toggle("is-current", on);
          if (on && n.a.scrollIntoView && nav.scrollWidth > nav.clientWidth) {
            nav.scrollTo({ left: n.a.offsetLeft - nav.clientWidth / 2 + n.a.offsetWidth / 2, behavior: "smooth" });
          }
        });
      }, { rootMargin: "-120px 0px -55% 0px" });
      NAV.forEach(function (n) { var s = document.getElementById("sec-" + n.key); if (s) io.observe(s); });
    }
    // Unsaved changes turn a chip yellow straight away.
    clearInterval(navTimer);
    navTimer = setInterval(paintNav, 1000);
  }
  function paintNav() {
    if (!state.school) return;
    NAV.forEach(function (n) { n.dot.className = "lg-dot " + sectionStatus(n.key); });
    paintSaveBar();
    document.querySelectorAll(".lg-fold").forEach(function (card) { if (card.paintFold) card.paintFold(); });
  }
  // Called after anything is saved on this page, so the summary, chips and folded lines stay current.
  function schoolChanged() { renderSummary(); paintNav(); }

  // Folds a section card to its head plus a one-line summary; tapping the head opens it.
  function foldable(card, key) {
    var head = card.querySelector(".lg-section-head");
    if (!head) return card;
    card.classList.add("lg-fold");
    var body = el("div", "lg-fold-body");
    while (head.nextSibling) body.appendChild(head.nextSibling);
    card.appendChild(body);
    var meta = el("span", "lg-fold-meta");
    var chev = el("span", "lg-fold-chev", "›");
    var tools = head.querySelector(".lg-section-tools");
    head.insertBefore(meta, tools || null);
    head.appendChild(chev);
    head.classList.add("lg-fold-head");
    head.setAttribute("role", "button");
    head.tabIndex = 0;
    function set(open) {
      card.classList.toggle("is-open", open);
      head.setAttribute("aria-expanded", open ? "true" : "false");
    }
    card.openFold = function () { set(true); };
    card.paintFold = function () {
      var st = sectionStatus(key);
      meta.textContent = sectionMeta(key);
      meta.className = "lg-fold-meta " + st;
    };
    head.addEventListener("click", function (e) {
      if (e.target.closest("button, a, input, select, textarea")) return;
      set(!card.classList.contains("is-open"));
    });
    head.addEventListener("keydown", function (e) {
      if ((e.key === "Enter" || e.key === " ") && e.target === head) { e.preventDefault(); set(!card.classList.contains("is-open")); }
    });
    set(false);
    return card;
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
          state.school.sections[info.key].rows = d.data.rows;
          draw();
          schoolChanged();
          saved(schoolQ(), state.school);
          toast(info.short + " disimpan.", "ok");
        })
        .catch(function (e) {
          status.hidden = false;
          status.textContent = "Belum disimpan: " + (e.message || e);
          if (e && e.kod) relogin();
        })
        .then(function () { save.disabled = false; save.textContent = "Simpan " + info.short; });
    });
    return card;
  }

  // Progress Legality: six milestones, each simply done or not done.
  // PIC Legality of the school: name + Telegram username, saved to the "PIC Legality" tab.
  function picCard(saved) {
    var card = el("section", "borang-card lg-section");
    card.id = "sec-pic";
    var head = el("div", "lg-section-head");
    var titleWrap = el("div", "lg-section-title");
    titleWrap.appendChild(el("h2", "borang-section", "PIC Legality"));
    var badge = el("span", "lg-unsaved", "Belum disimpan");
    badge.hidden = true;
    titleWrap.appendChild(badge);
    head.appendChild(titleWrap);
    var tools = el("div", "lg-section-tools");
    head.appendChild(tools);
    card.appendChild(head);
    card.appendChild(el("p", "lg-lead", "PIC Legality yang menguruskan sekolah ini."));

    var orig = JSON.stringify(saved);
    var rows = saved.map(function (p) { return { nama: p.nama, username: p.username }; });
    var list = el("div", "lg-pic-list");
    card.appendChild(list);

    function current() {
      return rows.map(function (r) { return { nama: r.nama.trim(), username: r.username.trim().replace(/^@+/, "") }; })
        .filter(function (r) { return r.nama || r.username; });
    }
    function markDirty() {
      var d = JSON.stringify(current()) !== orig;
      state.dirty.pic = d;
      badge.hidden = !d;
    }
    function draw(focusLast) {
      list.textContent = "";
      if (!rows.length) list.appendChild(el("p", "lg-empty", "Belum ada PIC Legality untuk sekolah ini."));
      rows.forEach(function (r, i) {
        var row = el("div", "lg-pic-row");
        var nama = el("input", "borang-input");
        nama.placeholder = "Nama PIC"; nama.value = r.nama;
        nama.setAttribute("aria-label", "Nama PIC " + (i + 1));
        nama.addEventListener("input", function () { r.nama = nama.value; markDirty(); });
        var at = el("div", "lg-pic-at");
        at.appendChild(el("span", null, "@"));
        var user = el("input", "borang-input");
        user.placeholder = "username Telegram"; user.value = r.username;
        user.autocapitalize = "off"; user.spellcheck = false;
        user.setAttribute("aria-label", "Username Telegram PIC " + (i + 1));
        user.addEventListener("input", function () {
          user.value = user.value.replace(/^@+/, "").replace(/\s+/g, "");
          r.username = user.value; markDirty(); syncLink();
        });
        at.appendChild(user);
        var tg = el("a", "lg-pic-tg", "Telegram ↗");
        tg.target = "_blank"; tg.rel = "noopener";
        function syncLink() { tg.hidden = !/^[A-Za-z0-9_]{3,}$/.test(r.username); tg.href = "https://t.me/" + r.username; }
        syncLink();
        var del = button("lg-pic-del", "×", function () { rows.splice(i, 1); markDirty(); draw(); });
        del.setAttribute("aria-label", "Buang PIC " + (r.nama || i + 1));
        row.appendChild(nama); row.appendChild(at); row.appendChild(tg); row.appendChild(del);
        list.appendChild(row);
        if (focusLast && i === rows.length - 1) setTimeout(function () { nama.focus(); });
      });
    }
    tools.appendChild(button("lg-add-btn", "+ Tambah PIC", function () {
      rows.push({ nama: "", username: "" }); draw(true);
    }));
    draw();

    var status = el("p", "borang-error-summary");
    status.hidden = true;
    var save = button("borang-submit lg-btn-sm", "Simpan PIC", function () {
      if (!state.dirty.pic) { toast("Tiada perubahan untuk disimpan."); return; }
      var bad = current().filter(function (r) { return r.username && !/^[A-Za-z0-9_]{3,40}$/.test(r.username); })[0];
      if (bad) { status.hidden = false; status.textContent = "Username Telegram tidak sah: @" + bad.username; return; }
      status.hidden = true;
      // Shown as saved at once; the server's copy replaces it when it arrives (unless edited again meanwhile).
      var sent = JSON.stringify(current()), before = { orig: orig, pic: state.school.pic };
      orig = sent;
      state.school.pic = current();
      state.dirty.pic = false; badge.hidden = true;
      setTimeout(schoolChanged);
      toast("PIC Legality disimpan.", "ok");
      bgSave({ action: "savePic", cawangan: state.cawangan, sekolah: state.sekolah, pics: JSON.parse(sent) }, function (d) {
        state.school.pic = d.pic;
        if (JSON.stringify(current()) !== sent) return;   // edited again since: keep what is on screen
        orig = JSON.stringify(d.pic.map(function (p) { return { nama: p.nama, username: p.username }; }));
        rows = d.pic.map(function (p) { return { nama: p.nama, username: p.username }; });
        draw();
        markDirty();
      }, function (e) {
        orig = before.orig; state.school.pic = before.pic;
        markDirty();
        status.hidden = false; status.textContent = "Belum disimpan: " + (e.message || e);
        setTimeout(schoolChanged);
      });
    });
    var actions = el("div", "lg-actions");
    actions.appendChild(status);
    actions.appendChild(save);
    card.appendChild(actions);
    return card;
  }

  // Progress dan Status Legality Semasa: Jenis Legality (A/B/C), Status Legality and a short note on where things
  // stand with the school, with how long ago it was last updated.
  function fmtWhen(isoStr) {
    if (!isoStr) return "";
    return new Date(isoStr).toLocaleString("ms-MY", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  }
  function noteCard(note) {
    var card = el("section", "borang-card lg-section");
    card.id = "sec-semasa";
    var head = el("div", "lg-section-head");
    var titleWrap = el("div", "lg-section-title");
    titleWrap.appendChild(el("h2", "borang-section", "Progress dan Status Legality Semasa"));
    var badge = el("span", "lg-unsaved", "Belum disimpan");
    badge.hidden = true;
    titleWrap.appendChild(badge);
    head.appendChild(titleWrap);
    card.appendChild(head);
    card.appendChild(el("p", "lg-lead", "Tulis progress terkini urusan legality sekolah ini (contoh: sudah jumpa PK HEM, menunggu kelulusan pengetua). Jenis dan Status Legality ditetapkan oleh admin."));

    var orig = { text: note.text || "" };

    // Jenis and Status Legality are set by admin (dashboard admin); shown here only.
    function shown(labelText, value, tone) {
      var f = el("div", "lg-field");
      f.appendChild(el("span", "lg-label", labelText));
      f.appendChild(el("span", "lg-status-val" + (value ? " " + tone : " is-empty"), value || "Belum ditetapkan"));
      return f;
    }
    var st = note.status || "";
    var row = el("div", "lg-status-row");
    row.appendChild(shown("Jenis Legality", note.jenis || "", "is-jenis"));
    row.appendChild(shown("Status Legality", st,
      st === "Legal with B&W" ? "is-ok" : st === "Legal w/o B&W" ? "is-mid" : st === "Tidak Legal" ? "is-no" : ""));
    card.appendChild(row);
    card.appendChild(el("p", "lg-status-note", "🔒 Hanya admin boleh menukar Jenis dan Status Legality."));

    var box = el("div", "lg-field is-wide");
    var label = el("label", "lg-label", "Progress semasa");
    label.htmlFor = "semasaNote";
    var ta = el("textarea", "borang-input lg-note");
    ta.id = "semasaNote";
    ta.rows = 4;
    ta.maxLength = 3000;
    ta.placeholder = "Belum ada catatan progress.";
    ta.value = orig.text;
    box.appendChild(label);
    box.appendChild(ta);
    card.appendChild(box);
    var when = el("p", "lg-note-when");
    // How long ago, e.g. "Dikemas kini 3 hari lepas"; 7+ days gets a warning (bot PICO reminds the PIC then).
    function showWhen(iso) {
      if (!iso) { when.textContent = "Belum pernah dikemas kini."; when.className = "lg-note-when is-stale"; return; }
      var min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
      var days = Math.floor(min / 1440);
      when.textContent = (days >= 7 ? "⚠️ " : "") + "Dikemas kini " +
        (min < 60 ? "baru tadi" : min < 1440 ? Math.floor(min / 60) + " jam lepas" : days + " hari lepas") +
        (days >= 7 ? " — sila kemas kini (bot akan mengingatkan PIC)." : "");
      when.title = fmtWhen(iso);
      when.className = "lg-note-when" + (days >= 7 ? " is-stale" : "");
    }
    showWhen(note.updated);
    card.appendChild(when);
    var origShowWhen = showWhen;
    showWhen = function (iso) { origShowWhen(iso); if (typeof autoNote !== "undefined" && autoNote) when.appendChild(autoNote); };

    function markDirty() {
      var d = ta.value.trim() !== orig.text.trim();
      state.dirty.semasa = d;
      badge.hidden = !d;
    }
    // Saved automatically 2.5 s after the PIC stops typing (the button still works too).
    var autoTimer = 0, auto = false;
    var autoNote = el("span", "lg-autosave");
    when.appendChild(autoNote);
    ta.addEventListener("input", function () {
      markDirty();
      clearTimeout(autoTimer);
      autoNote.textContent = state.dirty.semasa ? " · menunggu untuk simpan automatik…" : "";
      if (state.dirty.semasa) autoTimer = setTimeout(function () {
        if (!state.dirty.semasa || save.disabled || !ta.value.trim()) return;
        auto = true;
        save.click();
      }, 2500);
    });

    var status = el("p", "borang-error-summary");
    status.hidden = true;
    var save = button("borang-submit lg-btn-sm", "Simpan Progress Semasa", function () {
      clearTimeout(autoTimer);
      if (!state.dirty.semasa) { auto = false; toast("Tiada perubahan untuk disimpan."); return; }
      var wasAuto = auto;
      auto = false;
      status.hidden = true;
      // One save at a time (the server checks "old" against what it has): typed during a save → sent right after.
      if (sending) { again = true; return; }
      sending = true;
      var sent = ta.value, before = orig;
      // Shown as saved at once; the server's reply only fills in the time.
      orig = { text: sent.trim() };
      state.dirty.semasa = false; badge.hidden = true;
      showWhen(new Date().toISOString());
      if (state.school.progress) state.school.progress.note = { text: sent.trim(), updated: new Date().toISOString(),
        jenis: (note.jenis || ""), status: (note.status || "") };
      schoolChanged();
      if (!when.contains(autoNote)) when.appendChild(autoNote);
      autoNote.textContent = wasAuto ? " · disimpan automatik ✓" : "";
      if (!wasAuto) toast("Progress semasa disimpan.", "ok");
      bgSave({ action: "saveProgressNote", cawangan: state.cawangan, sekolah: state.sekolah, note: sent, old: before.text }, function (d) {
        orig = { text: d.note.text };
        if (state.school.progress) state.school.progress.note = d.note;
        if (ta.value === sent) { ta.value = orig.text; showWhen(d.note.updated); }
        markDirty();
      }, function (e) {
        orig = before;
        if (state.school.progress) state.school.progress.note = note;
        markDirty();
        autoNote.textContent = "";
        status.hidden = false; status.textContent = "Belum disimpan: " + (e.message || e);
        schoolChanged();
        again = false;
      }).then(function () {
        sending = false;
        if (again) { again = false; markDirty(); if (state.dirty.semasa) save.click(); }
      });
    });
    var sending = false, again = false;
    var actions = el("div", "lg-actions");
    actions.appendChild(status);
    actions.appendChild(save);
    card.appendChild(actions);
    return card;
  }

  // Checklist Mingguan: this week's items (Isnin–Ahad, empty again every Monday). An item is ticked by uploading a
  // screenshot as proof; bot PICO (Netlify function pico) then posts it to the Program Tengah group, reminds the
  // PIC every weekday at 8 pagi while it is not done, and posts the week's summary on Saturday.
  function sendPico() {
    return fetch("/.netlify/functions/pico", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kod: getKod() })
    }).then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
      .catch(function () { return { ok: false }; });
  }

  function weeklyCard(wk) {
    var card = el("section", "borang-card lg-section");
    card.id = "sec-mingguan";
    var head = el("div", "lg-section-head");
    var titleWrap = el("div", "lg-section-title");
    titleWrap.appendChild(el("h2", "borang-section", "Checklist Mingguan"));
    head.appendChild(titleWrap);
    head.appendChild(el("span", "lg-wk-week", "Minggu " + wk.week.label));
    card.appendChild(head);
    card.appendChild(el("p", "lg-lead", "Selesaikan sebelum Jumaat 11:59 malam. Muat naik screenshot sebagai bukti; bot PICO akan menghantarnya ke group Program Tengah."));
    var list = el("div", "lg-wk-list");
    card.appendChild(list);

    function draw(items) {
      list.textContent = "";
      items.forEach(function (it) { list.appendChild(itemEl(it, items)); });
    }

    function itemEl(it, items) {
      var row = el("div", "lg-wk-item" + (it.done ? " is-done" : ""));
      row.appendChild(el("span", "lg-wk-box", it.done ? "✓" : ""));
      var main = el("div", "lg-wk-main");
      main.appendChild(el("span", "lg-wk-label", it.label));
      main.appendChild(el("span", "lg-wk-meta", it.done
        ? "Selesai " + fmtWhen(it.at) + (it.pic ? " · " + it.pic : "") + (it.posted ? " · dihantar ke group" : "")
        : (wk.week.lastDay ? "Belum · hari terakhir hari ini (Jumaat)" : "Belum · perlu screenshot sebagai bukti")));
      row.appendChild(main);

      if (it.done) {
        if (it.shot) {
          var a = el("a", "lg-wk-shot");
          a.href = it.shot.url; a.target = "_blank"; a.rel = "noopener";
          a.setAttribute("aria-label", "Lihat screenshot " + it.label);
          var img = el("img");
          img.src = it.shot.thumb; img.alt = ""; img.loading = "lazy";
          a.appendChild(img);
          row.appendChild(a);
        }
        row.appendChild(el("span", "lg-wk-state", "Dah buat"));
        return row;
      }

      var input = el("input");
      input.type = "file"; input.accept = "image/*"; input.hidden = true;
      var up = button("lg-wk-up", "📷 Muat naik screenshot", function () { input.click(); });
      input.addEventListener("change", function () {
        var f = input.files && input.files[0];
        input.value = "";
        if (!f) return;
        up.disabled = true; up.textContent = "Memuat naik…";
        shrinkImage(f)
          .then(function (img) {
            return post({ action: "saveWeekly", cawangan: state.cawangan, sekolah: state.sekolah, item: it.key,
                          mime: img.mime, data: img.data, name: img.name });
          })
          .then(function (d) {
            var now = d.weekly.items;
            draw(now);
            state.school.weekly = d.weekly;
            schoolChanged();
            saved(schoolQ(), state.school);
            toast(it.label + " ditanda selesai. Menghantar ke group…", "ok");
            return sendPico().then(function (r) {
              if (r.ok && r.dryRun) { toast("Ditanda selesai. (Ujian: mesej tidak dihantar.)", "ok"); return; }
              if (!r.ok) { toast("Ditanda selesai, tetapi Telegram gagal. Bot akan cuba lagi dalam seminit.", "warn"); return; }
              now.forEach(function (x) { if (x.key === it.key) x.posted = true; });
              draw(now);
              toast("Ditanda selesai dan screenshot dihantar ke group.", "ok");
            });
          })
          .catch(function (e) {
            up.disabled = false; up.textContent = "📷 Muat naik screenshot";
            if (e && e.kod) { relogin(); return; }
            toast("Belum ditanda: " + ((e && e.message) || e), "warn");
          });
      });
      row.appendChild(input);
      row.appendChild(up);
      return row;
    }

    draw(wk.items);
    return card;
  }

  // Fasa level: Fasa N once every action of Fasa 1..N is ticked (same rule as fasaLevel in Legality.gs).
  function fasaLevel(phases, vals) {
    var i = 0, level = 0;
    for (var k = 0; k < phases.length; k++) {
      var f = phases[k];
      var all = f.items.every(function (_, j) { return vals[i + j] === true; });
      i += f.items.length;
      if (!all) break;
      level = f.n;
    }
    return level;
  }

  // Checklist Fasa Legality: 10 fasa, each with its actions. Ticking every action of a fasa moves the school up.
  function fasaCard(fz) {
    var phases = fz.phases;
    var card = el("section", "borang-card lg-section");
    card.id = "sec-progress";
    var head = el("div", "lg-section-head");
    head.appendChild(el("h2", "borang-section", "Checklist Fasa Legality"));
    var badge = el("span", "lg-unsaved", "Belum disimpan");
    badge.hidden = true;
    head.appendChild(badge);
    card.appendChild(head);
    card.appendChild(el("p", "lg-lead", "Tandakan tindakan yang sudah dibuat. Bila semua tindakan dalam satu fasa ditanda, sekolah naik ke fasa itu secara automatik."));

    var orig = fz.values.slice(), work = fz.values.slice();
    var now = el("div", "lg-fasa-now");
    var bar = el("div", "lg-fasa-bar");
    bar.setAttribute("aria-hidden", "true");
    phases.forEach(function (f) { var s = el("span"); s.title = "Fasa " + f.n + " · " + f.name; bar.appendChild(s); });
    card.appendChild(now);
    card.appendChild(bar);

    var groups = el("div", "lg-fasa-groups");
    var start = 0, parts = [];
    phases.forEach(function (f) {
      var from = start;
      start += f.items.length;
      var d = el("details", "lg-fasa");
      var sum = el("summary");
      sum.appendChild(el("span", "lg-fasa-n", String(f.n)));
      var t = el("span", "lg-fasa-title");
      t.appendChild(el("strong", null, "Fasa " + f.n));
      t.appendChild(el("span", null, f.name));
      sum.appendChild(t);
      var cnt = el("span", "lg-fasa-count");
      sum.appendChild(cnt);
      d.appendChild(sum);
      var list = el("ul", "lg-fasa-items");
      f.items.forEach(function (label, j) {
        var k = from + j;
        var li = el("li");
        var lab = el("label", "lg-check lg-fasa-item");
        var cb = el("input");
        cb.type = "checkbox";
        cb.checked = work[k];
        cb.addEventListener("change", function () { work[k] = cb.checked; refresh(); });
        lab.appendChild(cb);
        lab.appendChild(el("span", null, label));
        li.appendChild(lab);
        list.appendChild(li);
        parts.push({ cb: cb, k: k });
      });
      d.appendChild(list);
      groups.appendChild(d);
      parts.push({ group: d, from: from, to: start, cnt: cnt, f: f });
    });
    card.appendChild(groups);

    var opened = false;
    function refresh() {
      var level = fasaLevel(phases, work);
      var cur = phases[level - 1], next = phases[level];
      now.textContent = "";
      now.appendChild(el("span", "lg-fasa-label", "Fasa semasa"));
      now.appendChild(el("strong", "lg-fasa-level", level ? "Fasa " + level + " · " + cur.name : "Fasa 0 · Belum bermula"));
      if (next) {
        var from = 0;
        for (var q = 0; q < level; q++) from += phases[q].items.length;
        var doneN = work.slice(from, from + next.items.length).filter(Boolean).length;
        now.appendChild(el("span", "lg-fasa-next", "Seterusnya: Fasa " + next.n + " · " + next.name + " (" + doneN + "/" + next.items.length + ")"));
      } else now.appendChild(el("span", "lg-fasa-next is-all", "✓ Semua fasa selesai"));
      Array.prototype.forEach.call(bar.children, function (s, i) { s.className = i < level ? "is-done" : i === level ? "is-next" : ""; });
      parts.forEach(function (p) {
        if (!p.group) return;
        var n = work.slice(p.from, p.to).filter(Boolean).length, tot = p.to - p.from;
        p.cnt.textContent = n + "/" + tot;
        p.group.classList.toggle("is-done", n === tot);
        p.group.classList.toggle("is-current", p.f.n === level + 1);
        if (!opened && p.f.n === level + 1) p.group.open = true;   // open the fasa being worked on, once
      });
      opened = true;
      var dirty = work.some(function (v, i) { return v !== orig[i]; });
      state.dirty.progress = dirty;
      badge.hidden = !dirty;
    }

    var status = el("p", "borang-error-summary");
    status.hidden = true;
    var save = button("borang-submit lg-btn-sm", "Simpan Fasa", function () {
      if (!state.dirty.progress) { toast("Tiada perubahan untuk disimpan."); return; }
      status.hidden = true;
      // One save at a time (the server checks "old"); shown as saved at once.
      if (fSending) { toast("Simpanan sebelum ini masih dihantar. Cuba sebentar lagi.", "warn"); return; }
      fSending = true;
      var before = fasaLevel(phases, orig), prev = orig.slice(), sent = work.slice();
      orig = sent.slice();
      state.school.fasa.values = sent.slice();
      setTimeout(schoolChanged);
      refresh();
      var lvl = fasaLevel(phases, sent);
      toast(lvl > before ? "Disimpan. Sekolah naik ke Fasa " + lvl + "." : "Checklist fasa disimpan.", "ok");
      bgSave({ action: "saveFasa", cawangan: state.cawangan, sekolah: state.sekolah, values: sent, old: prev }, function (d) {
        orig = d.values.slice();
        state.school.fasa.values = d.values.slice();
        if (JSON.stringify(work) === JSON.stringify(sent)) {
          work = d.values.slice();
          parts.forEach(function (p) { if (p.cb) p.cb.checked = work[p.k]; });
        }
        refresh();
        setTimeout(schoolChanged);
      }, function (e) {
        orig = prev;
        state.school.fasa.values = prev.slice();
        refresh();
        status.hidden = false; status.textContent = "Belum disimpan: " + (e.message || e);
        setTimeout(schoolChanged);
      }).then(function () { fSending = false; });
    });
    var fSending = false;
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
    else {
      input = el("input", "borang-input");
      input.type = opts.type || "text";
      // A date typed by hand in the sheet ("20 Nov") would show as blank in a date box: keep it as text.
      if (input.type === "date" && row.w[i] && !/^\d{4}-\d{2}-\d{2}$/.test(row.w[i])) input.type = "text";
    }
    if (opts.list) input.setAttribute("list", opts.list);
    input.id = id;
    input.value = row.w[i] == null ? "" : row.w[i];
    if (row.lock[i]) { input.disabled = true; input.title = "Sel ini sebahagian sel bercantum dalam sheet."; }
    input.addEventListener("input", function () { row.w[i] = input.value; onChange(); });
    box.appendChild(lab);
    box.appendChild(input);
    return box;
  }

  // A labelled input not tied to a sheet cell (the alumni Nama / Tahun SPM pairs).
  function plainField(label, value, attrs, onInput) {
    var box = el("div", "lg-field");
    var id = "f" + (++uid);
    var lab = el("label", "lg-label", label);
    lab.htmlFor = id;
    var input = el("input", "borang-input");
    input.type = "text"; input.id = id; input.value = value || "";
    Object.keys(attrs).forEach(function (k) { input.setAttribute(k, attrs[k]); });
    // Number-only boxes refuse other characters as they are typed or pasted.
    if (attrs.inputmode === "numeric") input.addEventListener("beforeinput", function (e) { if (e.data && /\D/.test(e.data)) e.preventDefault(); });
    input.addEventListener("input", function () { onInput(input.value); });
    box.appendChild(lab);
    box.appendChild(input);
    return box;
  }

  // "1. Adam Harith (SPM 2019)\n2. Wazif" <-> [{ nama, tahun }]. Older free text ("1. Afifah. 2. Alimi") is split too.
  function parseAlumni(t) {
    t = String(t || "").trim();
    if (!t || /^(tiada|tak ?ada|takde|belum ada|-+|—|nil|none|n\/?a)\.?$/i.test(t)) return [];
    return t.split(/\n|\s+(?=\d+\.\s)/).map(function (line) {
      line = line.replace(/^\s*(\d+[.)]|[-–•*])\s*/, "").trim();
      var tahun = "";
      var m = line.match(/\s*\(\s*SPM\s*(\d{1,4})\s*\)\s*$/i) || line.match(/[\s,(–-]*\(?\s*(?:SPM\s*)?((?:19|20)\d{2})\s*\)?\s*$/i);
      if (m) { tahun = m[1]; line = line.slice(0, m.index); }
      return { nama: line.replace(/[\s.,;–-]+$/, "").trim(), tahun: tahun };
    }).filter(function (a) { return a.nama || a.tahun; });
  }
  function alumniText(list) {
    return list.filter(function (a) { return a.nama.trim() || a.tahun; }).map(function (a, n) {
      return (n + 1) + ". " + a.nama.trim() + (a.tahun ? " (SPM " + a.tahun + ")" : "");
    }).join("\n");
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

      // Search by name / entiti / PIC, and filter by Ada (CRM aktif). Filtering hides rows without redrawing,
      // so typing in the search box keeps its focus.
      var crmF = state.crmFilter = state.crmFilter || { q: "", f: "all" };
      var tools = el("div", "lg-crm-tools");
      var search = el("input", "borang-input lg-crm-search");
      search.type = "search"; search.placeholder = "Cari nama, entiti atau PIC";
      search.setAttribute("aria-label", "Cari orang CRM");
      search.value = crmF.q;
      var chips = el("div", "lg-crm-filter");
      chips.setAttribute("role", "group");
      chips.setAttribute("aria-label", "Tapis CRM");
      [["all", "Semua"], ["ada", "Aktif"], ["tiada", "Tiada"]].forEach(function (f) {
        var b = button("lg-crm-chip" + (crmF.f === f[0] ? " is-on" : ""), f[1], function () {
          crmF.f = f[0];
          chips.querySelectorAll(".lg-crm-chip").forEach(function (x) { x.classList.toggle("is-on", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
          applyFilter();
        });
        b.setAttribute("aria-pressed", crmF.f === f[0] ? "true" : "false");
        chips.appendChild(b);
      });
      tools.appendChild(search);
      tools.appendChild(chips);
      body.appendChild(tools);
      var countEl = el("p", "lg-crm-count");
      body.appendChild(countEl);
      search.addEventListener("input", function () { crmF.q = search.value; applyFilter(); });
      function applyFilter() {
        var q = crmF.q.trim().toLowerCase(), shownN = 0, total = 0;
        body.querySelectorAll(".lg-person-row").forEach(function (rowEl) {
          total++;
          var ok = (!q || rowEl.dataset.search.indexOf(q) > -1) &&
                   (crmF.f === "all" || (crmF.f === "ada") === (rowEl.dataset.ada === "1") || rowEl.dataset.isnew === "1");
          rowEl.hidden = !ok;
          if (ok) shownN++;
        });
        body.querySelectorAll(".lg-group").forEach(function (h) {
          var any = false, n = h.nextElementSibling;
          while (n && n.classList.contains("lg-person-row")) { if (!n.hidden) any = true; n = n.nextElementSibling; }
          h.hidden = !any;
        });
        countEl.textContent = (q || crmF.f !== "all") ? shownN + " daripada " + total + " orang" : total + " orang";
      }
      var groups = [["High", "High Priority"], ["Low", "Low Priority"], ["", "Baru"]];
      groups.forEach(function (g) {
        var rows = visible.filter(function (row) {
          return g[0] ? row.group === g[0] && row.r != null : row.r == null || (row.group !== "High" && row.group !== "Low");
        });
        if (!rows.length) return;
        body.appendChild(el("h3", "lg-group", g[1]));
        rows.forEach(function (row) { body.appendChild(personCard(row)); });
      });
      setTimeout(applyFilter);

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

      // WhatsApp link from a Malaysian phone number ("012-345 6789" -> 60123456789)
      function waLink(tel) {
        var d = String(tel || "").replace(/\D/g, "");
        if (d.length < 9) return "";
        if (d.charAt(0) === "0") d = "6" + d;
        return "https://wa.me/" + d;
      }

      // One line per person in the list; tapping it opens the popup with all the details.
      function personCard(row) {
        var wrap = el("div", "lg-person-row");
        wrap.dataset.search = [row.w[C.nama], row.w[C.entiti], row.w[C.pic], row.w[C.phase]].join(" ").toLowerCase();
        wrap.dataset.ada = row.w[C.ada] === true ? "1" : "0";
        wrap.dataset.isnew = row.r == null ? "1" : "0";
        wrap.appendChild(personButton(row));
        var wa = waLink(row.w[C.tel]);
        if (wa) {
          var a = el("a", "lg-person-wa", "WhatsApp");
          a.href = wa; a.target = "_blank"; a.rel = "noopener";
          a.setAttribute("aria-label", "WhatsApp " + (row.w[C.nama] || ""));
          wrap.appendChild(a);
        }
        return wrap;
      }
      function personButton(row) {
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

    // One cell in the sheet holds every alumni, one per line: "1. Adam Harith (SPM 2019)".
    // The form edits them as Nama + Tahun SPM pairs and writes the lines back.
    alumni: function (body, model, changed, redraw) {
      var row = model.rows[0];
      if (!row) return body.appendChild(el("p", "lg-empty", "Bahagian ini tiada dalam tab sekolah."));
      if (row.lock[0]) return body.appendChild(el("p", "lg-empty", "Sel alumni bercantum dalam sheet — kemas kini terus di sheet."));
      if (!model.alumni || alumniText(model.alumni) !== String(row.w[0] || "")) model.alumni = parseAlumni(row.w[0]);
      var list = model.alumni;
      function sync() { row.w[0] = alumniText(list); changed(); }
      list.forEach(function (a, n) {
        var card = el("div", "lg-row");
        card.appendChild(el("span", "lg-row-num", String(n + 1)));
        var f = el("div", "lg-fields lg-alumni-fields");
        f.appendChild(plainField("Nama", a.nama, {}, function (v) { a.nama = v; sync(); }));
        f.appendChild(plainField("Tahun SPM", a.tahun, { inputmode: "numeric", maxlength: 4, placeholder: "cth. 2019" },
          function (v) { a.tahun = v.replace(/\D/g, ""); sync(); }));
        card.appendChild(f);
        card.appendChild(button("link-btn lg-remove", "Buang", function () {
          list.splice(list.indexOf(a), 1); sync(); redraw();
        }));
        body.appendChild(card);
      });
      if (!list.length) body.appendChild(el("p", "lg-empty", "Belum ada alumni direkodkan."));
      body.appendChild(button("lg-add", "+ Tambah alumni", function () {
        list.push({ nama: "", tahun: "" }); redraw();
      }));
    },

    analisa: function (body, model, changed) {
      var row = model.rows[0];
      if (!row) return body.appendChild(el("p", "lg-empty", "Bahagian ini tiada dalam tab sekolah."));
      body.appendChild(textField("Analisa situasi semasa sekolah", row, 0, { long: true, rows: 6, wide: true }, changed));
    },

    planning: tableSection([
      { i: 0, label: "Perkara (apa tindakan yang nak dibuat)", long: true, wide: true },
      { i: 1, label: "Tarikh", type: "date" }
    ], "+ Tambah perkara", "Belum ada perkara dirancang.", { removable: true }),

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

  // ---------- Images ----------
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

  // Rows with content are shown as editable cards; empty rows stay hidden until "Tambah" is used.
  // opts.removable: saved rows get "Buang" too; it empties the row in the sheet on Simpan (the empty row is
  // then reused by the next "Tambah").
  function tableSection(fields, addLabel, emptyText, opts) {
    opts = opts || {};
    return function (body, model, changed, redraw) {
      var key = model.key;
      var rows = model.rows.filter(function (row) {
        return !row.removed && (row.r == null || row.shown || hasContent(row.v, key));
      });
      rows.forEach(function (row, n) {
        var card = el("div", "lg-row");
        card.appendChild(el("span", "lg-row-num", String(n + 1)));
        var f = el("div", "lg-fields");
        fields.forEach(function (fd) {
          if (fd.check) f.appendChild(checkField(fd.label, row, fd.i, changed, "is-solo"));
          else f.appendChild(textField(fd.label, row, fd.i, { long: fd.long, wide: fd.wide, rows: 2, type: fd.type }, changed));
        });
        card.appendChild(f);
        if (row.r == null) {
          card.appendChild(button("link-btn lg-remove", "Buang", function () {
            model.rows.splice(model.rows.indexOf(row), 1);
            redraw();
          }));
        } else if (opts.removable && !row.lock.some(Boolean)) {
          card.appendChild(button("link-btn lg-remove", "Buang", function () {
            row.w = row.w.map(function (v) { return v === true || v === false ? false : ""; });
            row.removed = true; row.shown = false;
            changed();
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
