/**
 * Yosh Junior · Unit Legality — Google Apps Script behind legality.html (the user form).
 *
 * Each cawangan has its own "Checklist Legality" Google Sheet with the same layout:
 *   - one tab per school (made by duplicating the "Nama Sekolah *Duplicate" template tab)
 *   - "Senarai Sekolah" tab listing the school tabs (CRM + Program summaries read from it)
 * This script reads and writes the school tabs directly, so the sheets stay exactly as the team knows them.
 *
 * Which sheet belongs to which cawangan is kept in Script Properties (key SHEETS).
 * Setup steps: backend/legality/README.md
 */

var CAWANGAN = ["TENGAH", "UTARA", "PT", "INDONESIA", "BORNEO", "MEA"];
var TENGAH_SHEET_ID = "1xrAVOswvIrRmmrmPaywzdKPEijJXYUiGkQujr9TfFUs";
var TEMPLATE = "Nama Sekolah *Duplicate";
var LIST_TAB = "Senarai Sekolah";

// Column numbers in a school tab.
var COL = { A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, KPI: 8, KPI_N: 23, KPI_DATE: 11, KPI_CHECK: 14, LAST: 30 };

// Editable columns per section, in the order sent to the form.
var SECTIONS = {
  crm:      { cols: [2, 3, 4, 5, 6, 7].concat(range_(8, 30)) },   // B..AD
  alumni:   { cols: [2] },                                          // B (merged B:G)
  program:  { cols: [1, 2, 3, 4, 7] },                              // Nama, Tarikh, Niche, Penglibatan, Reporting
  analisa:  { cols: [1] },                                          // A (merged A:G)
  planning: { cols: [1, 2] },                                       // label (read-only), value
  modul:    { cols: [1, 2, 3, 4] },                                 // Nama, Tarikh, Niche, Short brief
  peluang:  { cols: [1, 2, 3] }                                     // Peluang, Tarikh, Permanfaatan
};
var CHECKBOX_COLS = { crm: [3].concat(range_(14, 30)), program: [7] };
var DATE_COLS = { crm: [11] };

// Progress Legality: one row per school in the "Progress" tab of each cawangan sheet.
var PROGRESS_TAB = "Progress";
var PROGRESS_ITEMS = [
  { key: "meeting",   short: "Set meeting",      label: "Menetapkan tarikh meeting dengan pihak sekolah" },
  { key: "bentang",   short: "Pembentangan",     label: "Pembentangan: 1. Program 2026, 2. Dapatkan persetujuan kolaborasi program 2027" },
  { key: "surat",     short: "Surat kerjasama",  label: "Dapatkan surat kerjasama program dan surat kebenaran masuk" },
  { key: "mentoring", short: "Tarikh mentoring", label: "Pemastian tarikh mentoring" },
  { key: "entrance",  short: "Entrance survey",  label: "Pelaksanaan entrance survey" },
  { key: "exit",      short: "Exit survey",      label: "Pelaksanaan exit survey" }
];

function range_(a, b) { var r = []; for (var i = a; i <= b; i++) r.push(i); return r; }

// ---------- Web app entry points ----------

