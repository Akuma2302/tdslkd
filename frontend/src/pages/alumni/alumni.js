// Alumni (user portal): pick a cawangan, then view, add and update the "Alumni Back to School"
// entries in that cawangan's tab of the Alumni sheet. Backend: backend/legality/Legality.gs (readAlumni / saveAlumni).
(function () {
  "use strict";

  var Api = window.LegalityApi;
  var CAWANGAN = ["TENGAH", "UTARA", "PT", "INDONESIA", "BORNEO", "MEA"];
  var root = document.getElementById("root");
  var crumbs = document.getElementById("crumbs");
  var toastEl = document.getElementById("toast");
  var state = { cawangan: null, data: null, rows: [], dirty: false };
  var newUid = 0;

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
  var toastTimer;
  function toast(msg, tone) {
    toastEl.textContent = msg;
    toastEl.className = "lg-toast" + (tone ? " " + tone : "");
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3500);
  }
  function message(title, body, tone) {
    root.textContent = "";
    var box = el("div", "borang-card borang-message" + (tone ? " " + tone : ""));
    box.appendChild(el("h2", "borang-message-title", title));
    if (body) box.appendChild(el("p", null, body));
    root.appendChild(box);
    return box;
  }
  function fail(e) {
    if (e && e.kod && window.YoshGate) { root.textContent = ""; window.YoshGate.show("Kod akses telah ditukar. Masukkan kod baru."); window.YoshGate.ready(route); return; }
    var box = message("Tidak dapat dimuatkan", (e && e.message) || String(e), "warn");
    box.appendChild(button("link-btn", "Cuba lagi", route));
  }

  // ---------- Routing: #/ · #/CAWANGAN ----------

  function route() {
    var c = decodeURIComponent(location.hash.replace(/^#\/?/, "").split("/")[0] || "");
    state.cawangan = CAWANGAN.indexOf(c) > -1 ? c : null;
    state.dirty = false;
    renderCrumbs();
    if (!Api || !Api.configured) return message("Belum disambungkan", "Pautan Apps Script belum dimasukkan dalam src/config/config.js.", "warn");
    if (!state.cawangan) return showCawangan();
    showList();
  }
  function go(hash) {
    if (state.dirty && !confirm("Ada perubahan yang belum disimpan. Tinggalkan halaman ini?")) return;
    state.dirty = false;
    location.hash = hash;
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("beforeunload", function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

  function renderCrumbs() {
    crumbs.textContent = "";
    var a = el("a", "lg-crumb" + (state.cawangan ? "" : " is-current"), "Cawangan");
    a.href = "#/";
    a.addEventListener("click", function (e) { e.preventDefault(); go("#/"); });
    crumbs.appendChild(a);
    if (state.cawangan) {
      crumbs.appendChild(el("span", "lg-crumb-sep", "›"));
      crumbs.appendChild(el("span", "lg-crumb is-current", state.cawangan));
    }
  }

  // ---------- Step 1: cawangan ----------

  function showCawangan() {
    root.textContent = "";
    var card = el("section", "borang-card");
    card.appendChild(el("h2", "borang-section", "Pilih cawangan"));
    card.appendChild(el("p", "lg-lead", "Senarai alumni yang turun ke sekolah (Alumni Back to School) mengikut cawangan."));
    var grid = el("div", "lg-grid");
    var last = null;
    try { last = localStorage.getItem("alumni:cawangan"); } catch (e) {}
    CAWANGAN.forEach(function (c) {
      var b = button("lg-tile" + (c === last ? " is-last" : ""), null, function () {
        try { localStorage.setItem("alumni:cawangan", c); } catch (e) {}
        go("#/" + encodeURIComponent(c));
      });
      b.appendChild(el("span", "lg-tile-name", c));
      b.appendChild(el("span", "lg-tile-meta", c === last ? "Terakhir dibuka" : "Buka"));
      grid.appendChild(b);
    });
    card.appendChild(grid);
    root.appendChild(card);
  }

  // ---------- Step 2: alumni list ----------

  function hasContent(vals) { return vals.some(function (v) { return v !== "" && v !== false; }); }

  function showList() {
    root.textContent = "";
    root.appendChild(el("p", "borang-status", "Memuatkan alumni " + state.cawangan + "…"));
    Api.get({ action: "alumni", cawangan: state.cawangan }).then(function (d) {
      state.data = d;
      state.rows = d.rows.filter(function (r) { return hasContent(r.v); })
        .map(function (r) { return { r: r.r, v: r.v.slice(), w: r.v.slice() }; });
      draw();
    }).catch(fail);
  }

  function draw() {
    var cols = state.data.columns;
    root.textContent = "";
    var card = el("section", "borang-card lg-section");
    var head = el("div", "lg-section-head");
    head.appendChild(el("h2", "borang-section", "Alumni Back to School · " + state.cawangan));
    var badge = el("span", "lg-unsaved", "Belum disimpan");
    badge.hidden = true;
    head.appendChild(badge);
    card.appendChild(head);

    var tools = el("div", "lg-tools al-tools");
    var search = el("input", "borang-input lg-search");
    search.type = "search";
    search.placeholder = "Cari nama, sekolah atau program";
    search.setAttribute("aria-label", "Cari alumni");
    var count = el("span", "al-count");
    var addBtn = button("lg-add-btn", "+ Tambah alumni");
    var searchRow = el("div", "lg-search-row");
    searchRow.appendChild(search);
    searchRow.appendChild(addBtn);
    tools.appendChild(searchRow);
    tools.appendChild(count);
    card.appendChild(tools);

    var list = el("div", "al-list");
    card.appendChild(list);

    function markDirty() {
      state.dirty = state.rows.some(function (row) {
        if (row.r == null) return hasContent(row.w);
        return row.w.some(function (v, i) { return v !== row.v[i]; });
      });
      badge.hidden = !state.dirty;
    }

    function summaryOf(row) {
      return {
        name: row.w[0] || (row.r == null ? "Alumni baru" : "Tanpa nama"),
        empty: !row.w[0],
        meta: [row.w[1], row.w[6]].filter(String).join(" · ")
      };
    }

    // One line per alumni in the list; tapping it opens the popup with all the details.
    function rowCard(row, n) {
      var sm = summaryOf(row);
      var card = button("lg-person lg-person-btn" + (row.r == null ? " is-new" : ""), null, function () { openRow(row, false); });
      card.appendChild(el("span", "al-num", String(n)));
      var left = el("span", "lg-person-left");
      left.appendChild(el("span", "lg-person-name" + (sm.empty ? " is-empty" : ""), sm.name));
      left.appendChild(el("span", "lg-person-meta", sm.meta));
      card.appendChild(left);
      card.appendChild(el("span", "lg-person-go", "›"));
      return card;
    }

    function openRow(row, isNew) {
      var modal;
      function ch() {
        var sm = summaryOf(row);
        modal.setTitle(sm.name, sm.empty);
        modal.setSubtitle(sm.meta);
        markDirty();
      }
      var form = el("div", "ym-form");
      var grid = el("div", "lg-fields");
      var checks = el("div", "lg-checklist");
      cols.forEach(function (col, j) {
        if (col.kind === "check") {
          var lab = el("label", "lg-check");
          var cb = el("input");
          cb.type = "checkbox";
          cb.checked = row.w[j] === true;
          cb.addEventListener("change", function () { row.w[j] = cb.checked; ch(); });
          lab.appendChild(cb);
          lab.appendChild(el("span", null, col.label));
          checks.appendChild(lab);
          return;
        }
        var box = el("div", "lg-field" + (j === 0 ? " is-wide" : "") + (col.kind === "list" ? " borang-field" : ""));
        var id = "al-f" + j;
        var label = el("label", "lg-label", col.label);
        label.htmlFor = id;
        var input;
        if (col.kind === "list") {
          input = el("select");
          var opts = col.options.slice();
          if (row.w[j] && opts.indexOf(row.w[j]) < 0) opts.unshift(row.w[j]);
          input.appendChild(new Option("—", ""));
          opts.forEach(function (o) { input.appendChild(new Option(o, o)); });
          input.value = row.w[j] || "";
          input.addEventListener("change", function () { row.w[j] = input.value; ch(); });
        } else {
          input = el("input", "borang-input");
          input.value = row.w[j] || "";
          input.addEventListener("input", function () { row.w[j] = input.value; ch(); });
        }
        input.id = id;
        box.appendChild(label);
        box.appendChild(input);
        grid.appendChild(box);
      });
      form.appendChild(el("h3", "ym-sec", "Maklumat"));
      form.appendChild(grid);
      if (checks.children.length) {
        form.appendChild(el("h3", "ym-sec", "Progress"));
        form.appendChild(checks);
      }
      if (row.r == null) {
        form.appendChild(button("link-btn lg-remove", "Buang alumni baru ini", function () {
          state.rows.splice(state.rows.indexOf(row), 1);
          markDirty();
          modal.close();
        }));
      }
      var sm = summaryOf(row);
      modal = window.YoshModal.open({
        title: sm.name, titleEmpty: sm.empty, subtitle: sm.meta,
        body: form, focusFirst: isNew,
        actions: [{ label: "Simpan", primary: true, onClick: function (m) { m.close(); save.click(); } }],
        onClose: drawList
      });
    }

    function drawList() {
      list.textContent = "";
      var q = search.value.trim().toLowerCase();
      var shown = state.rows.filter(function (row) {
        return !q || row.r == null || row.w.some(function (v) { return typeof v === "string" && v.toLowerCase().indexOf(q) > -1; });
      });
      // New (unsaved) alumni first, so the one just added is right under the search bar.
      var fresh = shown.filter(function (row) { return row.r == null; }).reverse();
      fresh.forEach(function (row) { list.appendChild(rowCard(row, "Baru")); });
      var saved = state.rows.filter(function (row) { return row.r != null; });
      shown.filter(function (row) { return row.r != null; })
        .forEach(function (row) { list.appendChild(rowCard(row, saved.indexOf(row) + 1)); });
      if (!shown.length) list.appendChild(el("p", "lg-empty", state.rows.length ? "Tiada alumni sepadan." : "Belum ada alumni untuk cawangan ini."));
      count.textContent = state.rows.filter(function (r) { return r.r != null; }).length + " alumni";
    }
    search.addEventListener("input", drawList);
    drawList();

    addBtn.addEventListener("click", function () {
      var blank = cols.map(function (c) { return c.kind === "check" ? false : ""; });
      state.rows.push({ r: null, v: blank.slice(), w: blank });
      search.value = "";
      drawList();
      openRow(state.rows[state.rows.length - 1], true);
    });

    var status = el("p", "borang-error-summary");
    status.hidden = true;
    var save = button("borang-submit lg-btn-sm", "Simpan", function () {
      var edits = [], adds = [];
      state.rows.forEach(function (row) {
        if (row.r == null) { if (hasContent(row.w)) adds.push(row.w); return; }
        row.w.forEach(function (v, j) { if (v !== row.v[j]) edits.push({ r: row.r, c: cols[j].c, old: row.v[j], val: v }); });
      });
      if (!edits.length && !adds.length) { toast("Tiada perubahan untuk disimpan."); return; }
      status.hidden = true;
      save.disabled = true; save.textContent = "Menyimpan…";
      Api.post({ action: "saveAlumni", cawangan: state.cawangan, edits: edits, adds: adds })
        .then(function (d) {
          state.rows = d.rows.filter(function (r) { return hasContent(r.v); })
            .map(function (r) { return { r: r.r, v: r.v.slice(), w: r.v.slice() }; });
          state.dirty = false;
          draw();
          toast("Alumni disimpan.", "ok");
        })
        .catch(function (e) {
          if (e.kod) return fail(e);
          status.hidden = false;
          status.textContent = "Belum disimpan: " + (e.message || e);
          save.disabled = false; save.textContent = "Simpan";
        });
    });
    var actions = el("div", "lg-actions");
    actions.appendChild(status);
    actions.appendChild(save);
    card.appendChild(actions);
    root.appendChild(card);
  }

  if (window.YoshGate) window.YoshGate.ready(route); else route();
})();
