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
    if (!quiet) loadPrograms();
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

    // Checklist Legality Semasa: the 6 steps of each school (green = done)
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

    grid.appendChild(programWidget(branch));
    grid.appendChild(botWidget());
    body.appendChild(grid);
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

  function progressWidget(rows, branch) {
    var w = widget("w-4", "Progress dan Status Legality Sekolah", rows.length + " sekolah");
    if (!rows.length) { w.appendChild(el("p", "empty-text", "Belum ada sekolah untuk paparan ini.")); return w; }
    var sorted = rows.slice().sort(function (a, b) {
      var ua = (a.s.note && a.s.note.text && a.s.note.updated) || "", ub = (b.s.note && b.s.note.text && b.s.note.updated) || "";
      return ub < ua ? -1 : ub > ua ? 1 : 0;
    });
    var wrap = el("div", "tbl-wrap");
    var t = el("table", "mtable lgd-prog-table");
    var hr = el("tr");
    ["Sekolah", "Jenis Legality", "Status Legality", "PIC", "Progress semasa"].forEach(function (h) { hr.appendChild(el("th", null, h)); });
    var th = el("thead"); th.appendChild(hr); t.appendChild(th);
    var tb = el("tbody");
    var now = Date.now();
    sorted.forEach(function (x) {
      var r = el("tr");
      var school = el("td", "lgd-prog-school", x.s.name);
      if (branch === ALL) school.appendChild(el("small", null, x.cawangan));
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
      var note = x.s.note || {};
      if (note.text) {
        noteTd.appendChild(el("p", "lgd-prog-text", note.text));
        if (note.updated) {
          var days = Math.floor((now - new Date(note.updated).getTime()) / 86400000);
          var when = el("small", "lgd-prog-when" + (days >= STALE_DAYS ? " is-stale" : ""),
            (days >= STALE_DAYS ? "⚠️ " : "") + "Dikemas kini " + ago(note.updated));
          when.title = new Date(note.updated).toLocaleString("ms-MY", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
          noteTd.appendChild(when);
        }
      } else {
        noteTd.appendChild(el("span", "lgd-prog-empty is-missing", "Belum ada catatan"));
      }
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

  // Bot "Legality Tds Tengah": which TENGAH schools still have empty sections, and the message the bot sends.
  var bot = { data: null, loading: false, error: "", sending: false, note: "" };
  function botWidget() {
    var w = widget("w-4 lgd-bot", "Bot semakan Legality · TENGAH", "Planning & Peluang Lain Tahun Depan");
    w.appendChild(el("p", "lgd-bot-lead",
      "Bot menyemak setiap sekolah TENGAH. Jika bahagian di atas masih kosong, bot menghantar mesej ke group dan tag PIC Legality sekolah itu."));
    var tools = el("div", "lgd-bot-tools");
    var check = el("button", "link-btn", bot.data ? "Semak semula" : "Semak sekarang");
    check.type = "button";
    check.disabled = bot.loading;
    check.addEventListener("click", function () {
      bot.loading = true; bot.error = ""; bot.note = ""; changed();
      Api.get({ action: "reminder", cawangan: "TENGAH" })
        .then(function (d) { bot.data = d; })
        .catch(function (e) { bot.error = e.message || String(e); })
        .then(function () { bot.loading = false; changed(); });
    });
    tools.appendChild(check);
    w.appendChild(tools);

    if (bot.loading) { w.appendChild(el("p", "empty-text", "Menyemak semua sekolah TENGAH…")); return w; }
    if (bot.error) { w.appendChild(el("p", "report-warning", "Tidak dapat menyemak: " + bot.error)); return w; }
    if (!bot.data) return w;

    var d = bot.data;
    if (!d.gaps.length) { w.appendChild(el("p", "empty-text", "Semua sekolah TENGAH sudah lengkap. Bot tidak akan hantar mesej.")); return w; }

    var list = el("div", "lgd-bot-list");
    d.gaps.forEach(function (g) {
      var row = el("div", "lgd-bot-row");
      var who = g.pics.filter(function (p) { return p.username; }).map(function (p) { return "@" + p.username; }).join(" ");
      var name = el("strong", null, g.sekolah);
      row.appendChild(name);
      row.appendChild(el("span", "lgd-bot-pic" + (who ? "" : " is-none"), who || "PIC belum ditetapkan"));
      var miss = el("span", "lgd-bot-miss");
      g.missing.forEach(function (m) { miss.appendChild(el("span", "lgd-tg is-fail", m)); });
      row.appendChild(miss);
      list.appendChild(row);
    });
    w.appendChild(list);

    var det = el("details", "lgd-bot-preview");
    det.appendChild(el("summary", null, "Pratonton mesej bot"));
    det.appendChild(el("pre", null, d.text));
    w.appendChild(det);

    // Sending goes through the Netlify function (backend/program/semak-legality.mjs), which holds the
    // bot token (LEGALITY_BOT_TENGAH) and posts to the Program Tengah group.
    function botCall(mode) {
      return fetch("/.netlify/functions/semak-legality", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kod: Api.getKod(), cawangan: "TENGAH", mode: mode })
      }).then(function (r) {
        return r.json().catch(function () { return { ok: false, error: "HTTP " + r.status }; });
      }).then(function (r) { if (!r.ok) throw new Error(r.error || "Gagal"); return r; });
    }
    var test = el("button", "link-btn", "Semak sambungan bot");
    test.type = "button";
    test.disabled = bot.sending;
    test.addEventListener("click", function () {
      bot.sending = true; bot.note = "Menyemak bot…"; changed();
      botCall("check")
        .then(function (r) { bot.note = "✓ " + r.bot + " dalam group \"" + r.group + "\" (" + r.status + "). Sedia untuk hantar."; })
        .catch(function (e) { bot.note = "✕ " + (e.message || e); })
        .then(function () { bot.sending = false; changed(); });
    });
    var send = el("button", "borang-submit lg-btn-sm", bot.sending ? "Sila tunggu…" : "Hantar ke group");
    send.type = "button";
    send.disabled = bot.sending;
    send.addEventListener("click", function () {
      if (!confirm("Hantar mesej ini ke group Program Tengah sekarang? Ahli group akan nampak dan PIC akan di-tag.")) return;
      bot.sending = true; bot.note = ""; changed();
      botCall("send")
        .then(function (r) { bot.note = r.sent ? "✓ Mesej dihantar (" + r.schools + " sekolah)." : (r.reason || "Tiada mesej dihantar."); })
        .catch(function (e) { bot.note = "✕ Gagal: " + (e.message || e); })
        .then(function () { bot.sending = false; changed(); });
    });
    var act = el("div", "lgd-bot-actions");
    act.appendChild(send);
    act.appendChild(test);
    if (bot.note) act.appendChild(el("span", "lgd-bot-note", bot.note));
    w.appendChild(act);
    return w;
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