// Every request must carry an access code kept in Script Properties:
//   KOD_AKSES – user portal code (cawangan members)
//   KOD_ADMIN – admin code; works everywhere, and is the only code allowed to read the admin summary
// Change them in Project Settings → Script properties (or setKodAkses() / setKodAdmin()).
function checkKod(kod) {
  var props = PropertiesService.getScriptProperties();
  var user = props.getProperty("KOD_AKSES"), admin = props.getProperty("KOD_ADMIN");
  if (!user && !admin) throw new Error("Kod akses belum ditetapkan oleh pentadbir.");
  var k = text(kod);
  if (admin && k === admin) return "admin";
  if (user && k === user) return "user";
  throw new Error("KOD_SALAH");
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    var role = checkKod(p.kod);
    if (p.action === "ping") return json({ ok: true, role: role });
    if (p.action === "cawangan") return json(listCawangan());
    if (p.action === "schools") return json(listSchools(p.cawangan));
    if (p.action === "school") return json(readSchool(p.cawangan, p.sekolah));
    if (p.action === "summary") {
      if (role !== "admin") throw new Error("KOD_SALAH");
      return json(summary(p.fresh === "1"));
    }
    return json({ error: "Tindakan tidak dikenali: " + p.action });
  } catch (err) {
    return json({ error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse(e.postData.contents);
    checkKod(body.kod);
    lock.waitLock(20000);
    if (body.action === "save") return json(saveSection(body));
    if (body.action === "addSchool") return json(addSchool(body.cawangan, body.sekolah));
    if (body.action === "saveProgress") return json(saveProgress(body));
    return json({ error: "Tindakan tidak dikenali: " + body.action });
  } catch (err) {
    return json({ error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Sheets per cawangan ----------

function sheetMap() {
  var raw = PropertiesService.getScriptProperties().getProperty("SHEETS");
  var map = raw ? JSON.parse(raw) : {};
  if (!map.TENGAH) map.TENGAH = TENGAH_SHEET_ID;
  return map;
}

function book(cawangan) {
  var c = text(cawangan).toUpperCase();
  if (CAWANGAN.indexOf(c) < 0) throw new Error("Cawangan tidak dikenali: " + cawangan);
  var id = sheetMap()[c];
  if (!id) throw new Error("Sheet untuk cawangan " + c + " belum disediakan. Hubungi pentadbir Unit Legality.");
  return SpreadsheetApp.openById(id);
}

function text(v) { return String(v == null ? "" : v).trim(); }

function listCawangan() {
  var map = sheetMap();
  return { cawangan: CAWANGAN.map(function (c) { return { id: c, ready: !!map[c] }; }) };
}

function schoolNames(ss) {
  var list = ss.getSheetByName(LIST_TAB);
  if (!list || list.getLastRow() < 2) return [];
  return list.getRange(2, 1, list.getLastRow() - 1, 1).getValues()
    .map(function (r) { return text(r[0]); })
    .filter(function (n) { return n && ss.getSheetByName(n); });
}

function listSchools(cawangan) {
  var ss = book(cawangan);
  var prog = {};
  var psh = ss.getSheetByName(PROGRESS_TAB);
  if (psh && psh.getLastRow() >= 2) {
    psh.getRange(2, 1, psh.getLastRow() - 1, PROGRESS_ITEMS.length + 1).getValues().forEach(function (r) {
      if (text(r[0])) prog[text(r[0])] = r.slice(1).filter(function (v) { return v === true; }).length;
    });
  }
  var schools = schoolNames(ss).map(function (n) {
    var sh = ss.getSheetByName(n);
    var m = markers(sh);
    var rows = sh.getRange(3, COL.B, m.crmEnd - 2, 3).getValues(); // B, C, D
    var people = rows.filter(function (r) { return r[1] === true || text(r[2]); }).length;
    return { name: n, people: people, progress: prog[n] || 0 };
  });
  return { cawangan: text(cawangan).toUpperCase(), schools: schools, steps: PROGRESS_ITEMS.length };
}

// ---------- Layout of a school tab ----------

// Finds the section title rows by the text in column A.
function markers(sh) {
  var n = Math.min(sh.getMaxRows(), 400);
  var a = sh.getRange(1, 1, n, 1).getDisplayValues().map(function (r) { return text(r[0]).toLowerCase(); });
  function find(prefix, from) {
    for (var i = (from || 2); i < a.length; i++) if (a[i].indexOf(prefix) === 0) return i + 1;
    return 0;
  }
  var alumni = find("alumni sekolah");
  if (!alumni) throw new Error("Tab '" + sh.getName() + "' tidak ikut format sekolah (tiada 'Alumni Sekolah').");
  var program = find("program yang telah", alumni);
  var analisa = find("analisa situasi", program);
  var planning = find("planning legality", analisa);
  var modul = find("modul program", planning);
  var peluang = find("peluang lain", modul);
  // Peluang rows run to the last row that has anything in A:G.
  var last = peluang + 2;
  var vals = sh.getRange(1, 1, n, 7).getDisplayValues();
  for (var i = peluang + 1; i < n; i++) {
    if (vals[i].some(function (v) { return text(v) !== ""; })) last = i + 1;
  }
  return {
    crmEnd: alumni - 1, alumni: alumni, program: program, analisa: analisa,
    planning: planning, modul: modul, peluang: peluang, peluangEnd: Math.max(last, peluang + 2)
  };
}

// Row numbers that belong to each section.
function sectionRows(sh, key, m) {
  m = m || markers(sh);
  switch (key) {
    case "crm": return range_(3, m.crmEnd);
    case "alumni": return [m.alumni + 1];
    case "program": return range_(m.program + 2, m.analisa - 1);
    case "analisa": return [m.analisa + 1];
    case "planning": return range_(m.planning + 1, m.modul - 1);
    case "modul": return range_(m.modul + 2, m.peluang - 1);
    case "peluang": return range_(m.peluang + 2, m.peluangEnd);
  }
  throw new Error("Bahagian tidak dikenali: " + key);
}

function isCheckbox(key, c) { return (CHECKBOX_COLS[key] || []).indexOf(c) > -1; }
function isDate(key, c) { return (DATE_COLS[key] || []).indexOf(c) > -1; }

function iso(d) { return Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd"); }

// The comparable form of a cell: booleans for checkboxes, yyyy-mm-dd for dates, shown text otherwise.
function cellValue(key, c, raw, shown) {
  if (isCheckbox(key, c)) return raw === true;
  if (isDate(key, c)) return raw instanceof Date ? iso(raw) : text(shown);
  return text(shown);
}

function readSection(sh, key, m) {
  var rows = sectionRows(sh, key, m);
  var cols = SECTIONS[key].cols;
  if (!rows.length) return { rows: [] };
  var first = rows[0], n = rows.length;
  var raw = sh.getRange(first, 1, n, COL.LAST).getValues();
  var shown = sh.getRange(first, 1, n, COL.LAST).getDisplayValues();
  // Cells hidden inside a merge (not its top-left) cannot be edited.
  var hidden = {};
  sh.getRange(first, 1, n, COL.LAST).getMergedRanges().forEach(function (mr) {
    for (var r = mr.getRow(); r <= mr.getLastRow(); r++)
      for (var c = mr.getColumn(); c <= mr.getLastColumn(); c++)
        if (r !== mr.getRow() || c !== mr.getColumn()) hidden[r + ":" + c] = true;
  });
  var out = rows.map(function (r, i) {
    return {
      r: r,
      v: cols.map(function (c) { return cellValue(key, c, raw[i][c - 1], shown[i][c - 1]); }),
      lock: cols.map(function (c) { return !!hidden[r + ":" + c]; })
    };
  });
  if (key === "crm") {
    // Priority group (High / Low) from column A, which is merged per group.
    var group = "";
    var aShown = sh.getRange(first, 1, n, 1).getDisplayValues();
    out.forEach(function (row, i) {
      var g = text(aShown[i][0]);
      if (g) group = /low/i.test(g) ? "Low" : /high/i.test(g) ? "High" : g;
      row.group = group;
    });
  }
  return { rows: out };
}

function listOptions(cell) {
  var dv = cell.getDataValidation();
  if (!dv) return [];
  var t = dv.getCriteriaType();
  var v = dv.getCriteriaValues();
  if (t === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST) return v[0].map(text).filter(String);
  if (t === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
    return v[0].getDisplayValues().map(function (r) { return text(r[0]); }).filter(String);
  }
  return [];
}

function readSchool(cawangan, sekolah) {
  var ss = book(cawangan);
  var sh = ss.getSheetByName(text(sekolah));
  if (!sh || schoolNames(ss).indexOf(text(sekolah)) < 0) throw new Error("Sekolah tidak dijumpai: " + sekolah);
  var m = markers(sh);
  var data = { cawangan: text(cawangan).toUpperCase(), sekolah: sh.getName(), sections: {} };
  Object.keys(SECTIONS).forEach(function (k) { data.sections[k] = readSection(sh, k, m); });
  // Labels and dropdown choices for the KPI part.
  var head = sh.getRange(2, COL.KPI, 1, COL.KPI_N).getDisplayValues()[0].map(text);
  var entitiOpts = {};
  sectionRows(sh, "crm", m).forEach(function (r) {
    listOptions(sh.getRange(r, COL.B)).forEach(function (o) { entitiOpts[o] = 1; });
  });
  data.kpi = {
    headers: head,
    kategori: listOptions(sh.getRange(3, COL.KPI)),
    phase: listOptions(sh.getRange(3, COL.KPI + 1)),
    level: listOptions(sh.getRange(3, COL.KPI + 2)),
    entiti: Object.keys(entitiOpts)
  };
  data.progress = { items: PROGRESS_ITEMS, values: readProgress(ss, sh.getName()) };
  return data;
}

// ---------- Progress Legality ----------

// The "Progress" tab: Sekolah | 6 milestones (checkboxes) | Dikemas kini. Made on first use.
function progressSheet(ss) {
  var sh = ss.getSheetByName(PROGRESS_TAB);
  var n = PROGRESS_ITEMS.length;
  if (!sh) {
    sh = ss.insertSheet(PROGRESS_TAB, Math.min(3, ss.getSheets().length));
    var head = ["Sekolah"].concat(PROGRESS_ITEMS.map(function (it) { return it.label.toUpperCase(); }), ["Dikemas kini"]);
    sh.getRange(1, 1, 1, head.length).setValues([head])
      .setBackground("#0b47a1").setFontColor("#ffffff").setFontWeight("bold").setFontSize(10)
      .setWrap(true).setVerticalAlignment("top");
    sh.setRowHeight(1, 110);
    sh.setColumnWidth(1, 160);
    sh.setColumnWidths(2, n, 150);
    sh.setColumnWidth(n + 2, 140);
    sh.setFrozenRows(1);
    sh.setFrozenColumns(1);
    var body = sh.getRange(2, 2, 300, n);
    body.insertCheckboxes();
    var rules = sh.getConditionalFormatRules();
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=AND($A2<>\"\",B2=TRUE)")
      .setBackground("#00e000").setFontColor("#00e000").setRanges([body]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied("=AND($A2<>\"\",B2=FALSE)")
      .setBackground("#ff0000").setFontColor("#ff0000").setRanges([body]).build());
    sh.setConditionalFormatRules(rules);
    sh.getRange(2, 1, 300, n + 2).setBorder(true, true, true, true, true, true, "#b7b7b7", SpreadsheetApp.BorderStyle.SOLID);
    sh.getRange(2, 1, 300, 1).setFontSize(12);
    sh.getRange(2, n + 2, 300, 1).setNumberFormat("d mmm yyyy h:mm").setFontColor("#666666");
  }
  return sh;
}

// Row of a school in the Progress tab; adds one when asked.
function progressRow(ss, school, create) {
  var sh = progressSheet(ss);
  var last = sh.getLastRow();
  if (last >= 2) {
    var names = sh.getRange(2, 1, last - 1, 1).getValues().map(function (r) { return text(r[0]); });
    var i = names.indexOf(school);
    if (i > -1) return { sh: sh, r: i + 2 };
    // reuse the first empty name cell
    var blank = names.indexOf("");
    if (create && blank > -1) { sh.getRange(blank + 2, 1).setValue(school); return { sh: sh, r: blank + 2 }; }
  }
  if (!create) return { sh: sh, r: 0 };
  var r = Math.max(last, 1) + 1;
  sh.getRange(r, 1).setValue(school);
  return { sh: sh, r: r };
}

function readProgress(ss, school) {
  var p = progressRow(ss, school, false);
  if (!p.r) return PROGRESS_ITEMS.map(function () { return false; });
  return p.sh.getRange(p.r, 2, 1, PROGRESS_ITEMS.length).getValues()[0].map(function (v) { return v === true; });
}

// body: { cawangan, sekolah, values: [bool x6], old: [bool x6] }
function saveProgress(body) {
  var ss = book(body.cawangan);
  var school = text(body.sekolah);
  if (schoolNames(ss).indexOf(school) < 0) throw new Error("Sekolah tidak dijumpai: " + school);
  var p = progressRow(ss, school, true);
  var range = p.sh.getRange(p.r, 2, 1, PROGRESS_ITEMS.length);
  var now = range.getValues()[0].map(function (v) { return v === true; });
  var vals = (body.values || []).map(function (v) { return v === true; });
  var old = (body.old || []).map(function (v) { return v === true; });
  var changed = false;
  var out = now.map(function (cur, i) {
    if (vals[i] === cur) return cur;
    if (old[i] !== cur) throw new Error("Ada orang lain telah mengemas kini progress ini. Muat semula halaman dan cuba lagi.");
    changed = true;
    return vals[i];
  });
  if (changed) {
    range.setValues([out]);
    p.sh.getRange(p.r, PROGRESS_ITEMS.length + 2).setValue(new Date());
    CacheService.getScriptCache().remove("summary");
  }
  return { ok: true, values: out };
}

// ---------- Admin summary (all cawangan) ----------

/** Everything the admin dashboard needs, for every cawangan. Cached 10 minutes. */
function summary(fresh) {
  var cache = CacheService.getScriptCache();
  if (!fresh) {
    var hit = cache.get("summary");
    if (hit) return JSON.parse(hit);
  }
  var map = sheetMap();
  var out = { items: PROGRESS_ITEMS, generated: new Date().toISOString(), cawangan: [] };
  CAWANGAN.forEach(function (c) {
    if (!map[c]) { out.cawangan.push({ id: c, ready: false, schools: [] }); return; }
    var ss = SpreadsheetApp.openById(map[c]);
    var prog = {};
    var psh = ss.getSheetByName(PROGRESS_TAB);
    if (psh && psh.getLastRow() >= 2) {
      psh.getRange(2, 1, psh.getLastRow() - 1, PROGRESS_ITEMS.length + 1).getValues().forEach(function (r) {
        if (text(r[0])) prog[text(r[0])] = r.slice(1).map(function (v) { return v === true; });
      });
    }
    var schools = schoolNames(ss).map(function (n) {
      var sh = ss.getSheetByName(n);
      var m = markers(sh);
      var crm = sh.getRange(3, 1, m.crmEnd - 2, COL.LAST).getValues();
      var people = 0, aktif = 0, phase = {}, kategori = {}, checks = 0;
      crm.forEach(function (r) {
        var named = text(r[3]) !== "";
        if (!named && r[2] !== true) return;
        people++;
        if (r[2] === true) aktif++;
        var ph = text(r[COL.KPI]);       // I = Phase (KPI col + 1, zero-based KPI index is 8)
        var kt = text(r[COL.KPI - 1]);   // H = Kategori
        if (ph) phase[ph] = (phase[ph] || 0) + 1;
        if (kt) kategori[kt] = (kategori[kt] || 0) + 1;
        for (var c2 = COL.KPI_CHECK - 1; c2 < COL.LAST; c2++) if (r[c2] === true) checks++;
      });
      var pRows = sectionRows(sh, "program", m);
      var programs = pRows.length ? sh.getRange(pRows[0], 1, pRows.length, 1).getValues()
        .filter(function (r) { return text(r[0]) !== ""; }).length : 0;
      return {
        name: n, people: people, aktif: aktif, phase: phase, kategori: kategori, checks: checks,
        programs: programs, progress: prog[n] || PROGRESS_ITEMS.map(function () { return false; })
      };
    });
    out.cawangan.push({ id: c, ready: true, url: ss.getUrl(), schools: schools });
  });
  try { cache.put("summary", JSON.stringify(out), 600); } catch (e) {}
  return out;
}

// ---------- Saving ----------

// Stops answers like "=IMPORTXML(...)" from being run as a formula in the sheet.
function safe(v) {
  var s = String(v == null ? "" : v).slice(0, 5000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function toCell(key, c, v) {
  if (isCheckbox(key, c)) return v === true;
  if (isDate(key, c)) {
    var m = text(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : "";
  }
  return safe(v);
}

function same(a, b) { return a === b || (a !== true && a !== false && b !== true && b !== false && text(a) === text(b)); }

/**
 * body: { cawangan, sekolah, section, edits: [{ r, c, old, val }], adds: [[...values in section column order]] }
 * A cell is only written if it changed. If someone else changed it since the form loaded, the save stops
 * and reports which cells, so nobody silently overwrites another person's update.
 */
function saveSection(body) {
  var key = text(body.section);
  if (!SECTIONS[key]) throw new Error("Bahagian tidak dikenali: " + key);
  if (key === "planning" && (body.adds || []).length) throw new Error("Planning tidak boleh ditambah baris.");
  var ss = book(body.cawangan);
  var sh = ss.getSheetByName(text(body.sekolah));
  if (!sh || schoolNames(ss).indexOf(text(body.sekolah)) < 0) throw new Error("Sekolah tidak dijumpai: " + body.sekolah);

  var cols = SECTIONS[key].cols;
  var current = readSection(sh, key);
  var byRow = {};
  current.rows.forEach(function (row) { byRow[row.r] = row; });

  var edits = body.edits || [];
  var conflicts = [];
  var writes = [];
  edits.forEach(function (ed) {
    var row = byRow[ed.r];
    var i = cols.indexOf(ed.c);
    if (!row || i < 0) throw new Error("Data sudah berubah (baris " + ed.r + "). Muat semula halaman.");
    if (row.lock[i]) return;
    if (key === "planning" && ed.c === 1) return; // labels are fixed
    var now = row.v[i];
    if (same(now, ed.val)) return;
    if (!same(now, ed.old)) { conflicts.push(ed.r); return; }
    writes.push({ r: ed.r, c: ed.c, val: toCell(key, ed.c, ed.val) });
  });
  if (conflicts.length) {
    throw new Error("Ada orang lain telah mengemas kini bahagian ini. Muat semula halaman dan cuba lagi.");
  }
  writes.forEach(function (w) { sh.getRange(w.r, w.c).setValue(w.val); });

  // New entries: fill empty rows of the section first, then add rows at its end.
  var adds = (body.adds || []).filter(function (vals) {
    return vals.some(function (v, i) { return v !== "" && v !== false && v != null && !(key === "crm" && i === 0); }) ||
      (key === "crm" && text(vals[0]));
  });
  if (adds.length) {
    var empty = current.rows.filter(function (row) {
      return row.v.every(function (v, i) {
        if (key === "crm" && i === 0) return true; // Entiti may be pre-filled on a blank slot
        return v === "" || v === false;
      }) && !(key === "crm" && text(row.v[0]) && row.group === "High");
    }).map(function (row) { return row.r; });
    // Prefer completely blank CRM slots (no Entiti) so pre-labelled slots stay for their role.
    if (key === "crm") {
      empty.sort(function (a, b) { return (text(byRow[a].v[0]) ? 1 : 0) - (text(byRow[b].v[0]) ? 1 : 0) || a - b; });
    }
    adds.forEach(function (vals) {
      var r = empty.shift();
      if (!r) r = insertRow(sh, key);
      cols.forEach(function (c, i) {
        if (key === "planning") return;
        var v = vals[i];
        if (v === "" || v == null) return;
        sh.getRange(r, c).setValue(toCell(key, c, v));
      });
    });
  }
  SpreadsheetApp.flush();
  CacheService.getScriptCache().remove("summary");
  return { ok: true, section: key, data: readSection(sh, key) };
}

// Adds one empty row at the end of a section, with the same look (merges, dropdowns, checkboxes) as the row above.
function insertRow(sh, key) {
  var rows = sectionRows(sh, key);
  var last = rows[rows.length - 1];
  var at;
  if (key === "crm") {
    // Insert inside the last priority group so the merged "Low Priority" label grows with it.
    sh.insertRowsAfter(last - 1, 1);
    at = last;
    sh.getRange(last + 1, 2, 1, COL.LAST - 1).copyTo(sh.getRange(at, 2, 1, COL.LAST - 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    sh.getRange(last + 1, 2, 1, COL.LAST - 1).copyTo(sh.getRange(at, 2, 1, COL.LAST - 1), SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
    sh.getRange(at, 3).setValue(false);
    sh.getRange(at, COL.KPI_CHECK, 1, COL.LAST - COL.KPI_CHECK + 1).setValue(false);
  } else {
    sh.insertRowsAfter(last, 1);
    at = last + 1;
    sh.getRange(last, 1, 1, 7).copyTo(sh.getRange(at, 1, 1, 7), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
    sh.getRange(last, 1, 1, 7).copyTo(sh.getRange(at, 1, 1, 7), SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
    if (key === "program") sh.getRange(at, 7).setValue(false);
  }
  sh.setRowHeight(at, sh.getRowHeight(key === "crm" ? last + 1 : last));
  return at;
}

// ---------- New school ----------

function addSchool(cawangan, name) {
  var ss = book(cawangan);
  var n = text(name).toUpperCase().replace(/\s+/g, " ");
  if (!n || n.length > 40) throw new Error("Nama sekolah perlu 1–40 aksara.");
  if (/['"!\[\]*?:\\\/]/.test(n)) throw new Error("Nama sekolah tidak boleh ada ' \" ! [ ] * ? : / \\");
  if (ss.getSheetByName(n)) throw new Error("Sekolah " + n + " sudah ada.");
  var tpl = ss.getSheetByName(TEMPLATE);
  if (!tpl) throw new Error("Tab template '" + TEMPLATE + "' tiada dalam sheet cawangan ini.");
  var sh = tpl.copyTo(ss).setName(n);
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(ss.getSheets().length);
  var list = ss.getSheetByName(LIST_TAB);
  list.getRange(Math.max(list.getLastRow(), 1) + 1, 1).setValue(n);
  progressRow(ss, n, true);
  CacheService.getScriptCache().remove("summary");
  SpreadsheetApp.flush();
  return { ok: true, sekolah: n };
}

// ---------- One-time setup (run from the Apps Script editor) ----------

/** Makes a copy of the TENGAH sheet for every cawangan that has none yet, emptied of TENGAH's schools. */
function setupCawanganSheets() {
  var props = PropertiesService.getScriptProperties();
  var map = sheetMap();
  var src = DriveApp.getFileById(TENGAH_SHEET_ID);
  var log = [];
  CAWANGAN.forEach(function (c) {
    if (map[c]) { log.push(c + ": sedia ada " + map[c]); return; }
    var copy = src.makeCopy("Checklist Legality - " + c);
    var ss = SpreadsheetApp.openById(copy.getId());
    schoolNames(ss).forEach(function (n) { ss.deleteSheet(ss.getSheetByName(n)); });
    var list = ss.getSheetByName(LIST_TAB);
    if (list.getLastRow() > 1) list.getRange(2, 1, list.getLastRow() - 1, 1).clearContent();
    map[c] = copy.getId();
    log.push(c + ": dibuat " + copy.getUrl());
  });
  props.setProperty("SHEETS", JSON.stringify(map));
  Logger.log(log.join("\n"));
}

/**
 * Adds the Progress tab to every cawangan sheet (one row per school) and fills TENGAH with the
 * progress shown in the "Progress Legality Sekolah" table of 7 Nov 2026. Safe to re-run: it only
 * ticks boxes, never unticks them.
 */
function setupProgress() {
  var map = sheetMap();
  var tengah = {
    "SEMASHUR": [true, true], "SMAPUTRA": [true], "KISAS": [true], "SMAPK": [true, true],
    "SAS": [true, true], "MOZAC": [true], "SMSS": [true]
  };
  CAWANGAN.forEach(function (c) {
    if (!map[c]) return;
    var ss = SpreadsheetApp.openById(map[c]);
    schoolNames(ss).forEach(function (n) {
      var p = progressRow(ss, n, true);
      if (c === "TENGAH" && tengah[n]) {
        tengah[n].forEach(function (v, i) { if (v) p.sh.getRange(p.r, 2 + i).setValue(true); });
      }
    });
  });
  CacheService.getScriptCache().remove("summary");
  Logger.log("Tab Progress sedia untuk semua cawangan.");
}

/** Rewrites the Progress tab headers in every cawangan sheet from PROGRESS_ITEMS (after a label change). */
function refreshProgressHeaders() {
  var map = sheetMap();
  CAWANGAN.forEach(function (c) {
    if (!map[c]) return;
    var sh = progressSheet(SpreadsheetApp.openById(map[c]));
    sh.getRange(1, 2, 1, PROGRESS_ITEMS.length).setValues([PROGRESS_ITEMS.map(function (it) { return it.label.toUpperCase(); })]);
  });
  CacheService.getScriptCache().remove("summary");
  Logger.log("Tajuk Progress dikemas kini.");
}

/** Sets a new random ADMIN code and prints it. Share it only with admins. */
function setKodAdmin() {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var kod = "ADM-";
  for (var i = 0; i < 6; i++) kod += chars.charAt(Math.floor(Math.random() * chars.length));
  PropertiesService.getScriptProperties().setProperty("KOD_ADMIN", kod);
  Logger.log("Kod admin baru: " + kod);
}

/** Sets a new random access code and prints it. Share it only with the team that fills the form. */
function setKodAkses() {
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var kod = "";
  for (var i = 0; i < 8; i++) kod += chars.charAt(Math.floor(Math.random() * chars.length));
  PropertiesService.getScriptProperties().setProperty("KOD_AKSES", kod);
  Logger.log("Kod akses baru: " + kod);
}

/** Prints which sheet each cawangan uses. */
function showCawanganSheets() {
  var map = sheetMap();
  Logger.log(CAWANGAN.map(function (c) {
    return c + ": " + (map[c] ? "https://docs.google.com/spreadsheets/d/" + map[c] : "(belum ada)");
  }).join("\n"));
}
