// Unit Murabbi tab: monthly report dashboard.
// Months come from two places, in the same shape:
//   - live answers from our own form (borang.html), read from the Google Sheet via the Apps Script in config.js
//   - older months imported from Google Form PDFs (data/murabbi.js)
// Each month carries its own question list, so the page follows whatever was asked that month.
(function () {
  "use strict";

  var API = ((window.YOSH_CONFIG || {}).murabbiApi || "").trim();
  var ALL = "*";

  // How each question's "Paparan" setting is shown:
  //   tindakan  – Ya/Tidak, counted in the Tindakan bars
  //   progress  – numbers, steps of Progress Pengumpulan (in question order; the first is 100%)
  //   jumlah    – numbers totalled under the progress bars (or option counts for Pilihan)
  //   kekerapan – average plus how many gave each answer (e.g. turun sekolah 1×, 2×…)
  //   purata    – average per murabbi, with the total
  //   analisa   – written answers, grouped by theme
  //   butiran   – only in each murabbi's full answers
  var THEMES = [
    { label: "Pengumpulan", re: /kumpul|ngumpul/i },
    { label: "Masa dan jadual", re: /masa|timing|timming|jadual|weekend|sekali je/i },
    { label: "Follow up dan hubungan", re: /follow|contact|call|hati|empati|concern/i }
  ];

  // ---------- Older months imported from PDFs ----------
  var LEGACY_Q = [
    ["turun", "Turun Sekolah", "number", "kekerapan"],
    ["sirah", "Bawa artikel sirah", "yesno", "butiran"],
    ["integrasi", "Bawa integrasi", "yesno", "butiran"],
    ["artikel", "Artikel Sirah", "number", "purata"],
    ["telefon", "Letak nombor telefon", "yesno", "tindakan"],
    ["share", "Arah MT share artikel", "yesno", "tindakan"],
    ["tampal", "Arah MT tampal artikel", "yesno", "tindakan"],
    ["pancang", "Tanam pancang", "yesno", "tindakan"],
    ["kenal", "Memperkenalkan (1)", "yesno", "tindakan"],
    ["talk", "Talk online level H1", "yesno", "tindakan"],
    ["task", "Task MT contact ikh akh", "yesno", "tindakan"],
    ["influencer", "Kenalkan influencer", "yesno", "tindakan"],
    ["qiyadah", "Kenalkan qiyadah dakwah", "yesno", "tindakan"],
    ["contactbalik", "Arah contact balik ikh akh", "yesno", "tindakan"],
    ["kumpul", "Mad'u dikumpul", "number", "progress"],
    ["q20", "Soalan 20", "number", "butiran"],
    ["dicontact", "Berjaya dicontact", "number", "progress"],
    ["pertemuan", "Diajak ke pertemuan", "number", "progress"],
    ["konsisten", "MT konsisten jumpa", "number", "jumlah"],
    ["analisa", "Analisa", "longtext", "analisa"]
  ];

  function legacyMonths() {
    var reps = window.MURABBI_REPORTS || {};
    return Object.keys(reps).map(function (id) {
      var rep = reps[id];
      // rows: [time, nama, cawangan, …answers in LEGACY_Q order]
      var questions = LEGACY_Q.map(function (q, i) {
        return { code: q[0], label: q[1], type: q[2], view: q[3], text: rep.questions[i + 3] || q[1], options: [] };
      });
      return {
        id: id, label: rep.label, source: rep.source, note: rep.note,
        received: rep.received, duplicatesRemoved: rep.duplicatesRemoved || 0,
        questions: questions,
        rows: rep.rows.map(function (r) {
          var answers = {};
          LEGACY_Q.forEach(function (q, i) { answers[q[0]] = r[i + 3]; });
          return { time: r[0], nama: r[1], cawangan: r[2], answers: answers };
        })
      };
    });
  }

  // ---------- State ----------
  var state = { months: [], loading: !!API, error: "" };
  var listeners = [];

  function setMonths(live) {
    var byId = {};
    legacyMonths().forEach(function (m) { byId[m.id] = m; });
    (live || []).forEach(function (m) {
      m.source = "Borang Unit Murabbi (sistem)";
      m.live = true;
      byId[m.id] = m;
    });
    state.months = Object.keys(byId).sort().reverse().map(function (k) { return byId[k]; });
  }
  setMonths([]);

  function changed() {
    listeners.forEach(function (f) { f(); });
    window.dispatchEvent(new Event("yosh:unitdata"));
  }

  if (API) {
    fetch(API + (API.indexOf("?") < 0 ? "?" : "&") + "action=data")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error) throw new Error(d.error);
        setMonths(d.months);
      })
      .catch(function (e) { state.error = e.message || String(e); })
      .then(function () { state.loading = false; changed(); });
  }

  // ---------- Helpers ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function ans(r, code) { var v = r.answers[code]; return String(v == null ? "" : v).trim(); }
  function blank(s) { return !s || s === "-"; }
  // Only plain counts are used in figures ("3", "4 kali", "1x", "sekali", "19 org", ">20", "100+").
  // Anything else is written text and is shown, not counted.
  function num(s) {
    s = String(s).trim();
    if (/^sekali$/i.test(s)) return { v: 1, approx: false };
    var m = s.match(/^([>~]?)\s*(\d+(?:\.\d+)?)\s*([+>]?)\s*(x|kali|org|orang)?$/i);
    return m ? { v: +m[2], approx: !!(m[1] || m[3]) } : null;
  }
  function val(r, code) { var n = num(ans(r, code)); return n ? n.v : null; }
  function yes(r, code) { return /^ya$/i.test(ans(r, code)); }
  function nums(rows, code) {
    return rows.map(function (r) { return val(r, code); }).filter(function (v) { return v !== null; });
  }
  function sum(a) { return a.reduce(function (t, v) { return t + v; }, 0); }
  function avg(a) { return a.length ? sum(a) / a.length : 0; }
  function median(a) {
    if (!a.length) return 0;
    var s = a.slice().sort(function (x, y) { return x - y; }), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function fmt(v) { return Math.round(v * 10) / 10 + ""; }
  function title(s) { return s.replace(/(^|\s)(\S)/g, function (m, p, c) { return p + c.toUpperCase(); }); }
  function properName(s) {
    return String(s).toLowerCase().replace(/\s+/g, " ").trim()
      .replace(/(^|[\s.\-])(\S)/g, function (m, p, c) { return p + c.toUpperCase(); })
      .replace(/\b(Bin|Binti|Bt|B)\b(?!\.)/g, function (w) { return w.toLowerCase(); });
  }
  function shortName(s) {
    var words = properName(s).split(" ");
    var cut = words.findIndex(function (w) { return /^(bin|binti|bt|b)$/i.test(w); });
    return words.slice(0, Math.min(cut < 0 ? words.length : cut, 3)).join(" ");
  }
  function clip(s, max) {
    s = s.replace(/\s+/g, " ").trim();
    return s.length > max ? s.slice(0, max - 1).trim() + "…" : s;
  }

  function branchKey(r) { return String(r.cawangan || "").trim().toUpperCase(); }
  function branchName(key) {
    if (key === ALL) return "Semua cawangan";
    if (!key) return "Tiada cawangan";
    return key.length <= 3 ? key : properName(key);
  }
  function branches(month) {
    var count = {};
    month.rows.forEach(function (r) { var k = branchKey(r); count[k] = (count[k] || 0) + 1; });
    return Object.keys(count).sort(function (a, b) { return count[b] - count[a] || a.localeCompare(b); });
  }
  function rowsFor(month, branch) {
    return branch === ALL ? month.rows : month.rows.filter(function (r) { return branchKey(r) === branch; });
  }
  function qs(month, view, type) {
    return month.questions.filter(function (q) { return q.view === view && (!type || q.type === type); });
  }
  // Questions shown as numbers in tables, in question order.
  function numberCols(month) {
    return month.questions.filter(function (q) {
      return q.type === "number" && ["kekerapan", "purata", "progress", "jumlah"].indexOf(q.view) > -1;
    });
  }
  function analysisText(month, r) {
    return qs(month, "analisa").map(function (q) { return ans(r, q.code); }).filter(function (s) { return !blank(s); }).join("\n");
  }

  // ---------- Figures ----------
  function metrics(month, rows) {
    var n = rows.length;
    var progress = qs(month, "progress");
    var base = progress.length ? sum(nums(rows, progress[0].code)) : 0;
    var skipped = 0;
    progress.concat(qs(month, "jumlah", "number")).forEach(function (q) {
      rows.forEach(function (r) { var s = ans(r, q.code); if (!blank(s) && !num(s)) skipped++; });
    });
    var answered = rows.filter(function (r) { return !blank(analysisText(month, r)); });
    return {
      n: n,
      freq: qs(month, "kekerapan").map(function (q) {
        var values = rows.map(function (r) { return ans(r, q.code); }).filter(function (s) { return !blank(s); });
        var numeric = values.map(num).filter(Boolean);
        var count = {};
        values.forEach(function (s) { var x = num(s); var k = x ? String(x.v) : s; count[k] = (count[k] || 0) + 1; });
        var keys = Object.keys(count).sort(function (a, b) {
          var ia = q.options.indexOf(a), ib = q.options.indexOf(b);
          if (ia > -1 || ib > -1) return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
          return (isNaN(a) || isNaN(b)) ? a.localeCompare(b) : a - b;
        });
        return {
          q: q,
          avg: numeric.length ? avg(numeric.map(function (x) { return x.v; })) : null,
          dist: keys.map(function (k) { return { label: isNaN(k) ? k : k + "×", count: count[k] }; })
        };
      }),
      avgs: qs(month, "purata").map(function (q) {
        var v = nums(rows, q.code);
        return {
          q: q, avg: avg(v), total: sum(v),
          approx: rows.some(function (r) { var x = num(ans(r, q.code)); return x && x.approx; })
        };
      }),
      progress: progress.map(function (q) {
        var total = sum(nums(rows, q.code));
        return { q: q, total: total, pct: base ? Math.round((total / base) * 100) : 0, median: median(nums(rows, q.code)) };
      }),
      totals: qs(month, "jumlah").map(function (q) {
        if (q.type !== "number") {
          var count = {};
          rows.forEach(function (r) { var s = ans(r, q.code); if (!blank(s)) count[s] = (count[s] || 0) + 1; });
          return { q: q, options: Object.keys(count).map(function (k) { return { label: k, count: count[k] }; }) };
        }
        return { q: q, total: sum(nums(rows, q.code)) };
      }),
      base: base,
      skipped: skipped,
      actions: qs(month, "tindakan", "yesno").map(function (q) {
        return { label: q.label, count: rows.filter(function (r) { return yes(r, q.code); }).length };
      }).sort(function (a, b) { return b.count - a.count; }),
      answered: answered,
      themes: THEMES.map(function (t) {
        return { label: t.label, rows: answered.filter(function (r) { return t.re.test(analysisText(month, r)); }) };
      }),
      unthemed: answered.filter(function (r) {
        return !THEMES.some(function (t) { return t.re.test(analysisText(month, r)); });
      })
    };
  }

  function actionScore(month, r) {
    return qs(month, "tindakan", "yesno").filter(function (q) { return yes(r, q.code); }).length;
  }

  function stats(month, m, branch) {
    var dupes = month.duplicatesRemoved || 0;
    var out = [{
      label: "Laporan Diterima", value: String(m.n),
      note: branch !== ALL ? "Daripada " + month.rows.length + " semua cawangan"
        : dupes ? month.received + " dihantar, " + dupes + " berganda dibuang" : "Satu laporan seorang"
    }];
    m.freq.forEach(function (f) {
      out.push({
        label: "Kekerapan " + title(f.q.label),
        value: f.avg === null ? "–" : fmt(f.avg) + " kali",
        note: (f.avg === null ? "" : "Purata seorang · ") + "bilangan murabbi ikut jawapan:",
        dist: f.dist
      });
    });
    m.avgs.forEach(function (a) {
      out.push({
        label: "Purata " + title(a.q.label), value: (a.approx ? "≥" : "") + fmt(a.avg),
        note: "Seorang · jumlah " + (a.approx ? "≥" : "") + a.total
      });
    });
    if (m.progress.length) {
      out.push({
        label: title(m.progress[0].q.label), value: String(m.progress[0].total),
        note: "Median " + fmt(m.progress[0].median) + " seorang"
      });
    }
    return out;
  }

  function funnelNote(m) {
    return (m.progress.length > 1 ? "Peratus berbanding " + m.progress[0].q.label.toLowerCase() + "." : "") +
      (m.skipped ? " " + m.skipped + " jawapan bertulis (bukan nombor) tidak dikira." : "");
  }

  // ---------- Page widgets ----------
  function widget(cls, titleText, meta) {
    var w = el("section", "w " + cls);
    var h = el("div", "w-head");
    h.appendChild(el("h2", "w-title", titleText));
    if (meta) h.appendChild(el("span", "w-meta", meta));
    w.appendChild(h);
    return w;
  }

  function stat(s, lead) {
    var w = el("section", "w w-1 stat" + (lead ? " stat-lead" : ""));
    w.appendChild(el("h2", "stat-label", s.label));
    w.appendChild(el("p", "stat-value", s.value));
    w.appendChild(el("p", "stat-note", s.note));
    if (s.dist && s.dist.length) {
      var d = el("p", "stat-dist");
      s.dist.forEach(function (x) {
        var chip = el("span", "dist-chip");
        chip.appendChild(el("b", null, x.label));
        chip.appendChild(document.createTextNode(" " + x.count));
        chip.title = x.count + " murabbi menjawab " + x.label;
        d.appendChild(chip);
      });
      w.appendChild(d);
    }
    return w;
  }

  function hbar(label, value, max, extra) {
    var row = el("div", "hbar");
    row.appendChild(el("span", "hbar-label", label));
    var track = el("span", "hbar-track");
    track.appendChild(el("span", "hbar-fill")).style.width = (max ? Math.min(100, Math.round((value / max) * 100)) : 0) + "%";
    row.appendChild(track);
    row.appendChild(el("span", "hbar-value", String(value)));
    if (extra) row.appendChild(el("span", "hbar-extra", extra));
    return row;
  }

  function cell(r, code) {
    var s = ans(r, code), n = num(s);
    var td = el("td", "num");
    if (n) td.textContent = n.v + (n.approx ? "+" : "");
    else {
      td.textContent = "–";
      td.classList.add("muted");
      if (!blank(s)) { td.title = s; td.classList.add("has-text"); }
    }
    return td;
  }

  function detail(month, r) {
    var box = el("div", "qa");
    function pair(q, a, cls, full) {
      var item = el("div", "qa-item" + (full ? " qa-wide" : ""));
      var dt = el("dt", null, q.label || q);
      if (q.text && q.text !== q.label) dt.title = q.text;
      item.appendChild(dt);
      item.appendChild(el("dd", cls || null, blank(a) ? "–" : a));
      box.appendChild(item);
    }
    pair("Dihantar", r.time);
    pair("Cawangan", branchName(branchKey(r)));
    month.questions.filter(function (q) { return q.view !== "analisa"; }).forEach(function (q) {
      var a = ans(r, q.code);
      pair(q, a, q.type === "yesno" ? (yes(r, q.code) ? "ans-yes" : "ans-no") : null, q.type === "longtext");
    });
    qs(month, "analisa").forEach(function (q) { pair(q, ans(r, q.code), "qa-text", true); });
    return box;
  }

  function table(month, rows, showBranch) {
    var w = widget("w-full", "Murabbi", "Klik nama untuk jawapan penuh");
    var cols = [{ label: "Nama", get: function (r) { return properName(r.nama); }, text: true }];
    if (showBranch) cols.push({ label: "Cawangan", get: function (r) { return branchName(branchKey(r)); }, text: true });
    numberCols(month).forEach(function (q) { cols.push({ label: q.label, code: q.code }); });
    var hasActions = qs(month, "tindakan", "yesno").length > 0;
    if (hasActions) cols.push({ label: "Tindakan", get: function (r) { return actionScore(month, r); } });
    var firstProgress = cols.findIndex(function (c) { return qs(month, "progress").length && c.code === qs(month, "progress")[0].code; });
    var sort = { col: firstProgress > -1 ? firstProgress : 0, dir: firstProgress > -1 ? -1 : 1 };

    var wrap = el("div", "tbl-wrap");
    var tbl = el("table", "mtable" + (cols.length > 8 ? " wide" : ""));
    var thead = el("thead"), tbody = el("tbody");
    var headRow = el("tr");
    cols.forEach(function (c, ci) {
      var th = el("th", c.text ? "" : "num");
      var b = el("button", "sort", c.label);
      b.type = "button";
      b.addEventListener("click", function () {
        sort.dir = sort.col === ci ? -sort.dir : (c.text ? 1 : -1);
        sort.col = ci;
        draw();
      });
      th.appendChild(b);
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    tbl.appendChild(thead);
    tbl.appendChild(tbody);
    wrap.appendChild(tbl);
    w.appendChild(wrap);

    function key(c, r) { return c.get ? c.get(r) : val(r, c.code); }

    function draw() {
      tbody.textContent = "";
      headRow.querySelectorAll("th").forEach(function (th, ci) {
        th.setAttribute("aria-sort", ci === sort.col ? (sort.dir > 0 ? "ascending" : "descending") : "none");
      });
      var c = cols[sort.col];
      rows.slice().sort(function (a, b) {
        var x = key(c, a), y = key(c, b);
        if (x === null && y === null) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return (c.text ? String(x).localeCompare(String(y)) : x - y) * sort.dir;
      }).forEach(function (r) {
        var tr = el("tr", "mrow");
        var nameTd = el("td", "mname");
        var btn = el("button", "mname-btn", properName(r.nama));
        btn.type = "button";
        btn.setAttribute("aria-expanded", "false");
        nameTd.appendChild(btn);
        tr.appendChild(nameTd);
        if (showBranch) tr.appendChild(el("td", "muted", branchName(branchKey(r))));
        numberCols(month).forEach(function (q) { tr.appendChild(cell(r, q.code)); });
        if (hasActions) tr.appendChild(el("td", "num", actionScore(month, r) + "/" + qs(month, "tindakan", "yesno").length));
        var dr = el("tr", "mdetail");
        dr.hidden = true;
        var td = el("td");
        td.colSpan = cols.length;
        td.appendChild(detail(month, r));
        dr.appendChild(td);
        btn.addEventListener("click", function () {
          dr.hidden = !dr.hidden;
          btn.setAttribute("aria-expanded", dr.hidden ? "false" : "true");
          tr.classList.toggle("open", !dr.hidden);
        });
        tbody.appendChild(tr);
        tbody.appendChild(dr);
      });
    }
    draw();
    return w;
  }

  function analysis(month, m) {
    var items = m.answered;
    var w = widget("w-full", "Analisa Murabbi", items.length + " jawapan");
    var chips = el("div", "theme-chips");
    var list = el("div", "quotes");
    var filters = [{ label: "Semua", re: null }].concat(THEMES);
    var current = 0;

    function draw() {
      list.textContent = "";
      var f = filters[current];
      items.filter(function (r) { return !f.re || f.re.test(analysisText(month, r)); }).forEach(function (r) {
        var q = el("figure", "quote");
        q.appendChild(el("blockquote", null, analysisText(month, r)));
        q.appendChild(el("figcaption", null, properName(r.nama) + " · " + branchName(branchKey(r))));
        list.appendChild(q);
      });
      Array.prototype.forEach.call(chips.children, function (b, i) {
        b.setAttribute("aria-pressed", i === current ? "true" : "false");
      });
    }

    filters.forEach(function (f, i) {
      var n = f.re ? items.filter(function (r) { return f.re.test(analysisText(month, r)); }).length : items.length;
      var b = el("button", "theme-chip", f.label + " · " + n);
      b.type = "button";
      b.addEventListener("click", function () { current = i; draw(); });
      chips.appendChild(b);
    });
    w.appendChild(chips);
    w.appendChild(list);
    w.appendChild(el("p", "w-foot", "Tema dikesan melalui kata kunci dalam jawapan; satu jawapan boleh masuk lebih dari satu tema."));
    draw();
    return w;
  }

  // Branch comparison: one row per cawangan, one column per summary figure.
  function branchCols(month) {
    var cols = [{ label: "Murabbi", get: function (m) { return String(m.n); } }];
    qs(month, "kekerapan").forEach(function (q, i) {
      cols.push({ label: "Purata " + q.label.toLowerCase(), get: function (m) { return m.freq[i].avg === null ? "–" : fmt(m.freq[i].avg); } });
    });
    qs(month, "purata").forEach(function (q, i) {
      cols.push({ label: "Purata " + q.label.toLowerCase(), get: function (m) { return (m.avgs[i].approx ? "≥" : "") + fmt(m.avgs[i].avg); } });
    });
    qs(month, "progress").forEach(function (q, i) {
      cols.push({ label: q.label, get: function (m) { return String(m.progress[i].total); } });
    });
    qs(month, "jumlah").forEach(function (q, i) {
      if (q.type === "number") cols.push({ label: q.label, get: function (m) { return String(m.totals[i].total); } });
    });
    return cols;
  }

  function branchTable(month, onPick) {
    var keys = branches(month);
    var cols = branchCols(month);
    var w = widget("w-full", "Mengikut Cawangan", keys.length + " cawangan · klik untuk lihat");
    var wrap = el("div", "tbl-wrap");
    var tbl = el("table", "mtable");
    var head = el("tr");
    head.appendChild(el("th", "", "Cawangan"));
    cols.forEach(function (c) { head.appendChild(el("th", "num", c.label)); });
    var thead = el("thead");
    thead.appendChild(head);
    tbl.appendChild(thead);
    var tbody = el("tbody");
    keys.forEach(function (k) {
      var m = metrics(month, rowsFor(month, k));
      var tr = el("tr", "mrow");
      var td = el("td", "mname");
      var b = el("button", "mname-btn", branchName(k));
      b.type = "button";
      b.addEventListener("click", function () { onPick(k); });
      td.appendChild(b);
      tr.appendChild(td);
      cols.forEach(function (c) { tr.appendChild(el("td", "num", c.get(m))); });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    wrap.appendChild(tbl);
    w.appendChild(wrap);
    return w;
  }

  function renderView(body, meta, month, branch, onPick) {
    var rows = rowsFor(month, branch);
    var m = metrics(month, rows);
    body.textContent = "";
    meta.textContent = branch === ALL
      ? "Semua cawangan · " + branches(month).length + " cawangan · " + m.n + " murabbi"
      : "Cawangan " + branchName(branch) + " · " + m.n + " murabbi";

    if (!month.rows.length) {
      var empty = el("div", "empty");
      empty.appendChild(el("p", "empty-title", "Belum ada laporan"));
      empty.appendChild(el("p", "empty-text", "Belum ada murabbi menghantar laporan " + month.label + "."));
      body.appendChild(empty);
      return;
    }

    var grid = el("div", "dash-grid");
    stats(month, m, branch).forEach(function (s, i) { grid.appendChild(stat(s, i === 0)); });

    if (m.progress.length || m.totals.length) {
      var funnel = widget("w-2", "Progress Pengumpulan", "Jumlah semua murabbi");
      var bars = el("div", "hbars");
      m.progress.forEach(function (s, i) {
        bars.appendChild(hbar(s.q.label, s.total, m.base, i && m.base ? s.pct + "%" : ""));
      });
      funnel.appendChild(bars);
      m.totals.forEach(function (t) {
        if (t.options) {
          t.options.forEach(function (o) {
            var row = el("div", "w-split");
            row.appendChild(el("span", null, t.q.label + ": " + o.label));
            row.appendChild(el("strong", null, String(o.count)));
            funnel.appendChild(row);
          });
          return;
        }
        var row = el("div", "w-split");
        row.appendChild(el("span", null, t.q.label));
        row.appendChild(el("strong", null, String(t.total)));
        funnel.appendChild(row);
      });
      var foot = funnelNote(m);
      if (foot) funnel.appendChild(el("p", "w-foot", foot.trim()));
      grid.appendChild(funnel);
    }

    if (m.actions.length) {
      var practice = widget("w-2", "Tindakan", "Daripada " + m.n + " murabbi");
      var pbars = el("div", "hbars");
      m.actions.forEach(function (p) { pbars.appendChild(hbar(p.label, p.count, m.n)); });
      practice.appendChild(pbars);
      grid.appendChild(practice);
    }

    if (branch === ALL && branches(month).length > 1) grid.appendChild(branchTable(month, onPick));
    grid.appendChild(table(month, rows, branch === ALL));
    if (qs(month, "analisa").length) grid.appendChild(analysis(month, m));

    body.appendChild(grid);
    body.appendChild(el("p", "report-source", "Sumber: " + month.source + (month.note ? " — " + month.note : "")));
  }

  // ---------- Slides ----------
  function statSlides(month, m, branch) {
    return stats(month, m, branch).slice(0, 4).map(function (s) {
      var note = s.note;
      if (s.dist) {
        var parts = s.dist.map(function (x) { return x.label + ": " + x.count; });
        note = (s.value === "–" ? "" : "Purata seorang\n") + parts.slice(0, 3).join("  ·  ") +
          (parts.length > 3 ? "\n" + parts.slice(3).join("  ·  ") : "");
      }
      return { label: s.label, value: s.value, note: note };
    });
  }

  function deck(month, branch) {
    branch = branch || ALL;
    var rows = rowsFor(month, branch);
    var m = metrics(month, rows);
    var where = branch === ALL ? "Semua cawangan" : "Cawangan " + branchName(branch);
    var sub = month.label + " · " + where;
    var slides = [];

    var progressRows = m.progress.map(function (s, i) {
      return { label: s.q.label, value: s.total, max: m.base, text: s.total + (i ? "  ·  " + s.pct + "%" : "") };
    }).concat(m.totals.filter(function (t) { return !t.options; }).map(function (t) {
      return { label: t.q.label, value: t.total, max: m.base || t.total, text: String(t.total) };
    }));
    slides.push({
      type: "summary",
      title: "Laporan Unit Murabbi",
      subtitle: sub,
      chartTitle: "Progress pengumpulan",
      chartMeta: "Jumlah " + m.n + " murabbi",
      rows: progressRows.length ? progressRows : [{ label: "Laporan diterima", value: m.n, max: m.n, text: String(m.n) }],
      foot: funnelNote(m).trim(),
      stats: statSlides(month, m, branch)
    });

    if (branch === ALL && branches(month).length > 1) {
      var keys = branches(month);
      var cols = branchCols(month).slice(0, 7);
      slides.push({
        type: "table",
        title: "Mengikut Cawangan",
        subtitle: month.label,
        strip: [["Bulan", month.label], ["Jumlah", keys.length + " cawangan · " + m.n + " murabbi"]],
        columns: ["Cawangan"].concat(cols.map(function (c) { return title(c.label); })),
        rows: keys.map(function (k) {
          var b = metrics(month, rowsFor(month, k));
          return [branchName(k)].concat(cols.map(function (c) { return c.get(b); }));
        }),
        foot: "Jumlah dan purata dikira daripada jawapan bernombor sahaja."
      });
    }

    if (m.actions.length) {
      slides.push({
        type: "bars",
        title: "Tindakan Murabbi",
        subtitle: "Bilangan murabbi yang melaksanakan setiap tindakan · " + where,
        chartTitle: "Tindakan",
        chartMeta: "Daripada " + m.n + " murabbi · " + month.label,
        rows: m.actions.map(function (p) { return { label: p.label, value: p.count, max: m.n, text: p.count + " / " + m.n }; }),
        foot: "Disusun daripada tindakan paling banyak dibuat."
      });
    }

    // Per-murabbi tables only for one branch; all branches together would run to many slides.
    if (branch !== ALL && rows.length) {
      var numCols = numberCols(month).slice(0, 6);
      var hasActions = qs(month, "tindakan", "yesno").length > 0;
      var first = qs(month, "progress")[0];
      var ranked = rows.slice().sort(function (a, b) {
        if (!first) return properName(a.nama).localeCompare(properName(b.nama));
        var x = val(a, first.code), y = val(b, first.code);
        return (y === null ? -1 : y) - (x === null ? -1 : x);
      });
      var per = 9, pages = Math.ceil(ranked.length / per);
      for (var p = 0; p < pages; p++) {
        slides.push({
          type: "table",
          title: "Prestasi Murabbi" + (pages > 1 ? " (" + (p + 1) + "/" + pages + ")" : ""),
          subtitle: sub,
          strip: [["Bulan", month.label + " · " + m.n + " murabbi"],
            ["Susunan", first ? title(first.label) + ", tertinggi dahulu" : "Nama"]],
          columns: ["Nama"].concat(numCols.map(function (q) { return q.label; })).concat(hasActions ? ["Tindakan"] : []),
          rows: ranked.slice(p * per, (p + 1) * per).map(function (r) {
            return [properName(r.nama)].concat(numCols.map(function (q) {
              var x = num(ans(r, q.code));
              return x ? x.v + (x.approx ? "+" : "") : "–";
            })).concat(hasActions ? [actionScore(month, r) + "/" + qs(month, "tindakan", "yesno").length] : []);
          }),
          foot: "– = tiada jawapan bernombor."
        });
      }
    }

    if (qs(month, "analisa").length) {
      var groups = m.themes.concat([{ label: "Lain-lain", rows: m.unthemed }]);
      slides.push({
        type: "cards",
        title: "Analisa Murabbi",
        subtitle: m.answered.length + " jawapan · " + sub,
        cards: groups.map(function (g) {
          return {
            title: g.label + " · " + g.rows.length,
            lines: g.rows.slice(0, 3).map(function (r) {
              return {
                text: "“" + clip(analysisText(month, r), 80) + "”",
                by: shortName(r.nama) + (branch === ALL ? " · " + branchName(branchKey(r)) : "")
              };
            }),
            more: g.rows.length > 3 ? "+" + (g.rows.length - 3) + " lagi" : ""
          };
        }),
        foot: "Tema dikesan melalui kata kunci; satu jawapan boleh masuk lebih dari satu tema."
      });
    }

    return {
      fileName: "Unit Murabbi - " + month.label + " - " + (branch === ALL ? "Semua Cawangan" : branchName(branch)),
      footer: "Yosh Junior · Unit Murabbi · Sumber: " + month.source,
      slides: slides
    };
  }

  // ---------- Tab ----------
  function store(key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) {}
    return null;
  }

  function formLink() {
    var url = new URL("borang.html", location.href).href;
    var box = el("div", "form-link");
    var a = el("a", "link-btn", "Buka borang ↗");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener";
    box.appendChild(a);
    var copy = el("button", "link-btn", "Salin pautan borang");
    copy.type = "button";
    copy.addEventListener("click", function () {
      var done = function () { copy.textContent = "Pautan disalin"; setTimeout(function () { copy.textContent = "Salin pautan borang"; }, 2000); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { window.prompt("Salin pautan ini:", url); });
      else window.prompt("Salin pautan ini:", url);
    });
    box.appendChild(copy);
    return box;
  }

  function render(panel) {
    panel.classList.add("dash");
    var host = el("div");
    panel.appendChild(host);

    function picker(text) {
      var label = el("label", "month-pick");
      label.appendChild(el("span", null, text));
      var select = el("select");
      label.appendChild(select);
      return { label: label, select: select };
    }

    function build() {
      host.textContent = "";
      var bar = el("div", "report-bar");
      var meta = el("p", "report-meta");
      bar.appendChild(meta);
      host.appendChild(bar);
      host.appendChild(formLink());

      if (state.loading) {
        meta.textContent = "Memuatkan laporan terkini…";
      }
      if (state.error) {
        host.appendChild(el("p", "report-warning", "Tidak dapat memuatkan laporan terkini daripada borang (" + state.error +
          "). Memaparkan data yang tersimpan sahaja."));
      }
      if (!state.months.length) {
        if (!state.loading) {
          var empty = el("div", "empty");
          empty.appendChild(el("p", "empty-title", "Belum ada laporan"));
          empty.appendChild(el("p", "empty-text", "Laporan bulanan Unit Murabbi akan dipaparkan di sini selepas murabbi mengisi borang."));
          host.appendChild(empty);
        }
        return;
      }

      var body = el("div");
      var month = picker("Bulan");
      state.months.forEach(function (m) {
        var o = el("option", null, m.label + (m.live ? "" : " (PDF)"));
        o.value = m.id;
        month.select.appendChild(o);
      });
      var savedMonth = store("murabbiMonth");
      if (savedMonth && byId(savedMonth)) month.select.value = savedMonth;

      var branch = picker("Cawangan");
      function fillBranches(keep) {
        var m = byId(month.select.value);
        branch.select.textContent = "";
        var all = el("option", null, "Semua cawangan (keseluruhan)");
        all.value = ALL;
        branch.select.appendChild(all);
        branches(m).forEach(function (k) {
          var o = el("option", null, branchName(k) + " · " + rowsFor(m, k).length);
          o.value = k;
          branch.select.appendChild(o);
        });
        branch.select.value = keep && branches(m).indexOf(keep) > -1 ? keep : ALL;
      }

      function draw() {
        renderView(body, meta, byId(month.select.value), branch.select.value, function (k) {
          branch.select.value = k;
          store("murabbiBranch", k);
          draw();
          bar.scrollIntoView({ block: "start", behavior: "smooth" });
        });
      }

      fillBranches(store("murabbiBranch"));
      month.select.addEventListener("change", function () {
        store("murabbiMonth", month.select.value);
        fillBranches(branch.select.value);
        draw();
      });
      branch.select.addEventListener("change", function () {
        store("murabbiBranch", branch.select.value);
        draw();
      });

      var tools = el("div", "report-tools");
      tools.appendChild(month.label);
      tools.appendChild(branch.label);
      if (window.YoshSlides) {
        tools.appendChild(window.YoshSlides.button(function () { return deck(byId(month.select.value), branch.select.value); }));
      }
      bar.appendChild(tools);
      host.appendChild(body);
      draw();
    }

    listeners.push(build);
    build();
  }

  function byId(id) { return state.months.filter(function (m) { return m.id === id; })[0]; }

  window.UNIT_VIEWS = window.UNIT_VIEWS || {};
  window.UNIT_VIEWS.murabbi = {
    render: render,
    count: function () { return state.months.length; },
    describe: function () { return state.months.length + " laporan bulanan"; },
    deck: function (id, branch) { return deck(byId(id) || state.months[0], branch); }
  };
})();
