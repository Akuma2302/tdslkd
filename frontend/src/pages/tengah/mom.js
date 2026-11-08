// Tengah page (/tengah): MOM (minutes of meeting) for cawangan Tengah.
// Each item: Tarikh MOM · Tindakan · Tarikh Due · Masa Due · Unit · PIC (one or more) · Reminder (one or more).
// The whole list is saved at once to the "MOM" tab of the TENGAH sheet (backend/legality/Legality.gs: readMom /
// saveMom). Right after a save the page asks the Netlify function mom-hantar to post the new items to Telegram
// (bot SU Tengah, each unit's topic); reminders are posted later through the same function by the Apps Script trigger momReminderTick.
(function () {
  "use strict";

  var Api = window.LegalityApi;
  var root = document.getElementById("root");
  var toastEl = document.getElementById("toast");
  var state = { orig: [], items: [], updated: "", dirty: false, units: [], pics: [], remUnits: [] };

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
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 4500);
  }
  function pad(n) { return ("0" + n).slice(-2); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function fmtWhen(iso) {
    return iso ? new Date(iso).toLocaleString("ms-MY", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : "";
  }
  function dueAt(it) {
    if (!it.due) return null;
    var p = it.due.split("-"), t = (it.masa || "23:59").split(":");
    return new Date(+p[0], +p[1] - 1, +p[2], +t[0], +t[1]);
  }
  function isLate(it) { var d = dueAt(it); return !!d && d < new Date(); }
  function copy(it) {
    return { id: it.id || "", tarikh: it.tarikh || "", tindakan: it.tindakan || "", due: it.due || "", masa: it.masa || "",
             unit: it.unit || "", pic: (it.pic || []).slice(), reminder: (it.reminder || []).slice(), sent: (it.sent || []).slice() };
  }
  function clean(list) {
    return list.map(function (it) {
      return { id: it.id, tarikh: it.tarikh, tindakan: it.tindakan.trim(), due: it.due, masa: it.masa, unit: it.unit,
               pic: it.pic.slice(), reminder: it.reminder.slice() };
    }).filter(function (it) { return it.tindakan || it.due || it.pic.length; });
  }
  function labelOf(list, id) { for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].label; return id; }
  // Reminder ids are a number + time unit: "15m", "2h", "3d", "1w", "1b" (bulan).
  function remParts(id) {
    var m = String(id).match(/^(\d+)([a-z])$/);
    var u = m && state.remUnits.filter(function (x) { return x.id === m[2]; })[0];
    return u ? { n: +m[1], unit: u } : null;
  }
  var REM_MIN = { m: 1, h: 60, d: 1440, w: 10080, b: 43200 };
  function remMin(id) { var p = remParts(id); return p ? p.n * REM_MIN[p.unit.id] : 0; }
  function remLabel(id, short) { var p = remParts(id); return p ? p.n + " " + p.unit.label + (short ? "" : " sebelum") : id; }
  window.addEventListener("beforeunload", function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

  // Only one dropdown (PIC / Reminder) open at a time; a click elsewhere closes it.
  document.addEventListener("click", function (e) {
    document.querySelectorAll("details.mom-multi[open]").forEach(function (d) { if (!d.contains(e.target)) d.open = false; });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    document.querySelectorAll("details.mom-multi[open]").forEach(function (d) { d.open = false; d.querySelector("summary").focus(); });
  });

  function fail(e) {
    if (e && e.kod && window.YoshGate) { root.textContent = ""; window.YoshGate.show("Kod akses telah ditukar. Masukkan kod baru."); window.YoshGate.ready(load); return; }
    root.textContent = "";
    var box = el("div", "borang-card borang-message warn");
    box.appendChild(el("h2", "borang-message-title", "Tidak dapat dimuatkan"));
    box.appendChild(el("p", null, (e && e.message) || String(e)));
    box.appendChild(button("link-btn", "Cuba lagi", load));
    root.appendChild(box);
  }

  function take(d) {
    state.orig = d.items.map(copy);
    state.items = d.items.map(copy);
    state.updated = d.updated;
    state.units = d.units || [];
    state.pics = d.pics || [];
    state.remUnits = d.remUnits || [];
    state.dirty = false;
  }

  function load() {
    root.textContent = "";
    root.appendChild(el("p", "borang-status", "Memuatkan MOM…"));
    Api.get({ action: "mom" }).then(function (d) { take(d); draw(); }).catch(fail);
  }

  // Ask the bot to post what is new (and any reminder that is due). Reminders keep coming from the
  // scheduled function even if this call fails, and anything not sent is retried there.
  function sendTelegram() {
    return fetch("/.netlify/functions/mom-hantar", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kod: Api.getKod() })
    }).then(function (r) { return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; }); })
      .catch(function () { return { ok: false, error: "tiada sambungan" }; });
  }

  // A <details> dropdown with checkboxes; `selected` is the array it edits.
  function multi(cls, options, selected, placeholder, onChange) {
    var d = el("details", "mom-multi " + cls);
    var sum = el("summary", "borang-input mom-multi-sum");
    var pop = el("div", "mom-pop");
    function paint() {
      sum.textContent = "";
      if (!selected.length) { sum.appendChild(el("span", "mom-ph", placeholder)); return; }
      sum.appendChild(el("span", "mom-multi-val", selected.map(function (id) { return labelOf(options, id); }).join(", ")));
      if (selected.length > 1) sum.appendChild(el("span", "mom-multi-n", String(selected.length)));
    }
    options.forEach(function (o) {
      var lab = el("label", "mom-opt");
      var cb = el("input");
      cb.type = "checkbox";
      cb.checked = selected.indexOf(o.id) >= 0;
      cb.addEventListener("change", function () {
        var i = selected.indexOf(o.id);
        if (cb.checked && i < 0) selected.push(o.id);
        if (!cb.checked && i >= 0) selected.splice(i, 1);
        selected.sort(function (a, b) { return options.findIndex(function (x) { return x.id === a; }) - options.findIndex(function (x) { return x.id === b; }); });
        paint(); onChange();
      });
      lab.appendChild(cb);
      lab.appendChild(el("span", null, o.label));
      pop.appendChild(lab);
    });
    d.addEventListener("toggle", function () {
      if (d.open) document.querySelectorAll("details.mom-multi[open]").forEach(function (x) { if (x !== d) x.open = false; });
    });
    paint();
    d.appendChild(sum);
    d.appendChild(pop);
    return d;
  }

  // Reminder: free choice of number + time unit (minit 1–60, jam 1–24, hari 1–365, minggu 1–52, bulan 1–12),
  // more than one per item. `selected` is the item's array of reminder ids.
  function remPicker(selected, onChange) {
    var d = el("details", "mom-multi mom-rem-pick");
    var sum = el("summary", "borang-input mom-multi-sum");
    var pop = el("div", "mom-pop mom-rem-pop");
    var chips = el("div", "mom-rem-list");
    var num = el("select", "borang-input mom-rem-num");
    num.setAttribute("aria-label", "Berapa");
    var unit = el("select", "borang-input mom-rem-unit");
    unit.setAttribute("aria-label", "Minit, jam, hari, minggu atau bulan");
    state.remUnits.forEach(function (u) { unit.appendChild(new Option(u.label, u.id)); });
    unit.value = "h";
    function fillNum() {
      var u = state.remUnits.filter(function (x) { return x.id === unit.value; })[0];
      var keep = +num.value || 1;
      num.textContent = "";
      for (var i = 1; i <= (u ? u.max : 1); i++) num.appendChild(new Option(String(i), String(i)));
      num.value = String(Math.min(keep, u ? u.max : 1));
    }
    unit.addEventListener("change", fillNum);
    fillNum();
    function paint() {
      sum.textContent = "";
      if (!selected.length) sum.appendChild(el("span", "mom-ph", "Tiada"));
      else {
        sum.appendChild(el("span", "mom-multi-val", selected.map(function (x) { return remLabel(x, true); }).join(", ")));
        if (selected.length > 1) sum.appendChild(el("span", "mom-multi-n", String(selected.length)));
      }
      chips.textContent = "";
      if (!selected.length) chips.appendChild(el("p", "mom-rem-empty", "Belum ada reminder."));
      selected.forEach(function (id) {
        var chip = el("span", "mom-chip", remLabel(id));
        var x = button("mom-chip-x", "×", function (e) {
          e.stopPropagation();   // the chip leaves the page; keep the dropdown open
          selected.splice(selected.indexOf(id), 1);
          paint(); onChange();
        });
        x.setAttribute("aria-label", "Buang reminder " + remLabel(id));
        chip.appendChild(x);
        chips.appendChild(chip);
      });
    }
    var addBtn = button("mom-rem-btn", "+ Tambah", function () {
      var id = num.value + unit.value;
      if (selected.indexOf(id) >= 0) { toast("Reminder " + remLabel(id) + " sudah ada."); return; }
      if (selected.length >= 10) { toast("Maksimum 10 reminder untuk satu item."); return; }
      selected.push(id);
      selected.sort(function (a, b) { return remMin(a) - remMin(b); });
      paint(); onChange();
    });
    var add = el("div", "mom-rem-add");
    add.appendChild(num); add.appendChild(unit); add.appendChild(addBtn);
    pop.appendChild(chips);
    pop.appendChild(add);
    pop.appendChild(el("p", "mom-rem-hint", "Pilih nombor dan minit / jam / hari / minggu / bulan sebelum due, kemudian tekan Tambah. Boleh tambah lebih daripada satu."));
    d.addEventListener("toggle", function () {
      if (d.open) document.querySelectorAll("details.mom-multi[open]").forEach(function (o) { if (o !== d) o.open = false; });
    });
    paint();
    d.appendChild(sum);
    d.appendChild(pop);
    return d;
  }

  function field(cls, label, input) {
    var f = el("div", "lg-field " + cls);
    var l = el("label", "lg-label", label);
    if (input.id) l.htmlFor = input.id;
    f.appendChild(l);
    f.appendChild(input);
    return f;
  }

  function draw() {
    root.textContent = "";
    var card = el("section", "borang-card lg-section mom");
    var head = el("div", "lg-section-head");
    var titleWrap = el("div", "lg-section-title");
    titleWrap.appendChild(el("h2", "borang-section", "MOM"));
    var badge = el("span", "lg-unsaved", "Belum disimpan");
    badge.hidden = !state.dirty;
    titleWrap.appendChild(badge);
    head.appendChild(titleWrap);
    var tools = el("div", "lg-section-tools");
    head.appendChild(tools);
    card.appendChild(head);
    card.appendChild(el("p", "lg-lead", "Minit mesyuarat Cawangan Tengah. Selepas disimpan, bot SU Tengah menghantar setiap tindakan baru ke topik unitnya, kemudian mengingatkan PIC mengikut reminder yang dipilih."));

    var list = el("div", "mom-list");
    card.appendChild(list);
    var count = el("p", "mom-count");
    card.appendChild(count);

    function markDirty() {
      state.dirty = JSON.stringify(clean(state.items)) !== JSON.stringify(clean(state.orig));
      badge.hidden = !state.dirty;
      paintCount();
    }
    function paintCount() {
      var n = clean(state.items).length;
      var lateN = state.items.filter(isLate).length;
      count.textContent = n + " item" + (lateN ? " · " + lateN + " lewat due" : "") +
        (state.updated ? " · Dikemas kini " + fmtWhen(state.updated) : "");
    }

    function rowEl(item, i) {
      var row = el("div", "mom-row");
      row.appendChild(el("span", "mom-num", String(i + 1)));
      var key = "mom-" + i + "-";

      var tarikh = el("input", "borang-input");
      tarikh.type = "date"; tarikh.id = key + "tarikh"; tarikh.value = item.tarikh;
      tarikh.addEventListener("change", function () { item.tarikh = tarikh.value; markDirty(); });

      var t = el("textarea", "borang-input");
      t.rows = 2; t.id = key + "tindakan"; t.placeholder = "Apa yang perlu dibuat"; t.value = item.tindakan;
      t.addEventListener("input", function () { item.tindakan = t.value; markDirty(); });

      var late = el("span", "mom-late", "Lewat");
      function syncLate() { late.hidden = !isLate(item); }
      var due = el("input", "borang-input");
      due.type = "date"; due.id = key + "due"; due.value = item.due;
      due.addEventListener("change", function () { item.due = due.value; syncLate(); markDirty(); });
      // Masa Due in 24-hour time: two lists (jam 00–23, minit 00–59) instead of the browser's own time
      // picker, which shows AM/PM on many phones and computers.
      var masa = el("div", "mom-time");
      var hh = el("select", "borang-input"), mm = el("select", "borang-input");
      hh.id = key + "masa"; hh.setAttribute("aria-label", "Jam (24 jam)"); mm.setAttribute("aria-label", "Minit");
      hh.appendChild(new Option("Jam", "")); mm.appendChild(new Option("Min", ""));
      for (var h = 0; h < 24; h++) hh.appendChild(new Option(pad(h), pad(h)));
      for (var mi = 0; mi < 60; mi++) mm.appendChild(new Option(pad(mi), pad(mi)));
      if (item.masa) { hh.value = item.masa.slice(0, 2); mm.value = item.masa.slice(3, 5); }
      function syncMasa() {
        if (hh.value && !mm.value) mm.value = "00";
        item.masa = hh.value ? hh.value + ":" + mm.value : "";
        syncLate(); markDirty();
      }
      hh.addEventListener("change", syncMasa);
      mm.addEventListener("change", syncMasa);
      masa.appendChild(hh); masa.appendChild(el("span", "mom-time-sep", ":")); masa.appendChild(mm);
      syncLate();

      var unit = el("select", "borang-input");
      unit.id = key + "unit";
      unit.appendChild(new Option("Pilih unit", ""));
      state.units.forEach(function (u) { unit.appendChild(new Option(u.label, u.id)); });
      unit.value = item.unit;
      unit.addEventListener("change", function () { item.unit = unit.value; markDirty(); });

      var picOpts = state.pics.map(function (p) { return { id: p, label: p }; });
      item.pic.forEach(function (p) { if (state.pics.indexOf(p) < 0) picOpts.push({ id: p, label: p }); });
      var pic = multi("mom-pic-pick", picOpts, item.pic, "Pilih PIC", markDirty);
      var rem = remPicker(item.reminder, markDirty);

      var del = button("mom-del", "×", function () {
        state.items.splice(state.items.indexOf(item), 1);
        markDirty(); drawList();
      });
      del.setAttribute("aria-label", "Buang item " + (i + 1));

      var fDue = field("mom-due", "Tarikh Due", due);
      fDue.appendChild(late);
      var fRem = field("mom-rem", "Reminder", rem);
      var done = item.reminder.filter(function (x) { return item.sent.indexOf(x) >= 0; });
      if (done.length) fRem.appendChild(el("span", "mom-sent", "✓ Dihantar: " + done.map(function (x) { return remLabel(x, true); }).join(", ")));

      row.appendChild(field("mom-tarikh", "Tarikh MOM", tarikh));
      row.appendChild(field("mom-tindakan", "Tindakan", t));
      row.appendChild(fDue);
      var fMasa = field("mom-masa", "Masa Due (24 jam)", masa);
      fMasa.querySelector("label").htmlFor = hh.id;
      row.appendChild(fMasa);
      row.appendChild(field("mom-unit", "Unit", unit));
      row.appendChild(field("mom-pic", "PIC", pic));
      row.appendChild(fRem);
      row.appendChild(del);
      return row;
    }

    function drawList(focusLast) {
      list.textContent = "";
      state.items.forEach(function (item, i) { list.appendChild(rowEl(item, i)); });
      if (!state.items.length) list.appendChild(el("p", "lg-empty", "Belum ada item MOM. Tekan \"+ Tambah item\"."));
      paintCount();
      if (focusLast) {
        var last = list.lastElementChild && list.lastElementChild.querySelector("textarea");
        if (last) { last.scrollIntoView({ behavior: "smooth", block: "center" }); last.focus({ preventScroll: true }); }
      }
    }

    tools.appendChild(button("lg-add-btn", "+ Tambah item", function () {
      var prev = state.items[state.items.length - 1];
      state.items.push(copy({ tarikh: prev ? prev.tarikh : today() }));
      markDirty(); drawList(true);
    }));
    drawList();

    var status = el("p", "borang-error-summary");
    status.hidden = true;
    function problem() {
      var items = clean(state.items);
      for (var i = 0; i < items.length; i++) {
        var it = items[i], n = "Item " + (i + 1) + ": ";
        if (!it.tindakan) return n + "Tindakan perlu diisi.";
        if (it.masa && !it.due) return n + "isi Tarikh Due untuk Masa Due itu.";
        if (it.reminder.length && !(it.due && it.masa)) return n + "reminder perlu Tarikh Due dan Masa Due.";
      }
      return "";
    }
    var save = button("borang-submit lg-btn-sm", "Simpan MOM", function () {
      if (!state.dirty) { toast("Tiada perubahan untuk disimpan."); return; }
      var bad = problem();
      if (bad) { status.hidden = false; status.textContent = bad; return; }
      status.hidden = true;
      save.disabled = true; save.textContent = "Menyimpan…";
      Api.post({ action: "saveMom", items: clean(state.items), old: clean(state.orig) })
        .then(function (d) {
          take(d.mom);
          draw();
          toast("MOM disimpan. Menghantar ke Telegram…", "ok");
          return sendTelegram().then(function (r) {
            if (r.ok && r.dryRun) toast("MOM disimpan. (Ujian: " + (r.preview || []).length + " mesej tidak dihantar.)", "ok");
            else if (r.ok) toast(r.sent ? "MOM disimpan dan " + r.sent + " mesej dihantar ke Telegram." : "MOM disimpan.", "ok");
            else toast("MOM disimpan, tetapi Telegram gagal (" + (r.error || "ralat") + "). Bot akan cuba lagi dalam seminit.", "warn");
            return Api.get({ action: "mom" }).then(function (fresh) { if (!state.dirty) { take(fresh); draw(); } });
          });
        })
        .catch(function (e) {
          if (e.kod) return fail(e);
          status.hidden = false;
          status.textContent = "Belum disimpan: " + (e.message || e);
          save.disabled = false; save.textContent = "Simpan MOM";
        });
    });
    var actions = el("div", "lg-actions");
    actions.appendChild(status);
    actions.appendChild(save);
    card.appendChild(actions);
    root.appendChild(card);
  }

  if (window.YoshGate) window.YoshGate.ready(load); else load();
})();
