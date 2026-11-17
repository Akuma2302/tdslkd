// Unit Legality dashboard (admin): compiles every cawangan's Checklist Legality sheet —
// schools, CRM people, CRM phases and the six Progress Legality steps — through the
// Legality API (src/services/legalityApi.js). Uses the same access code as the user portal (index.html).
(function () {
  "use strict";

  var Api = window.LegalityApi;
  var API = Api.configured;
  var ALL = "*";
  var state = { data: null, loading: false, error: "", needKod: false,
                programs: null, progLoading: false, progError: "", sheetUrl: "" };
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

  // The last summary is kept on this device and shown at once; the server copy (cached, refreshed in the
  // background after any save) replaces it as soon as it arrives.
  var SAVED = "lgd-summary";
  function load(fresh, quiet) {
    if (!API) return;
    if (!getKod()) { state.needKod = true; changed(); return; }
    if (!state.data) { try { var s = JSON.parse(localStorage.getItem(SAVED)); if (s && s.cawangan) state.data = s; } catch (e) {} }
    state.loading = true; state.error = ""; state.needKod = false;
    if (!quiet) changed();
    var params = { action: "summary" };
    if (fresh) params.fresh = "1";
    Api.get(params)
      .then(function (d) {
        state.data = d;
        try { localStorage.setItem(SAVED, JSON.stringify(d)); } catch (e) {}
        // Someone saved since this copy was made: fetch an up-to-date one without blocking the page.
        if (d.stale && !fresh) setTimeout(function () { load(true, true); }, 0);
      })
      .catch(function (e) {
        if (e.kod) { state.needKod = true; state.error = "Kod akses tidak sah."; return; }
        state.error = e.message || String(e);
      })
      .then(function () { state.loading = false; changed(); });
    if (!quiet) { loadPrograms(); loadKronologi(); }
  }

  // Kronologi: every Progress semasa a PIC has saved, with its date and time (admin only).
  var kron = { entries: null, loading: false, error: "", q: "", school: "" };
  function loadKronologi() {
    if (!API || !getKod()) return;
    kron.loading = true; kron.error = "";
    Api.get({ action: "kronologi" })
      .then(function (d) { kron.entries = d.entries || []; })
      .catch(function (e) { kron.error = e.message || String(e); })
      .then(function () { kron.loading = false; changed(); });
  }

  // Programmes sent from the Program page (program.html), kept in their own Google Sheet.
  function loadPrograms() {
    if (!API || !getKod()) return;
    state.progLoading = true; state.progError = "";
    Api.get({ action: "programs" })
      .then(function (d) { state.programs = d.programs || []; state.sheetUrl = d.sheetUrl || ""; })
      .catch(function (e) { state.progError = e.message || String(e); })
      .then(function () { state.progLoading = false; changed(); });
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
    a.href = new URL("/legality/database" + (branch && branch !== ALL ? "#/" + encodeURIComponent(branch) : ""), location.href).href;
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

  // ---------- Sub-tabs ----------
  // Ringkasan · Perlu Tindakan · Sekolah · Program · Kronologi. The choice is kept on this device and in the
  // link (#legality/program), so a sub-tab can be opened directly.
  var SUBS = [
    { id: "ringkasan", label: "Ringkasan" }, { id: "tindakan", label: "Perlu Tindakan" },
    { id: "sekolah", label: "Sekolah" }, { id: "crm", label: "CRM" }, { id: "program", label: "Program" }, { id: "kronologi", label: "Kronologi" }
  ];
  var SUB_KEY = "lgd-sub";
  function validSub(id) { return SUBS.some(function (s) { return s.id === id; }); }
  function currentSub() {
    var h = location.hash.slice(1).split("/");
    if (h[0] === "legality" && validSub(h[1])) return h[1];
    var saved = store(SUB_KEY);
    return validSub(saved) ? saved : "ringkasan";
  }
  function setSub(id) {
    store(SUB_KEY, id);
    if (location.hash.slice(1).split("/")[0] === "legality") history.replaceState(null, "", "#legality/" + id);
  }

  function subBadges(rows, branch) {
    var progs = (state.programs || []).filter(function (p) { return branch === ALL || p.cawangan === branch; });
    var now = today();
    var weekAgo = Date.now() - 7 * 86400000;
    return {
      tindakan: { n: actionItems(rows, branch).length, cls: "is-bad" },
      sekolah: { n: rows.length },
      crm: { n: sum(rows.map(function (x) { return x.s.people || 0; })), title: "orang CRM" },
      program: { n: progs.filter(function (p) { return progStatus(p, now) === "akan"; }).length, cls: "is-acc", title: "akan datang" },
      kronologi: { n: (kron.entries || []).filter(function (e) {
        return (branch === ALL || e.cawangan === branch) && Date.parse(e.dicatat || e.masa) >= weekAgo;
      }).length, cls: "is-acc", title: "baru minggu ini" }
    };
  }
  function badgeEl(bd) {
    if (!bd || !bd.n) return null;
    var c = el("span", "lgd-subtab-n " + (bd.cls || ""), String(bd.n));
    if (bd.title) c.title = bd.n + " " + bd.title;
    return c;
  }

  // In-page sub-tab row (phones; on wide screens the same choices are in the sidebar).
  function subTabs(sub, rows, branch, redraw) {
    var nav = el("div", "lgd-subtabs");
    nav.setAttribute("role", "tablist");
    nav.setAttribute("aria-label", "Bahagian Legality");
    var badge = subBadges(rows, branch);
    SUBS.forEach(function (s) {
      var b = el("button", "lgd-subtab");
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", s.id === sub ? "true" : "false");
      b.appendChild(el("span", null, s.label));
      var c = badgeEl(badge[s.id]);
      if (c) b.appendChild(c);
      b.addEventListener("click", function () {
        if (s.id === sub) return;
        setSub(s.id);
        redraw();
        drawSide();
        var top = nav.getBoundingClientRect().top;
        if (top < 0) nav.scrollIntoView({ block: "start" });
      });
      nav.appendChild(b);
    });
    // keep the chosen one visible when the row scrolls sideways (phones)
    setTimeout(function () {
      var on = nav.querySelector('[aria-selected="true"]');
      if (!on || nav.scrollWidth <= nav.clientWidth) return;
      var left = on.offsetLeft, right = left + on.offsetWidth;   // nav is position: relative, so offsets are inside it
      if (right > nav.scrollLeft + nav.clientWidth) nav.scrollLeft = right - nav.clientWidth + 8;
      else if (left < nav.scrollLeft) nav.scrollLeft = left - 8;
    }, 0);
    return nav;
  }

  // ---------- Sidebar (wide screens) ----------
  // Under the unit list: "Cawangan" picker (like a branch switcher) and the "Legality" sub-tabs with icons and badges.
  var SUB_ICONS = {
    ringkasan: "M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z",
    tindakan: "M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0",
    sekolah: "M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M12 10h.01",
    crm: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    program: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2",
    kronologi: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2"
  };
  var sideHost = null;
  function currentBranch() {
    var b = store("legalityBranch");
    return b && state.data && state.data.cawangan.some(function (c) { return c.id === b; }) ? b : ALL;
  }
  function drawSide() {
    if (!sideHost || sideHost.dataset.unit !== "legality") return;
    sideHost.textContent = "";
    if (!state.data) return;
    var branch = currentBranch();
    sideHost.appendChild(branchPicker(branch));

    var sub = currentSub();
    var badge = subBadges(schoolsFor(branch), branch);
    SUBS.forEach(function (s) {
      var b = el("button", "tab-child");
      b.type = "button";
      b.dataset.sub = s.id;
      if (s.id === sub) b.setAttribute("aria-current", "page");
      if (window.SIDE_ICON) b.appendChild(window.SIDE_ICON(SUB_ICONS[s.id]));
      b.appendChild(el("span", "tab-name", s.label));
      var c = badgeEl(badge[s.id]);
      if (c) b.appendChild(c);
      b.addEventListener("click", function () {
        setSub(s.id);
        changed();
        window.scrollTo(0, 0);
      });
      sideHost.appendChild(b);
    });
  }
  function sidebar(host) { sideHost = host; drawSide(); }

  // Cawangan switcher in the sidebar: a button + dark list (the native <select> list is white on Windows).
  function branchPicker(branch) {
    var opts = [{ id: ALL, label: "Semua cawangan", n: schoolsFor(ALL).length }].concat(state.data.cawangan.map(function (c) {
      return { id: c.id, label: c.id, n: c.schools.length };
    }));
    var cur = opts.filter(function (o) { return o.id === branch; })[0] || opts[0];
    var box = el("div", "side-pick");
    var btn = el("button", "side-pick-btn");
    btn.type = "button";
    btn.setAttribute("aria-haspopup", "listbox");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Cawangan: " + cur.label);
    if (window.SIDE_ICON) btn.appendChild(window.SIDE_ICON("M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6M18 9a9 9 0 0 1-9 9"));
    btn.appendChild(el("span", "side-pick-label", cur.id === ALL ? "Semua" : cur.label));
    btn.title = "Cawangan: " + cur.label;
    btn.appendChild(el("span", "side-pick-chev"));
    box.appendChild(btn);

    var list = el("div", "side-pick-list");
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Cawangan");
    list.hidden = true;
    var items = opts.map(function (o) {
      var it = el("button", "side-pick-opt" + (o.id === cur.id ? " is-on" : ""));
      it.type = "button";
      it.setAttribute("role", "option");
      it.setAttribute("aria-selected", o.id === cur.id ? "true" : "false");
      it.appendChild(el("span", "side-pick-check", o.id === cur.id ? "✓" : ""));
      it.appendChild(el("span", "side-pick-name", o.label));
      var cnt = el("span", "side-pick-n" + (o.n ? "" : " is-zero"), o.n ? String(o.n) : "–");
      cnt.title = o.n ? o.n + " sekolah" : "Belum ada sekolah";
      it.appendChild(cnt);
      it.addEventListener("click", function () {
        close();
        if (o.id === cur.id) return;
        store("legalityBranch", o.id);
        changed();
      });
      list.appendChild(it);
      return it;
    });
    box.appendChild(list);

    function onDoc(e) { if (!box.contains(e.target)) close(); }
    function open() {
      list.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      box.classList.add("is-open");
      document.addEventListener("click", onDoc, true);
      (items.filter(function (x) { return x.classList.contains("is-on"); })[0] || items[0]).focus();
    }
    function close() {
      if (list.hidden) return;
      list.hidden = true;
      btn.setAttribute("aria-expanded", "false");
      box.classList.remove("is-open");
      document.removeEventListener("click", onDoc, true);
    }
    btn.addEventListener("click", function () { if (list.hidden) open(); else close(); });
    box.addEventListener("keydown", function (e) {
      var i = items.indexOf(document.activeElement);
      if (e.key === "Escape") { close(); btn.focus(); e.preventDefault(); }
      else if (e.key === "ArrowDown") { if (list.hidden) open(); else items[Math.min(items.length - 1, i + 1)].focus(); e.preventDefault(); }
      else if (e.key === "ArrowUp" && i > -1) { items[Math.max(0, i - 1)].focus(); e.preventDefault(); }
      else if (e.key === "Tab" && !list.hidden) close();
    });
    return box;
  }
  listeners.push(drawSide);

  // ---------- Perlu Tindakan ----------
  // Everything someone should follow up, from the school summaries and the programme list.
  function daysAgo(iso) { return Math.floor((Date.now() - Date.parse(iso)) / 86400000); }
  function actionItems(rows, branch) {
    var out = [];
    rows.forEach(function (x) {
      var s = x.s, note = s.note || {};
      var base = { cawangan: x.cawangan, sekolah: s.name };
      if (!note.text || !note.updated) out.push(Object.assign({ group: "progress", text: "Progress semasa belum pernah ditulis" }, base));
      else if (daysAgo(note.updated) >= STALE_DAYS) out.push(Object.assign({ group: "progress", text: "Progress semasa tidak dikemas kini " + daysAgo(note.updated) + " hari" }, base));
      if (s.planning !== undefined && !(s.planning || []).some(function (p) { return p.perkara; }))
        out.push(Object.assign({ group: "planning", text: "Planning Legality masih kosong" }, base));
      if (!(s.pic || []).some(function (p) { return p.username; }))
        out.push(Object.assign({ group: "pic", text: "PIC Legality belum ditetapkan" }, base));
      if (s.crm) {
        var fu = crmFollowUps(crmPeople([x]));
        if (fu.kelas.length) out.push(Object.assign({ group: "crm", crm: true, text: fu.kelas.length + " kelas tambahan dalam 7 hari akan datang" }, base));
        if (fu.nopic.length) out.push(Object.assign({ group: "crm", crm: true, text: fu.nopic.length + " orang CRM belum ada PIC CRM" }, base));
      }
    });
    var now = today();
    (state.programs || []).forEach(function (p) {
      if (branch !== ALL && p.cawangan !== branch) return;
      var st = progStatus(p, now), rg = repGroup(p);
      var base = { cawangan: p.cawangan, sekolah: p.sekolah, program: p };
      if (st === "selesai" && rg === "semak") out.push(Object.assign({ group: "report", text: "\"" + p.nama + "\": reporting menunggu kelulusan" }, base));
      else if (st === "selesai" && (rg === "tiada" || rg === "proses")) {
        var n = dayDiff(p.tamat || p.mula, now);
        out.push(Object.assign({ group: "report", text: "\"" + p.nama + "\": reporting belum siap · " + n + " hari selepas program" }, base));
      }
      if ((st === "akan" || st === "hari") && /^\d{4}-\d{2}-\d{2}$/.test(p.mula || "") && dayDiff(now, p.mula) <= 7)
        out.push(Object.assign({ group: "soon", text: "\"" + p.nama + "\": " + (st === "hari" ? "sedang berjalan" : dayDiff(now, p.mula) === 0 ? "hari ini" : dayDiff(now, p.mula) === 1 ? "esok" : dayDiff(now, p.mula) + " hari lagi") }, base));
    });
    return out;
  }
  var ACTION_GROUPS = [
    { id: "progress", label: "Progress semasa", hint: "" },   // hint built when drawn (STALE_DAYS is set further down)
    { id: "report", label: "Reporting program", hint: "Selepas program selesai" },
    { id: "planning", label: "Planning Legality", hint: "Tiada perkara dirancang" },
    { id: "pic", label: "PIC Legality", hint: "Bot tidak dapat tag sesiapa" },
    { id: "crm", label: "CRM", hint: "Kelas tambahan minggu ini · tanpa PIC CRM" },
    { id: "soon", label: "Program 7 hari akan datang", hint: "Untuk makluman" }
  ];
  function actionWidget(rows, branch) {
    var items = actionItems(rows, branch);
    var w = widget("w-4 lgd-act", "Perlu Tindakan", items.length ? items.length + " perkara" : "");
    if (!items.length) { w.appendChild(el("p", "lgd-act-clear", "✓ Tiada tindakan tertunggak. Semua sekolah terkini.")); return w; }
    if (!state.programs) w.appendChild(el("p", "empty-text", state.progLoading ? "Memuatkan program… (reporting akan ditambah)" : ""));
    ACTION_GROUPS.forEach(function (g) {
      var list = items.filter(function (it) { return it.group === g.id; });
      if (!list.length) return;
      var box = el("section", "lgd-act-group is-" + g.id);
      var h = el("h3", "lgd-act-h");
      h.appendChild(el("span", null, g.label));
      h.appendChild(el("span", "lgd-act-n", String(list.length)));
      h.appendChild(el("small", null, g.id === "progress" ? "Lebih " + STALE_DAYS + " hari tanpa kemas kini" : g.hint));
      box.appendChild(h);
      list.forEach(function (it) {
        var row = el("div", "lgd-act-row");
        var who = el("span", "lgd-act-school", it.sekolah);
        if (branch === ALL) who.appendChild(el("small", null, it.cawangan));
        row.appendChild(who);
        row.appendChild(el("span", "lgd-act-text", it.text));
        if (it.crm) {
          var cb = el("button", "lgd-act-go", "Lihat CRM");
          cb.type = "button";
          cb.addEventListener("click", function () {
            crmF = { q: it.sekolah, phase: "", kat: "", level: "", aktif: "" };
            setSub("crm");
            changed();
          });
          row.appendChild(cb);
        } else if (it.program) {
          var b = el("button", "lgd-act-go", "Lihat program");
          b.type = "button";
          b.addEventListener("click", function () {
            state.progFilter = { q: it.program.nama, status: "", rep: "", month: "" };
            setSub("program");
            changed();
          });
          row.appendChild(b);
        } else {
          var a = el("a", "lgd-act-go", "Buka ↗");
          a.href = "/legality/database#/" + encodeURIComponent(it.cawangan) + "/" + encodeURIComponent(it.sekolah);
          a.target = "_blank"; a.rel = "noopener";
          a.title = "Buka halaman sekolah " + it.sekolah;
          row.appendChild(a);
        }
        box.appendChild(row);
      });
      w.appendChild(box);
    });
    return w;
  }

  // ---------- CRM ----------
  // Every CRM person of the schools in view, from the summary (compact rows, see summary() in Legality.gs).
  function crmPeople(rows) {
    var out = [];
    rows.forEach(function (x) {
      (x.s.crm || []).forEach(function (r) {
        out.push({ cawangan: x.cawangan, sekolah: x.s.name, entiti: r[0], nama: r[1], tel: r[2], pic: r[3], ada: r[4] === 1,
                   kat: r[5], phase: r[6], level: r[7], tarikh: r[8], nota: r[9], video: r[10], checks: r[11] || "", perm: r[12] || "" });
      });
    });
    return out;
  }
  function crmHead(branch) {
    var c = state.data.cawangan.filter(function (c) { return (branch === ALL || c.id === branch) && c.crmHead; })[0];
    return (c && c.crmHead) || { kpi: [], checks: [] };
  }
  function done(bits) { return (bits.match(/1/g) || []).length; }
  function waLink(tel) {
    var d = String(tel || "").replace(/\D/g, "");
    if (d.length < 9) return "";
    if (d.charAt(0) === "0") d = "6" + d;
    return "https://wa.me/" + d;
  }
  function isEarlyPhase(ph) { return /^P\s*[01]\b/i.test(ph || ""); }
  function crmFollowUps(list) {
    var now = today();
    return {
      kelas: list.filter(function (p) { return /^\d{4}-\d{2}-\d{2}$/.test(p.tarikh) && p.tarikh >= now && dayDiff(now, p.tarikh) <= 7; }),
      nopic: list.filter(function (p) { return !p.pic; }),
      awal: list.filter(function (p) { return !p.phase || isEarlyPhase(p.phase); }),
      video: list.filter(function (p) { return p.ada && !p.video; })
    };
  }
  function countBy(list, key) {
    var o = {};
    list.forEach(function (p) { var k = p[key] || "Belum ditetapkan"; o[k] = (o[k] || 0) + 1; });
    return o;
  }
  function barsOf(obj, total) {
    var box = el("div", "hbars");
    var keys = Object.keys(obj).sort(function (a, b) {
      if (a === "Belum ditetapkan") return 1;
      if (b === "Belum ditetapkan") return -1;
      return a < b ? -1 : a > b ? 1 : 0;
    });
    keys.forEach(function (k) { box.appendChild(hbar(k, obj[k], total, pct(obj[k], total) + "%")); });
    if (!keys.length) box.appendChild(el("p", "empty-text", "Belum ada orang CRM."));
    return box;
  }
  function schoolLink(cawangan, sekolah, text) {
    var a = el("a", "lgd-crm-school", text || sekolah);
    a.href = "/legality/database#/" + encodeURIComponent(cawangan) + "/" + encodeURIComponent(sekolah);
    a.target = "_blank"; a.rel = "noopener";
    a.title = "Buka halaman sekolah " + sekolah;
    return a;
  }

  var crmF = { q: "", phase: "", kat: "", level: "", aktif: "" };
  function crmTab(grid, rows, branch) {
    var list = crmPeople(rows);
    var n = list.length, aktif = list.filter(function (p) { return p.ada; }).length;
    var noCrm = rows.filter(function (x) { return !x.s.people; }).length;
    var head = crmHead(branch);
    var nChecks = head.checks.length || 17;

    // 1. Kad ringkasan
    grid.appendChild(stat("Orang CRM", String(n), rows.length + " sekolah", true));
    grid.appendChild(stat("CRM aktif", aktif + " · " + pct(aktif, n) + "%", "Ditanda Ada"));
    grid.appendChild(stat("Sekolah tanpa CRM", String(noCrm), noCrm ? "Belum ada seorang pun" : "Semua sekolah ada CRM"));
    grid.appendChild(stat("Purata", rows.length ? (Math.round(n / rows.length * 10) / 10).toString() : "0", "orang setiap sekolah"));

    // 2. Phase CRM  3. Kategori & Level
    var ph = widget("w-2", "Phase CRM", n + " orang");
    ph.appendChild(barsOf(countBy(list, "phase"), n));
    grid.appendChild(ph);
    var kl = widget("w-2", head.kpi[0] || "Kategori Cikgu", "");
    kl.appendChild(barsOf(countBy(list, "kat"), n));
    kl.appendChild(el("h3", "lgd-crm-sub", head.kpi[2] || "Level CRM"));
    kl.appendChild(barsOf(countBy(list, "level"), n));
    grid.appendChild(kl);

    // 4. CRM mengikut sekolah
    var sw = widget("w-4", "CRM mengikut sekolah", rows.length + " sekolah");
    var wrap = el("div", "tbl-wrap");
    var t = el("table", "mtable lgd-crm-table");
    var hr = el("tr");
    [["Sekolah"], ["Orang", "num"], ["Aktif", "num"], ["Phase paling ramai"], ["Checklist hubungan", "num"]].forEach(function (h) { hr.appendChild(el("th", h[1] || null, h[0])); });
    var th = el("thead"); th.appendChild(hr); t.appendChild(th);
    var tb = el("tbody");
    rows.slice().sort(function (a, b) { return b.s.people - a.s.people || (a.s.name < b.s.name ? -1 : 1); }).forEach(function (x) {
      var r = el("tr");
      var c0 = el("td");
      c0.appendChild(schoolLink(x.cawangan, x.s.name));
      if (branch === ALL) c0.appendChild(el("small", null, x.cawangan));
      r.appendChild(c0);
      r.appendChild(el("td", "num" + (x.s.people ? "" : " muted"), String(x.s.people)));
      r.appendChild(el("td", "num" + (x.s.aktif ? "" : " muted"), String(x.s.aktif)));
      var top = Object.keys(x.s.phase || {}).sort(function (a, b) { return x.s.phase[b] - x.s.phase[a]; })[0];
      r.appendChild(el("td", top ? null : "muted", top ? top + " (" + x.s.phase[top] + ")" : "—"));
      var max = x.s.people * nChecks;
      var cell = el("td", "num");
      if (max) {
        var p = pct(x.s.checks, max);
        var bar = el("span", "lgd-crm-meter");
        bar.appendChild(el("i")).style.width = p + "%";
        cell.appendChild(bar);
        cell.appendChild(el("span", "lgd-crm-pct", p + "%"));
      } else cell.appendChild(el("span", "muted", "—"));
      r.appendChild(cell);
      tb.appendChild(r);
    });
    t.appendChild(tb); wrap.appendChild(t); sw.appendChild(wrap);
    grid.appendChild(sw);

    // 6. Perlu follow-up CRM
    grid.appendChild(crmFollowWidget(list, branch));

    // 5. Direktori CRM
    grid.appendChild(crmDirectory(list, branch, head));
  }

  function personLine(p, branch, extra) {
    var row = el("div", "lgd-crm-fu-row");
    var who = el("span", "lgd-crm-fu-who", p.nama || "(tiada nama)");
    who.appendChild(el("small", null, (p.entiti ? p.entiti + " · " : "") + p.sekolah + (branch === ALL ? " · " + p.cawangan : "")));
    row.appendChild(who);
    if (extra) row.appendChild(el("span", "lgd-crm-fu-extra", extra));
    var wa = waLink(p.tel);
    if (wa) { var a = el("a", "lgd-act-go", "WhatsApp"); a.href = wa; a.target = "_blank"; a.rel = "noopener"; row.appendChild(a); }
    return row;
  }
  function crmFollowWidget(list, branch) {
    var fu = crmFollowUps(list);
    var w = widget("w-4 lgd-crm-fu", "Perlu follow-up CRM", "");
    var groups = [
      { key: "kelas", label: "Kelas tambahan 7 hari akan datang", open: true, extra: function (p) { return "📅 " + fmtDate(p.tarikh); } },
      { key: "nopic", label: "Belum ada PIC CRM" },
      { key: "awal", label: "Masih P0 / P1 atau phase belum ditetapkan", extra: function (p) { return p.phase || "—"; } },
      { key: "video", label: "Aktif tetapi video feedback belum dikumpul" }
    ];
    var any = false;
    groups.forEach(function (g) {
      var items = fu[g.key];
      if (!items.length) return;
      any = true;
      var d = el("details", "lgd-crm-fu-group");
      if (g.open) d.open = true;
      var s = el("summary", null);
      s.appendChild(el("span", null, g.label));
      s.appendChild(el("span", "lgd-act-n", String(items.length)));
      d.appendChild(s);
      items.slice(0, 100).forEach(function (p) { d.appendChild(personLine(p, branch, g.extra ? g.extra(p) : "")); });
      if (items.length > 100) d.appendChild(el("p", "empty-text", "+" + (items.length - 100) + " lagi — guna Direktori CRM di bawah."));
      w.appendChild(d);
    });
    if (!any) w.appendChild(el("p", "lgd-act-clear", "✓ Tiada follow-up CRM tertunggak."));
    return w;
  }

  function crmDirectory(list, branch, head) {
    var w = widget("w-4 lgd-crm-dir", "Direktori CRM", "");
    var tools = el("div", "lgd-prog-tools");
    var search = el("input", "borang-input lgd-prog-search");
    search.type = "search"; search.placeholder = "Cari nama, sekolah, entiti atau PIC"; search.value = crmF.q;
    search.setAttribute("aria-label", "Cari dalam direktori CRM");
    tools.appendChild(search);
    function filterSelect(key, label, values) {
      var s = el("select", "borang-input lgd-prog-filter");
      s.setAttribute("aria-label", label);
      [["", label]].concat(values.map(function (v) { return [v, v]; })).forEach(function (o) {
        var op = el("option", null, o[1]); op.value = o[0]; s.appendChild(op);
      });
      s.value = crmF[key];
      s.addEventListener("change", function () { crmF[key] = s.value; draw(); });
      tools.appendChild(s);
    }
    function uniq(key) { var o = {}; list.forEach(function (p) { if (p[key]) o[p[key]] = 1; }); return Object.keys(o).sort(); }
    filterSelect("phase", "Semua phase", uniq("phase"));
    filterSelect("kat", "Semua kategori", uniq("kat"));
    filterSelect("level", "Semua level", uniq("level"));
    var ak = el("select", "borang-input lgd-prog-filter");
    ak.setAttribute("aria-label", "Aktif");
    [["", "Aktif & tidak"], ["1", "Aktif sahaja"], ["0", "Tidak aktif"]].forEach(function (o) { var op = el("option", null, o[1]); op.value = o[0]; ak.appendChild(op); });
    ak.value = crmF.aktif;
    ak.addEventListener("change", function () { crmF.aktif = ak.value; draw(); });
    tools.appendChild(ak);
    var count = el("span", "lgd-prog-count");
    tools.appendChild(count);
    w.appendChild(tools);
    var box = el("div", "lgd-crm-list");
    w.appendChild(box);
    var nChecks = head.checks.length || 17, LIMIT = 50, shown = LIMIT;

    function card(p) {
      var d = el("details", "lgd-crm-person");
      var s = el("summary");
      var who = el("span", "lgd-crm-who");
      who.appendChild(el("strong", null, p.nama || "(tiada nama)"));
      who.appendChild(el("small", null, (p.entiti ? p.entiti + " · " : "") + p.sekolah + (branch === ALL ? " · " + p.cawangan : "")));
      s.appendChild(who);
      var tags = el("span", "lgd-crm-tags");
      tags.appendChild(el("span", "lgd-crm-tag " + (p.ada ? "is-on" : "is-off"), p.ada ? "Aktif" : "Tidak aktif"));
      if (p.phase) tags.appendChild(el("span", "lgd-crm-tag" + (isEarlyPhase(p.phase) ? " is-early" : ""), p.phase.split(":")[0]));
      var k = done(p.checks);
      tags.appendChild(el("span", "lgd-crm-tag is-check", k + "/" + nChecks));
      s.appendChild(tags);
      d.appendChild(s);

      var body = el("div", "lgd-crm-body");
      var dl = el("dl", "lgd-crm-dl");
      function row(label, value) { if (!value) return; dl.appendChild(el("dt", null, label)); dl.appendChild(el("dd", null, value)); }
      row("Telefon", p.tel);
      row("PIC CRM", p.pic);
      row(head.kpi[0] || "Kategori Cikgu", p.kat);
      row(head.kpi[1] || "Phase", p.phase);
      row(head.kpi[2] || "Level CRM", p.level);
      row(head.kpi[3] || "Plan Tarikh Kelas Tambahan", /^\d{4}-\d{2}-\d{2}$/.test(p.tarikh) ? fmtDate(p.tarikh) : p.tarikh);
      row(head.kpi[4] || "Nota", p.nota);
      row(head.kpi[5] || "Collect Video Feedback", p.video);
      row("Permanfaatan", p.perm);
      body.appendChild(dl);
      if (head.checks.length) {
        var cl = el("ul", "lgd-crm-checks");
        head.checks.forEach(function (label, i) {
          var on = p.checks.charAt(i) === "1";
          cl.appendChild(el("li", on ? "is-on" : null, (on ? "✓ " : "○ ") + (label || "Langkah " + (i + 1))));
        });
        body.appendChild(cl);
      }
      var acts = el("div", "lgd-crm-acts");
      var wa = waLink(p.tel);
      if (wa) { var a = el("a", "lgd-act-go", "WhatsApp"); a.href = wa; a.target = "_blank"; a.rel = "noopener"; acts.appendChild(a); }
      acts.appendChild(schoolLink(p.cawangan, p.sekolah, "Buka halaman sekolah ↗"));
      body.appendChild(acts);
      d.appendChild(body);
      return d;
    }

    function draw() {
      box.textContent = "";
      var q = crmF.q.trim().toLowerCase();
      var rows = list.filter(function (p) {
        if (crmF.phase && p.phase !== crmF.phase) return false;
        if (crmF.kat && p.kat !== crmF.kat) return false;
        if (crmF.level && p.level !== crmF.level) return false;
        if (crmF.aktif && String(p.ada ? 1 : 0) !== crmF.aktif) return false;
        return !q || [p.nama, p.sekolah, p.entiti, p.pic, p.cawangan].join(" ").toLowerCase().indexOf(q) > -1;
      }).sort(function (a, b) { return (a.sekolah + a.nama).localeCompare(b.sekolah + b.nama); });
      count.textContent = rows.length + " orang";
      rows.slice(0, shown).forEach(function (p) { box.appendChild(card(p)); });
      if (!rows.length) box.appendChild(el("p", "empty-text", list.length ? "Tiada orang sepadan." : "Belum ada orang CRM."));
      if (rows.length > shown) {
        var more = el("button", "link-btn lgd-kron-more", "Tunjuk lagi (" + (rows.length - shown) + ")");
        more.type = "button";
        more.addEventListener("click", function () { shown += LIMIT; draw(); });
        box.appendChild(more);
      }
    }
    search.addEventListener("input", function () { crmF.q = search.value; shown = LIMIT; draw(); });
    draw();
    return w;
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

    var sub = currentSub();
    body.appendChild(subTabs(sub, rows, branch, function () { view(body, branch); }));
    var grid = el("div", "dash-grid");
    body.appendChild(grid);
    if (sub === "tindakan") { grid.appendChild(actionWidget(rows, branch)); return; }
    if (sub === "program") { grid.appendChild(programWidget(branch)); return; }
    if (sub === "kronologi") { grid.appendChild(kronologiWidget(branch)); return; }
    if (sub === "sekolah") { schoolTab(grid, rows, branch, items); return; }
    if (sub === "crm") { crmTab(grid, rows, branch); return; }

    // Ringkasan
    grid.appendChild(stat("Sekolah", String(n), branch === ALL ? "Dalam " + d.cawangan.filter(function (c) { return c.schools.length; }).length + " cawangan" : "Cawangan " + branch, true));
    grid.appendChild(stat("Orang CRM", String(people), aktif + " ditanda Ada (CRM aktif)"));
    grid.appendChild(stat("Set Meeting", stepCount[0] + "/" + n, pct(stepCount[0], n) + "% sekolah sudah set tarikh meeting"));
    grid.appendChild(stat("Tarikh Mentoring", stepCount[3] + "/" + n, pct(stepCount[3], n) + "% sekolah sudah dapat tarikh program"));

    // Steps funnel
    var steps = widget("w-4 lgd-steps", "Progress mengikut langkah", "bilangan sekolah");
    var bars = el("div", "hbars");
    items.forEach(function (it, i) { bars.appendChild(hbar((i + 1) + ". " + it.short, stepCount[i], n, pct(stepCount[i], n) + "%")); });
    steps.appendChild(bars);
    grid.appendChild(steps);

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
  }

  // Sub-tab Sekolah: Checklist Legality Semasa (the 6 steps of each school, green = done) + Progress dan Status.
  function schoolTab(grid, rows, branch, items) {
    var n = rows.length;
    var mw = widget("w-4", "Checklist Legality Semasa", n + " sekolah");
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
    grid.appendChild(progressWidget(rows, branch));
  }

  // Progress Legality Sekolah: Sekolah · PIC (opens their Telegram) · Progress semasa written on the school page.
  // Most recently updated first; schools without a note at the end. Shows how long ago it was updated;
  // 7+ days is flagged (bot PICO also reminds the PIC then).
  var STALE_DAYS = 7;
  function ago(isoStr) {
    var min = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
    if (min < 60) return "baru tadi";
    if (min < 1440) return Math.floor(min / 60) + " jam lepas";
    return Math.floor(min / 1440) + " hari lepas";
  }
  var LEGALITY_JENIS = ["A", "B", "C"];
  var LEGALITY_STATUS = ["Legal with B&W", "Legal w/o B&W", "Tidak Legal"];
  var refreshTimer = 0;
  function statusTone(v) { return v === "Legal with B&W" ? "is-ok" : v === "Legal w/o B&W" ? "is-mid" : v === "Tidak Legal" ? "is-no" : ""; }
  function legalitySelects(x, jenisTd, statusTd) {
    var info = x.s.note = x.s.note || { text: "", updated: "" };
    function make(choices, value, label, cls) {
      var s = el("select", "lgd-sel " + cls);
      s.setAttribute("aria-label", label + " " + x.s.name);
      s.appendChild(new Option("—", ""));
      choices.forEach(function (c) { s.appendChild(new Option(c, c)); });
      s.value = value || "";
      return s;
    }
    var j = make(LEGALITY_JENIS, info.jenis, "Jenis Legality", "is-jenis");
    var st = make(LEGALITY_STATUS, info.status, "Status Legality", "is-status " + statusTone(info.status));
    var msg = el("small", "lgd-sel-msg");
    function save() {
      var prev = { jenis: info.jenis || "", status: info.status || "" };
      j.disabled = st.disabled = true;
      msg.textContent = "Menyimpan…"; msg.className = "lgd-sel-msg";
      Api.post({ action: "saveLegalityStatus", cawangan: x.cawangan, sekolah: x.s.name, jenis: j.value, status: st.value })
        .then(function (d) {
          info.jenis = d.note.jenis || ""; info.status = d.note.status || "";
          try { localStorage.setItem(SAVED, JSON.stringify(state.data)); } catch (e) {}
          msg.textContent = "✓ Disimpan"; msg.className = "lgd-sel-msg is-ok";
          // A summary fetched before this save may still arrive and show the old value; fetch a fresh one after it.
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(function () { load(true, true); }, 1500);
        })
        .catch(function (e) {
          j.value = prev.jenis; st.value = prev.status;
          msg.textContent = "Tidak disimpan: " + (e.message || e); msg.className = "lgd-sel-msg is-no";
        })
        .then(function () {
          j.disabled = st.disabled = false;
          st.className = "lgd-sel is-status " + statusTone(st.value);
        });
    }
    j.addEventListener("change", save);
    st.addEventListener("change", save);
    jenisTd.appendChild(j);
    statusTd.appendChild(st);
    statusTd.appendChild(msg);
  }

  // The last column of the progress table shows one thing at a time, picked from a dropdown in its header.
  var PROG_VIEWS = [
    { id: "progress", label: "Progress semasa" },
    { id: "analisa", label: "Analisa Situasi Semasa" },
    { id: "planning", label: "Planning Legality" },
    { id: "alumni", label: "Alumni Sekolah" }
  ];
  var VIEW_KEY = "lgd-prog-view";
  function progView() {
    if (!state.progView) { try { state.progView = localStorage.getItem(VIEW_KEY) || ""; } catch (e) {} }
    if (!PROG_VIEWS.some(function (v) { return v.id === state.progView; })) state.progView = "progress";
    return state.progView;
  }
  function viewSelect(cls) {
    var s = el("select", "borang-input lgd-view-select " + (cls || ""));
    s.setAttribute("aria-label", "Paparan lajur");
    PROG_VIEWS.forEach(function (v) {
      var o = el("option", null, v.label); o.value = v.id;
      if (v.id === progView()) o.selected = true;
      s.appendChild(o);
    });
    s.addEventListener("change", function () {
      state.progView = s.value;
      try { localStorage.setItem(VIEW_KEY, s.value); } catch (e) {}
      changed();
    });
    return s;
  }

  function noteCell(td, note, now) {
    if (!note.text) { td.appendChild(el("span", "lgd-prog-empty is-missing", "Belum ada catatan")); return; }
    td.appendChild(el("p", "lgd-prog-text", note.text));
    if (!note.updated) return;
    var days = Math.floor((now - new Date(note.updated).getTime()) / 86400000);
    var when = el("small", "lgd-prog-when" + (days >= STALE_DAYS ? " is-stale" : ""),
      (days >= STALE_DAYS ? "⚠️ " : "") + "Dikemas kini " + ago(note.updated));
    when.title = new Date(note.updated).toLocaleString("ms-MY", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
    td.appendChild(when);
  }

  function viewCell(td, s, view, now) {
    if (view === "progress") return noteCell(td, s.note || {}, now);
    if (s.analisa === undefined) { td.appendChild(el("span", "lgd-prog-empty", "Belum dimuat — muat semula data.")); return; }
    if (view === "analisa") {
      td.appendChild(s.analisa ? el("p", "lgd-prog-text", s.analisa) : el("span", "lgd-prog-empty is-missing", "Belum diisi"));
    } else if (view === "planning") {
      // [{ perkara, tarikh }]; a summary from before the change has { label, value } and no perkara
      var plan = (s.planning || []).filter(function (p) { return p.perkara !== undefined; });
      if (!plan.length) { td.appendChild(el("span", "lgd-prog-empty is-missing", "Belum ada perkara dirancang")); return; }
      var list = el("ol", "lgd-plan-list");
      plan.forEach(function (p) {
        var li = el("li");
        li.appendChild(el("span", "lgd-plan-what" + (p.perkara ? "" : " lgd-prog-empty is-missing"), p.perkara || "Perkara belum ditulis"));
        li.appendChild(el("span", "lgd-plan-when" + (p.tarikh ? "" : " is-missing"), p.tarikh ? "📅 " + fmtDate(p.tarikh) : "Tarikh belum ditetapkan"));
        list.appendChild(li);
      });
      td.appendChild(list);
    } else {
      var people = parseAlumni(s.alumni);
      if (!people.length) { td.appendChild(el("span", "lgd-prog-empty", "Tiada alumni")); return; }
      var ul = el("ol", "lgd-alumni-list");
      people.forEach(function (a) {
        var li = el("li", null, a.nama || "—");
        if (a.tahun) li.appendChild(el("span", "lgd-alumni-spm", "SPM " + a.tahun));
        ul.appendChild(li);
      });
      td.appendChild(ul);
    }
  }

  // Same reading as the user form: "1. Adam Harith (SPM 2019)\n2. Wazif" -> [{ nama, tahun }]
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

  function progressWidget(rows, branch) {
    var w = widget("w-4", "Progress dan Status Legality Sekolah", rows.length + " sekolah");
    if (!rows.length) { w.appendChild(el("p", "empty-text", "Belum ada sekolah untuk paparan ini.")); return w; }
    var sorted = rows.slice().sort(function (a, b) {
      var ua = (a.s.note && a.s.note.text && a.s.note.updated) || "", ub = (b.s.note && b.s.note.text && b.s.note.updated) || "";
      return ub < ua ? -1 : ub > ua ? 1 : 0;
    });
    var view = progView();
    // On phones the table header is hidden, so the same dropdown sits above the list.
    var bar = el("div", "lgd-view-bar");
    bar.appendChild(el("span", null, "Paparan:"));
    bar.appendChild(viewSelect());
    w.appendChild(bar);
    var wrap = el("div", "tbl-wrap");
    var t = el("table", "mtable lgd-prog-table");
    var hr = el("tr");
    ["Sekolah", "Jenis Legality", "Status Legality", "PIC"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    var vth = el("th", "lgd-view-th");
    vth.appendChild(viewSelect());
    hr.appendChild(vth);
    var th = el("thead"); th.appendChild(hr); t.appendChild(th);
    var tb = el("tbody");
    var now = Date.now();
    sorted.forEach(function (x) {
      var r = el("tr");
      var school = el("td", "lgd-prog-school", x.s.name);
      if (branch === ALL) school.appendChild(el("small", null, x.cawangan));
      // Ada / tiada alumni (from the "Alumni Sekolah" part of the school tab)
      if (x.s.alumni !== undefined) {
        var nAlumni = parseAlumni(x.s.alumni).length;
        var al = el("span", "lgd-alumni " + (nAlumni ? "is-yes" : "is-no"), nAlumni ? "🎓 " + nAlumni + " alumni" : "Tiada alumni");
        if (nAlumni) al.title = x.s.alumni;
        school.appendChild(al);
      }
      r.appendChild(school);

      // Jenis Legality (A/B/C) and Status Legality: set here by admin only, saved as soon as they change
      var jenisTd = el("td", "lgd-prog-jenis");
      var statusTd = el("td", "lgd-prog-status");
      legalitySelects(x, jenisTd, statusTd);
      r.appendChild(jenisTd);
      r.appendChild(statusTd);

      var picTd = el("td", "lgd-prog-pic");
      var pics = x.s.pic || [];
      if (!pics.length) picTd.appendChild(el("span", "lgd-prog-empty", "Belum ada PIC"));
      pics.forEach(function (p) {
        if (p.username) {
          var a = el("a", "lgd-pic-link", "@" + p.username);
          a.href = "https://t.me/" + encodeURIComponent(p.username);
          a.target = "_blank"; a.rel = "noopener";
          a.title = (p.nama ? p.nama + " · " : "") + "Buka Telegram";
          picTd.appendChild(a);
        } else {
          picTd.appendChild(el("span", "lgd-pic-name", p.nama));
        }
      });
      r.appendChild(picTd);

      var noteTd = el("td", "lgd-prog-note");
      viewCell(noteTd, x.s, view, now);
      r.appendChild(noteTd);
      tb.appendChild(r);
    });
    t.appendChild(tb);
    wrap.appendChild(t);
    w.appendChild(wrap);
    return w;
  }

  function fmtDate(isoDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate || "")) return isoDate || "—";
    var p = isoDate.split("-");
    return new Date(+p[0], +p[1] - 1, +p[2]).toLocaleDateString("ms-MY", { day: "numeric", month: "short", year: "numeric" });
  }
  // "20–21 Nov 2026", "30 Nov – 2 Dis 2026", or one date
  function fmtRange(a, b) {
    if (!b || b === a) return fmtDate(a);
    var re = /^(\d{4})-(\d{2})-(\d{2})$/, x = re.exec(a || ""), y = re.exec(b || "");
    if (!x || !y) return fmtDate(a) + " – " + fmtDate(b);
    if (x[1] === y[1] && x[2] === y[2]) return +x[3] + "–" + fmtDate(b);
    if (x[1] === y[1]) return new Date(+x[1], +x[2] - 1, +x[3]).toLocaleDateString("ms-MY", { day: "numeric", month: "short" }) + " – " + fmtDate(b);
    return fmtDate(a) + " – " + fmtDate(b);
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  // Programme status from its dates (reporting "Dibatalkan" = the PIC said it did not run).
  var PROG_STATUS = [
    { id: "akan", label: "Akan datang" }, { id: "hari", label: "Sedang berjalan" },
    { id: "selesai", label: "Selesai" }, { id: "batal", label: "Dibatalkan" }
  ];
  function progStatus(p, now) {
    if ((p.reporting || {}).status === "Dibatalkan") return "batal";
    var a = p.mula || p.tamat || "", b = p.tamat || p.mula || "";
    if (a > now) return "akan";
    if (b >= now) return "hari";
    return "selesai";
  }
  function dayDiff(a, b) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
  // " · 5 hari lagi" / " · esok" — only for upcoming programmes
  function daysNote(p, st, now) {
    if (st !== "akan" || !/^\d{4}-\d{2}-\d{2}$/.test(p.mula || "")) return "";
    var n = dayDiff(now, p.mula);
    return n === 1 ? " · esok" : " · " + n + " hari lagi";
  }
  // Reporting groups for the filter
  var REP_GROUPS = [
    { id: "tiada", label: "Reporting: belum bermula" }, { id: "proses", label: "Reporting: dalam proses" },
    { id: "semak", label: "Reporting: menunggu kelulusan" }, { id: "lulus", label: "Reporting: lulus" },
    { id: "batal", label: "Reporting: dibatalkan" }
  ];
  function repGroup(p) {
    var s = (p.reporting || {}).status || "";
    if (!s) return "tiada";
    if (s === "Lulus") return "lulus";
    if (s === "Menunggu kelulusan") return "semak";
    if (s === "Dibatalkan") return "batal";
    return "proses";
  }


  // ---------- Kronologi ----------
  // Timeline of Progress semasa updates, grouped by day, newest first. The date/time of each entry can be changed.
  function pad2(n) { return ("0" + n).slice(-2); }
  function localInput(iso) {   // ISO -> "yyyy-MM-ddTHH:mm" in this device's time, for <input type="datetime-local">
    var d = new Date(iso);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()) + "T" + pad2(d.getHours()) + ":" + pad2(d.getMinutes());
  }
  function dayLabel(iso) {
    return new Date(iso).toLocaleDateString("ms-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }
  function timeLabel(iso) {
    return new Date(iso).toLocaleTimeString("ms-MY", { hour: "2-digit", minute: "2-digit", hour12: true });
  }

  function kronologiWidget(branch) {
    var all = (kron.entries || []).filter(function (e) { return branch === ALL || e.cawangan === branch; });
    var w = widget("w-4 lgd-kron", "Kronologi Progress Legality", "");
    w.querySelector(".w-head").appendChild(el("span", "lgd-kron-lock", "🔒 Admin sahaja"));
    if (!kron.entries) {
      w.appendChild(el("p", "empty-text", kron.error ? "Tidak dapat memuatkan kronologi (" + kron.error + ")."
        : kron.loading ? "Memuatkan kronologi…" : "Belum dimuatkan."));
      return w;
    }
    if (!all.length) {
      w.appendChild(el("p", "empty-text", "Belum ada catatan. Setiap kali PIC menyimpan Progress semasa, ia direkod di sini."));
      return w;
    }

    var tools = el("div", "lgd-prog-tools");
    var search = el("input", "borang-input lgd-prog-search");
    search.type = "search"; search.placeholder = "Cari dalam catatan"; search.value = kron.q;
    search.setAttribute("aria-label", "Cari dalam kronologi");
    tools.appendChild(search);
    var pick = el("select", "borang-input lgd-prog-filter");
    pick.setAttribute("aria-label", "Sekolah");
    var names = {};
    all.forEach(function (e) { names[e.sekolah + (branch === ALL ? " · " + e.cawangan : "")] = e.cawangan + "|" + e.sekolah; });
    [["", "Semua sekolah"]].concat(Object.keys(names).sort().map(function (k) { return [names[k], k]; })).forEach(function (o) {
      var op = el("option", null, o[1]); op.value = o[0]; pick.appendChild(op);
    });
    pick.value = kron.school;
    tools.appendChild(pick);
    var count = el("span", "lgd-prog-count");
    tools.appendChild(count);
    w.appendChild(tools);

    var list = el("div", "lgd-kron-list");
    w.appendChild(list);
    var LIMIT = 60, shown = LIMIT;

    function draw() {
      list.textContent = "";
      var q = kron.q.trim().toLowerCase();
      var rows = all.filter(function (e) {
        if (kron.school && e.cawangan + "|" + e.sekolah !== kron.school) return false;
        return !q || (e.text + " " + e.sekolah).toLowerCase().indexOf(q) > -1;
      });
      count.textContent = rows.length + " catatan";
      var lastDay = "";
      rows.slice(0, shown).forEach(function (e) {
        var day = e.masa ? dayLabel(e.masa) : "Tiada tarikh";
        if (day !== lastDay) { list.appendChild(el("h3", "lgd-kron-day", day)); lastDay = day; }
        list.appendChild(entry(e));
      });
      if (!rows.length) list.appendChild(el("p", "empty-text", "Tiada catatan sepadan."));
      if (rows.length > shown) {
        var more = el("button", "link-btn lgd-kron-more", "Tunjuk lagi (" + (rows.length - shown) + ")");
        more.type = "button";
        more.addEventListener("click", function () { shown += LIMIT; draw(); });
        list.appendChild(more);
      }
    }

    function entry(e) {
      var item = el("article", "lgd-kron-item");
      var head = el("div", "lgd-kron-head");
      var when = el("div", "lgd-kron-when");
      head.appendChild(when);
      var who = el("span", "lgd-kron-school", e.sekolah);
      if (branch === ALL) who.appendChild(el("small", null, e.cawangan));
      head.appendChild(who);
      item.appendChild(head);
      item.appendChild(el("p", "lgd-kron-text", e.text));

      function show() {
        when.textContent = "";
        when.appendChild(el("span", "lgd-kron-time", e.masa ? timeLabel(e.masa) : "—"));
        var ed = el("button", "lgd-vid-edit", "✎"); ed.type = "button";
        ed.title = "Ubah tarikh dan masa";
        ed.setAttribute("aria-label", "Ubah tarikh dan masa catatan " + e.sekolah);
        ed.addEventListener("click", edit);
        when.appendChild(ed);
        if (e.dicatat && e.masa && Math.abs(new Date(e.dicatat) - new Date(e.masa)) > 60000) {
          when.title = "Dicatat sebenar: " + new Date(e.dicatat).toLocaleString("ms-MY");
          when.appendChild(el("span", "lgd-kron-moved", "diubah"));
        }
      }
      function edit() {
        when.textContent = "";
        var inp = el("input", "borang-input lgd-kron-input");
        inp.type = "datetime-local"; inp.value = e.masa ? localInput(e.masa) : "";
        inp.setAttribute("aria-label", "Tarikh dan masa");
        var save = el("button", "lgd-vid-save", "Simpan"); save.type = "button";
        var cancel = el("button", "lgd-del-no", "Batal"); cancel.type = "button";
        var err = el("small", "lgd-vid-err");
        cancel.addEventListener("click", show);
        save.addEventListener("click", function () {
          if (!inp.value) { err.textContent = "Pilih tarikh dan masa."; return; }
          save.disabled = cancel.disabled = true; save.textContent = "Menyimpan…";
          Api.post({ action: "saveKronologiMasa", cawangan: e.cawangan, id: e.id, masa: inp.value })
            .then(function (d) { kron.entries = d.entries || kron.entries; changed(); })
            .catch(function (x) {
              save.disabled = cancel.disabled = false; save.textContent = "Simpan";
              err.textContent = "Tidak dapat menyimpan: " + (x.message || x);
            });
        });
        inp.addEventListener("keydown", function (ev) { if (ev.key === "Escape") show(); });
        var row = el("div", "lgd-kron-edit");
        row.appendChild(inp); row.appendChild(save); row.appendChild(cancel); row.appendChild(err);
        when.appendChild(row);
        inp.focus();
      }
      show();
      return item;
    }

    search.addEventListener("input", function () { kron.q = search.value; shown = LIMIT; draw(); });
    pick.addEventListener("change", function () { kron.school = pick.value; shown = LIMIT; draw(); });
    draw();
    return w;
  }

  // "Program Sekolah" tracker: every programme the cawangan sent through the Program page.
  function programWidget(branch) {
    var all = (state.programs || []).filter(function (p) { return branch === ALL || p.cawangan === branch; });
    var w = widget("w-4 lgd-programs", "Program Sekolah dihantar", state.programs ? all.length + " program" : "");
    if (state.sheetUrl) {
      var open = el("a", "link-btn lgd-sheet", "Buka Sheet ↗");
      open.href = state.sheetUrl; open.target = "_blank"; open.rel = "noopener";
      w.querySelector(".w-head").appendChild(open);
    }
    if (!state.programs) {
      w.appendChild(el("p", "empty-text", state.progError ? "Tidak dapat memuatkan program (" + state.progError + ")."
        : state.progLoading ? "Memuatkan program…" : "Belum dimuatkan."));
      return w;
    }
    var now = today();
    var upcoming = all.filter(function (p) { return (p.tamat || p.mula) >= now; }).length;
    var kpi = el("div", "lgd-prog-kpi");
    [["Program", all.length], ["Akan datang", upcoming],
     ["Pelajar", sum(all.map(function (p) { return p.jumlahPelajar; }))],
     ["Manpower", sum(all.map(function (p) { return p.manpower; }))]].forEach(function (k) {
      var b = el("div", "lgd-prog-k");
      b.appendChild(el("strong", null, String(k[1])));
      b.appendChild(el("span", null, k[0]));
      kpi.appendChild(b);
    });
    w.appendChild(kpi);

    if (!all.length) {
      w.appendChild(el("p", "empty-text", "Belum ada program dihantar" + (branch === ALL ? "." : " untuk cawangan " + branch + ".")));
      return w;
    }
    // Search + filters (kept in state, so they survive a redraw)
    var pf = state.progFilter = state.progFilter || { q: "", status: "", rep: "", month: "" };
    var tools = el("div", "lgd-prog-tools");
    var search = el("input", "borang-input lgd-prog-search");
    search.type = "search";
    search.placeholder = "Cari sekolah, program atau PIC";
    search.setAttribute("aria-label", "Cari program");
    search.value = pf.q;
    tools.appendChild(search);
    function filterSelect(key, label, options) {
      var s = el("select", "borang-input lgd-prog-filter");
      s.setAttribute("aria-label", label);
      [["", label]].concat(options).forEach(function (o) {
        var op = el("option", null, o[1]); op.value = o[0]; s.appendChild(op);
      });
      s.value = pf[key];
      s.addEventListener("change", function () { pf[key] = s.value; draw(); });
      tools.appendChild(s);
    }
    filterSelect("status", "Semua status", PROG_STATUS.map(function (x) { return [x.id, x.label]; }));
    filterSelect("rep", "Semua reporting", REP_GROUPS.map(function (x) { return [x.id, x.label]; }));
    var months = {};
    all.forEach(function (p) { var m = (p.mula || "").slice(0, 7); if (/^\d{4}-\d{2}$/.test(m)) months[m] = 1; });
    filterSelect("month", "Semua bulan", Object.keys(months).sort().reverse().map(function (m) {
      return [m, new Date(+m.slice(0, 4), +m.slice(5) - 1, 1).toLocaleDateString("ms-MY", { month: "long", year: "numeric" })];
    }));
    var count = el("span", "lgd-prog-count");
    tools.appendChild(count);
    w.appendChild(tools);

    var wrap = el("div", "tbl-wrap");
    var t = el("table", "mtable lgd-prog-table lgd-plist");
    var hr = el("tr");
    ["Tarikh", "Sekolah", "Program", "Pelajar", "Manpower", "PIC", "Telegram", "Dihantar", "Reporting", "Video program", ""].forEach(function (h, i) {
      var c = el("th", i === 3 || i === 4 ? "num" : null, h);
      if (i === 10) { c.className = "lgd-del-col"; c.setAttribute("aria-label", "Padam"); }
      hr.appendChild(c);
    });
    var th = el("thead"); th.appendChild(hr); t.appendChild(th);
    var tb = el("tbody");
    t.appendChild(tb);
    wrap.appendChild(t);
    w.appendChild(wrap);

    function draw() {
      tb.textContent = "";
      pf.q = search.value;
      var q = search.value.trim().toLowerCase();
      var shown = all.filter(function (p) {
        if (pf.status && progStatus(p, now) !== pf.status) return false;
        if (pf.rep && repGroup(p) !== pf.rep) return false;
        if (pf.month && (p.mula || "").slice(0, 7) !== pf.month) return false;
        return !q || [p.sekolah, p.negeri, p.nama, p.jenis, p.mainPic, p.legality, p.virality, p.cawangan].join(" ").toLowerCase().indexOf(q) > -1;
      });
      count.textContent = shown.length === all.length ? "" : shown.length + " daripada " + all.length;
      shown.forEach(function (p) {
        var st = progStatus(p, now);
        var r = el("tr", st === "akan" || st === "hari" ? "is-upcoming" : st === "batal" ? "is-cancelled" : "");
        // Each cell has a class (its place in the card layout on small screens) and a label shown there.
        function cell(cls, label) { var c = el("td", cls); if (label) c.setAttribute("data-label", label); return c; }
        var d = cell("lgd-prog-date lgd-c-date");
        var stInfo = PROG_STATUS.filter(function (x) { return x.id === st; })[0];
        d.appendChild(el("span", "lgd-pstat is-" + st, stInfo.label + daysNote(p, st, now)));
        d.appendChild(document.createTextNode(fmtRange(p.mula, p.tamat)));
        if (p.masa) d.appendChild(el("small", null, p.masa));
        r.appendChild(d);
        var sc = cell("lgd-c-school"); sc.appendChild(document.createTextNode(p.sekolah));
        sc.appendChild(el("small", null, [p.cawangan, p.negeri].filter(Boolean).join(" · "))); r.appendChild(sc);
        var pr = cell("lgd-c-name");
        if (p.sheet && /^https?:/i.test(p.sheet)) {
          var a = el("a", null, p.nama); a.href = p.sheet; a.target = "_blank"; a.rel = "noopener"; pr.appendChild(a);
        } else pr.appendChild(document.createTextNode(p.nama));
        pr.appendChild(el("small", null, [p.jenis, p.bilGuru ? p.bilGuru + " guru" : ""].filter(String).join(" · ")));
        if (p.guru) pr.title = "Guru bertugas:\n" + p.guru;
        r.appendChild(pr);
        var pl = cell("num lgd-c-pel", "Pelajar"); pl.textContent = String(p.jumlahPelajar); if (p.pelajar) pl.title = p.pelajar; r.appendChild(pl);
        var mp = cell("num lgd-c-man", "Manpower"); mp.textContent = p.manpower + (p.tambahan ? " +" + p.tambahan : ""); r.appendChild(mp);
        var pic = cell("lgd-prog-pic lgd-c-pic", "PIC");
        // "Main @user" per line; "(Bukan Alumni · Kader Tengah)" goes to the tooltip so the column stays narrow.
        [["Main", p.mainPic], ["Legality", p.legality], ["Virality", p.virality]].forEach(function (x) {
          if (!x[1]) return;
          var m = /^(.*?)\s*\((.+)\)\s*$/.exec(x[1]);
          var line = el("small", "lgd-pic-line");
          line.appendChild(el("span", "lgd-pic-role", x[0]));
          line.appendChild(document.createTextNode(" " + (m ? m[1] : x[1])));
          if (m) line.title = x[0] + ": " + m[2];
          pic.appendChild(line);
        });
        r.appendChild(pic);
        var ok = /^berjaya/i.test(p.telegram);
        var tg = cell("lgd-c-tg", "Telegram"); var badge = el("span", "lgd-tg " + (ok ? "is-ok" : "is-fail"), ok ? "Terhantar" : (p.telegram ? "Gagal" : "—"));
        if (!ok && p.telegram) badge.title = p.telegram;
        tg.appendChild(badge); r.appendChild(tg);
        var sent = cell("lgd-prog-sent lgd-c-sent", "Dihantar");
        sent.textContent = p.dihantar ? new Date(p.dihantar).toLocaleString("ms-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—";
        r.appendChild(sent);
        // Reporting program (bot): status, Canva link, admin comment; programmes before the bot show "—"
        var rep = p.reporting || {};
        var rtd = cell("lgd-rep lgd-c-rep", "Reporting");
        if (!rep.status) rtd.appendChild(el("span", "lgd-rep-none", "—"));
        else {
          var tone = rep.status === "Lulus" ? "is-ok" : rep.status === "Perlu baiki" || rep.status === "Dibatalkan" ? "is-fail" : rep.status === "Menunggu kelulusan" ? "is-review" : "is-wait";
          var rb = el("span", "lgd-tg " + tone, rep.status === "Lulus" ? "✓ Lulus" : rep.status);
          rb.title = (rep.komen ? rep.komen + " · " : "") + (rep.next ? "Follow-up seterusnya: " + new Date(rep.next).toLocaleString("ms-MY", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "");
          rtd.appendChild(rb);
          if (rep.link) {
            var rl = el("a", "lgd-rep-link", "Canva ↗");
            rl.href = rep.link; rl.target = "_blank"; rl.rel = "noopener";
            rtd.appendChild(rl);
          }
          if (rep.status === "Perlu baiki" && rep.komen) rtd.appendChild(el("small", "lgd-rep-note", rep.komen));
        }
        r.appendChild(rtd);
        r.appendChild(videoCell(p, cell("lgd-rep lgd-c-vid", "Video")));
        r.appendChild(deleteCell(p, r));
        tb.appendChild(r);
      });
      if (!tb.children.length) {
        var er = el("tr"); var ec = el("td", "empty-text", "Tiada program sepadan."); ec.colSpan = 11; er.appendChild(ec); tb.appendChild(er);
      }
    }

    // Video program: link (or "+ Link video"), with a pencil to change it; saved to the Program sheet.
    function videoCell(p, td) {
      function show() {
        td.textContent = "";
        if (p.video && /^https?:/i.test(p.video)) {
          var a = el("a", "lgd-rep-link lgd-vid-link", "Video ↗");
          a.href = p.video; a.target = "_blank"; a.rel = "noopener";
          td.appendChild(a);
          var ed = el("button", "lgd-vid-edit", "✎"); ed.type = "button";
          ed.title = "Tukar link video"; ed.setAttribute("aria-label", "Tukar link video " + p.nama);
          ed.addEventListener("click", edit);
          td.appendChild(ed);
        } else {
          var add = el("button", "lgd-vid-add", "+ Link video"); add.type = "button";
          add.addEventListener("click", edit);
          td.appendChild(add);
        }
      }
      function edit() {
        td.textContent = "";
        var box = el("div", "lgd-vid-form");
        var inp = el("input", "borang-input lgd-vid-input");
        inp.type = "url"; inp.placeholder = "https://…"; inp.value = p.video || "";
        inp.setAttribute("aria-label", "Link video " + p.nama);
        var err = el("small", "lgd-vid-err");
        var save = el("button", "lgd-vid-save", "Simpan"); save.type = "button";
        var cancel = el("button", "lgd-del-no", "Batal"); cancel.type = "button";
        cancel.addEventListener("click", show);
        function submit() {
          var url = inp.value.trim();
          if (url && !/^https?:\/\/\S+$/i.test(url)) { err.textContent = "Link mesti bermula dengan https://"; inp.focus(); return; }
          save.disabled = cancel.disabled = true; save.textContent = "Menyimpan…";
          Api.post({ action: "saveProgramVideo", id: p.id, url: url })
            .then(function () { p.video = url; show(); })
            .catch(function (e) {
              save.disabled = cancel.disabled = false; save.textContent = "Simpan";
              err.textContent = "Tidak dapat menyimpan: " + (e.message || e);
            });
        }
        save.addEventListener("click", submit);
        inp.addEventListener("keydown", function (e) {
          if (e.key === "Enter") { e.preventDefault(); submit(); }
          if (e.key === "Escape") show();
        });
        box.appendChild(inp);
        var row = el("div", "lgd-vid-actions"); row.appendChild(save); row.appendChild(cancel);
        box.appendChild(row);
        box.appendChild(err);
        td.appendChild(box);
        inp.focus();
      }
      show();
      return td;
    }

    // Trash button → "Padam program ini?" [Ya, padam] [Batal] in the same cell → removes the row from the Program sheet.
    function deleteCell(p, row) {
      var td = el("td", "lgd-del-col lgd-c-del");
      function idle() {
        td.textContent = "";
        var b = el("button", "lgd-del-btn", "🗑");
        b.type = "button";
        b.title = "Padam program ini";
        b.setAttribute("aria-label", "Padam program " + p.nama);
        b.addEventListener("click", ask);
        td.appendChild(b);
      }
      function ask() {
        td.textContent = "";
        var box = el("div", "lgd-del-ask");
        box.appendChild(el("span", null, "Padam program ini?"));
        var yes = el("button", "lgd-del-yes", "Ya, padam"); yes.type = "button";
        var no = el("button", "lgd-del-no", "Batal"); no.type = "button";
        no.addEventListener("click", idle);
        yes.addEventListener("click", function () {
          yes.disabled = no.disabled = true; yes.textContent = "Memadam…";
          Api.post({ action: "deleteProgram", id: p.id, dihantar: p.dihantar, sekolah: p.sekolah, nama: p.nama })
            .then(function () {
              state.programs = (state.programs || []).filter(function (x) { return x !== p; });
              row.remove();
              changed();
            })
            .catch(function (e) {
              idle();
              alert("Tidak dapat memadam: " + (e.message || e));
            });
        });
        box.appendChild(yes); box.appendChild(no);
        td.appendChild(box);
        yes.focus();
      }
      idle();
      return td;
    }
    search.addEventListener("input", draw);
    draw();
    return w;
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

      var label = el("label", "month-pick lgd-branch-pick");   // phones; wide screens use the sidebar picker
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
      refresh.addEventListener("click", function () { load(true); });   // also reloads the programmes

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
      select.addEventListener("change", function () { store("legalityBranch", select.value); draw(); drawSide(); });
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
    sidebar: sidebar,
    count: function () { return totals().schools; },
    describe: function () { var t = totals(); return t.schools + " sekolah · " + t.people + " CRM"; }
  };

  // Load once the admin has logged in (components/gate.js).
  if (window.YoshGate) window.YoshGate.ready(function () { load(false); }); else load(false);
})();
