// Panduan Legality (legality/panduan.html): the "Jejak CRM: Cikgu Program" guide from the
// "10 Fasa Kerjasama Sekolah" deck, slides 1–6, in two sub-tabs:
//   · Level CRM     — pick L1–L5: what the PIC does, the output that proves the level, the school KPI
//   · Phase Sekolah — the same five steps read by school phase: entry condition, KPI, contributing actions
// The tab and level live in the hash (#level/L3, #fasa) so a link opens the same view.
(function () {
  "use strict";

  // Slides 1–6. KPI empty = "Tiada KPI · fokus output".
  var LEVELS = [
    {
      id: "L1", name: "Kenal kita", fasa: "Fasa 2", note: "Dapat nombor & mula CRM",
      tindakan: [
        "Call pejabat / minta nombor dari alumni, mad’u",
        "Analisa personaliti, sesuaikan cara PM",
        "PM kenalkan diri sebagai wakil Yosh",
        "Jumpa bawa buah tangan, cerita program kita",
        "Pastikan cikgu save nombor; add FB & tag"
      ],
      output: ["Nombor dalam CRM", "Mula CRM (PM / call)", "Kenal wajihah amal", "Dah add Facebook"],
      kpi: [],
      penyumbang: [["F2", "Perjumpaan sekolah"], ["F2", "Kenal pasti niche"]],
      syarat: "Masuk F2 bila Cikgu Program & Admin L1"
    },
    {
      id: "L2", name: "Faham objektif kita", fasa: "Fasa 3–5", note: "Hubungan aktif, program berjalan",
      tindakan: [
        "Reply status & komen di posting cikgu",
        "Hantar quotes / video (motivasi, ilmu)",
        "Report program informal (gambar, output, doa)",
        "Minta cikgu bawa kita beramah dengan admin",
        "Bawa PGSP bantu tsiqohkan"
      ],
      output: ["Respon mesej dalam 24 jam", "Boleh dihubungi hujung minggu", "Jumpa F2F 2×"],
      kpi: ["BnW ditandatangani", "Program berjalan"],
      penyumbang: [["F3", "Follow up BnW"], ["F3", "Set tarikh program"]],
      syarat: "F3 perlukan Cikgu Program L2"
    },
    {
      id: "L3", name: "Sokong & selesa", fasa: "Fasa 6–7", note: "Rapat secara personal",
      tindakan: [
        "Tanya soalan personal & keluarga (offline)",
        "Borak pelajar & update cerita mad’u",
        "Report program informal",
        "Beri hadiah semasa ziarah",
        "Cerita projek dakwah (QC4U, FSP, AGM)",
        "Dapatkan feedback & komen cikgu"
      ],
      output: ["Kenal latar keluarga", "Tahu isu semasa sekolah", "Mudah setup pertemuan", "Cikgu mula beri hadiah", "Cikgu minta pendapat kita"],
      kpi: ["Cikgu share di socmed", "Join kempen MFA"],
      penyumbang: [["F5", "Feedback video"], ["F5", "Meeting reporting"]],
      syarat: "F6 perlukan Cikgu Program L3"
    },
    {
      id: "L4", name: "Promosi program kita", fasa: "Fasa 8", note: "Cikgu promosi kita",
      tindakan: [
        "Share impact program di FB",
        "Rakam feedback cikgu semasa program",
        "Cerita program mega (seminar SPM, LYF)",
        "Share compile video YOSH Junior"
      ],
      output: ["Post poster di socmed", "Kongsi video testimoni", "Cerita kita pada guru lain", "Galakkan guru hadir program"],
      kpi: [],
      penyumbang: [["F7", "Reporting berkala"], ["F8", "Gerak mutarobbi"]],
      syarat: "F8 perlukan Cikgu Program & Admin L4"
    },
    {
      id: "L5", name: "Buka peluang baru", fasa: "Fasa 9–10", note: "Cikgu buka peluang baru",
      tindakan: [
        "Cerita projek dakwah (QC4U, FSP, AGM)",
        "Borak tentang PIBG / Muafakat",
        "CRM seminggu sekali bersama cikgu & admin",
        "Wish hari perayaan"
      ],
      output: ["Offer projek hitam putih", "Kenalkan kita ke PIBG / Muafakat", "Jemput ke program rasmi sekolah", "Dijemput ke rumah cikgu"],
      kpi: ["Cikgu join projek & kempen"],
      penyumbang: [["F7", "Reporting berkala"], ["F8", "Gerak mutarobbi"]],
      syarat: "F9–10 perlukan semua pihak L5"
    }
  ];

  var root = document.getElementById("guide");
  if (!root) return;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ---- state (hash) ----
  function readHash() {
    var p = (location.hash || "").replace(/^#\/?/, "").split("/");
    var tab = p[0] === "fasa" ? "fasa" : "level";
    var lv = 0;
    LEVELS.forEach(function (l, i) { if ((p[1] || "").toUpperCase() === l.id) lv = i; });
    return { tab: tab, lv: lv };
  }
  var state = readHash();
  function go(tab, lv) {
    state = { tab: tab, lv: lv == null ? state.lv : lv };
    history.replaceState(null, "", "#" + (state.tab === "fasa" ? "fasa" : "level/" + LEVELS[state.lv].id));
    draw();
  }

  // ---- shared bits ----
  function box(cls, title, sub) {
    var b = el("section", "gd-box " + cls);
    var h = el("div", "gd-box-head");
    h.appendChild(el("h3", "gd-box-title", title));
    if (sub) h.appendChild(el("p", "gd-box-sub", sub));
    b.appendChild(h);
    return b;
  }
  function list(items, cls, mark) {
    var ul = el(mark === "num" ? "ol" : "ul", "gd-list " + (cls || ""));
    items.forEach(function (t) { ul.appendChild(el("li", null, t)); });
    return ul;
  }
  function kpiBody(lv) {
    if (!lv.kpi.length) return el("p", "gd-none", "Tiada KPI di peringkat ini. Fokus capai output dulu.");
    return list(lv.kpi, "is-kpi");
  }
  function chips(pairs) {
    var w = el("div", "gd-chips");
    pairs.forEach(function (p) {
      var c = el("span", "gd-chip");
      c.appendChild(el("b", null, p[0]));
      c.appendChild(document.createTextNode(" " + p[1]));
      w.appendChild(c);
    });
    return w;
  }

  // ---- Level CRM ----
  function drawLevel(host) {
    var steps = el("div", "gd-steps");
    steps.setAttribute("role", "tablist");
    steps.setAttribute("aria-label", "Level CRM");
    LEVELS.forEach(function (l, i) {
      var b = el("button", "gd-step" + (i === state.lv ? " is-on" : i < state.lv ? " is-past" : ""));
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", i === state.lv ? "true" : "false");
      b.appendChild(el("span", "gd-step-id", l.id));
      b.appendChild(el("span", "gd-step-name", l.name));
      b.addEventListener("click", function () { go("level", i); });
      steps.appendChild(b);
    });
    host.appendChild(steps);

    var lv = LEVELS[state.lv];
    var head = el("div", "gd-lvhead");
    head.appendChild(el("span", "gd-tag", "Cikgu Program · " + lv.fasa));
    head.appendChild(el("h2", "gd-lvtitle", "Level " + lv.id.slice(1) + " · " + lv.name));
    head.appendChild(el("p", "gd-lvnote", lv.note));
    host.appendChild(head);

    var grid = el("div", "gd-grid");
    var t = box("is-do", "Tindakan terperinci", "Apa PIC buat");
    t.appendChild(list(lv.tindakan, "is-num", "num"));
    grid.appendChild(t);
    var o = box("is-out", "Output ✓", "Bukti cikgu capai " + lv.id);
    o.appendChild(list(lv.output, "is-tick"));
    grid.appendChild(o);
    var k = box("is-kpi" + (lv.kpi.length ? "" : " is-empty"), "KPI ★", "Bukti fasa sekolah");
    k.appendChild(kpiBody(lv));
    grid.appendChild(k);
    host.appendChild(grid);

    var foot = el("div", "gd-foot");
    var p = box("is-help", "Tindakan penyumbang", "Tindakan fasa yang bantu capai output");
    p.appendChild(chips(lv.penyumbang));
    foot.appendChild(p);
    var s = box("is-rule", "Syarat fasa");
    s.appendChild(el("p", "gd-rule", lv.syarat));
    foot.appendChild(s);
    host.appendChild(foot);

    var nav = el("div", "gd-pager");
    if (state.lv > 0) nav.appendChild(pagerBtn("← " + LEVELS[state.lv - 1].id, state.lv - 1));
    if (state.lv < LEVELS.length - 1) nav.appendChild(pagerBtn(LEVELS[state.lv + 1].id + " →", state.lv + 1, true));
    host.appendChild(nav);
  }
  function pagerBtn(label, i, next) {
    var b = el("button", "gd-pager-btn" + (next ? " is-next" : ""), label);
    b.type = "button";
    b.addEventListener("click", function () { go("level", i); window.scrollTo({ top: 0, behavior: "smooth" }); });
    return b;
  }

  // ---- Phase Sekolah ----
  function drawFasa(host) {
    host.appendChild(el("p", "gd-intro",
      "Sekolah naik fasa bila level CRM cikgu yang disyaratkan dicapai. Setiap baris di bawah: syarat masuk fasa, " +
      "KPI ★ yang membuktikan fasa sekolah, dan tindakan fasa yang menyumbang."));

    var legend = el("div", "gd-legend");
    [["Tindakan terperinci", "apa PIC buat"], ["Output ✓", "bukti level cikgu naik"], ["KPI ★", "bukti fasa sekolah"], ["Penyumbang", "tindakan fasa"]]
      .forEach(function (x) {
        var s = el("span", "gd-legend-item");
        s.appendChild(el("b", null, x[0]));
        s.appendChild(document.createTextNode(" " + x[1]));
        legend.appendChild(s);
      });
    host.appendChild(legend);

    var wrap = el("ol", "gd-phases");
    LEVELS.forEach(function (lv, i) {
      var li = el("li", "gd-phase");
      var top = el("div", "gd-phase-top");
      top.appendChild(el("span", "gd-phase-fasa", lv.fasa));
      var t = el("div", "gd-phase-titles");
      t.appendChild(el("h3", "gd-phase-name", lv.name));
      t.appendChild(el("p", "gd-phase-note", lv.note));
      top.appendChild(t);
      var lb = el("button", "gd-phase-lv", lv.id);
      lb.type = "button";
      lb.title = "Lihat Level " + lv.id.slice(1);
      lb.addEventListener("click", function () { go("level", i); window.scrollTo({ top: 0, behavior: "smooth" }); });
      top.appendChild(lb);
      li.appendChild(top);

      var rows = el("dl", "gd-phase-rows");
      function row(label, node) {
        var d = el("div", "gd-phase-row");
        d.appendChild(el("dt", null, label));
        var dd = el("dd");
        dd.appendChild(node);
        d.appendChild(dd);
        rows.appendChild(d);
      }
      row("Syarat", el("span", "gd-rule", lv.syarat));
      row("KPI ★", kpiBody(lv));
      row("Output ✓", list(lv.output, "is-tick is-compact"));
      row("Penyumbang", chips(lv.penyumbang));
      li.appendChild(rows);
      wrap.appendChild(li);
    });
    host.appendChild(wrap);
  }

  // ---- page ----
  var seg = el("div", "gd-seg");
  seg.setAttribute("role", "tablist");
  var TABS = [["level", "Level CRM"], ["fasa", "Phase Sekolah"]];
  var segBtns = TABS.map(function (t) {
    var b = el("button", "gd-seg-btn", t[1]);
    b.type = "button";
    b.setAttribute("role", "tab");
    b.addEventListener("click", function () { go(t[0]); });
    seg.appendChild(b);
    return b;
  });
  var pane = el("div", "gd-pane");
  root.appendChild(seg);
  root.appendChild(pane);

  function draw() {
    segBtns.forEach(function (b, i) {
      var on = TABS[i][0] === state.tab;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-selected", on ? "true" : "false");
    });
    pane.textContent = "";
    if (state.tab === "fasa") drawFasa(pane); else drawLevel(pane);
  }
  window.addEventListener("hashchange", function () { state = readHash(); draw(); });
  draw();
})();
