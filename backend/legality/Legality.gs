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
    if (p.action === "alumni") return json(readAlumni(p.cawangan));
    if (p.action === "cawangan") return json(listCawangan());
    if (p.action === "schools") return json(listSchools(p.cawangan));
    if (p.action === "school") return json(readSchool(p.cawangan, p.sekolah));
    if (p.action === "reminder") {
      if (role !== "admin") throw new Error("KOD_SALAH");
      return json(legalityReminder(p.cawangan));
    }
    if (p.action === "programs") {
      if (role !== "admin") throw new Error("KOD_SALAH");
      return json(listPrograms());
    }
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
    if (body.action === "saveAlumni") return json(saveAlumni(body));
    if (body.action === "uploadImage") return json(uploadImage(body));
    if (body.action === "saveProgram") return json(saveProgram(body));
    if (body.action === "savePic") return json(savePic(body));
    if (body.action === "sendReminder") {
      if (checkKod(body.kod) !== "admin") throw new Error("KOD_SALAH");
      return json(sendLegalityReminder(body));
    }
    if (body.action === "deleteImage") return json(deleteImage(body));
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
  data.images = listImages(ss, sh.getName());
  data.pic = readPic(ss, sh.getName());
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

// ---------- Alumni Back to School ----------
// Sheet "Alumni Back to School": one tab per cawangan (TENGAH, PT, UTARA, BORNEO, INDONESIA, MEA).
// Header row has BIL in B and NAMA in C; columns B..K are
// Bil | Nama | Sekolah | Jenis Sekolah | PIC Sekolah | Cawangan (Sekolah) | Negeri | Program | Progress | Reporting.

var ALUMNI_SHEET_ID = "1eeMqCQzTM1Ski-h14bgG42sZZrA4eD67gO9_ARiwyKE";
var ALUMNI_FIRST = 3, ALUMNI_LAST = 11;   // editable columns C..K (Bil in B is numbered automatically)

function alumniSheet(cawangan) {
  var c = text(cawangan).toUpperCase();
  if (CAWANGAN.indexOf(c) < 0) throw new Error("Cawangan tidak dikenali: " + cawangan);
  var sh = SpreadsheetApp.openById(ALUMNI_SHEET_ID).getSheetByName(c);
  if (!sh) throw new Error("Tab " + c + " tiada dalam sheet Alumni Back to School.");
  return sh;
}

// Header row (NAMA in column C) and the data rows below it (up to the last row with a name or any value).
function alumniLayout(sh) {
  var n = Math.min(sh.getMaxRows(), 1000);
  var c = sh.getRange(1, ALUMNI_FIRST, Math.min(n, 30), 1).getDisplayValues();
  var head = 0;
  for (var i = 0; i < c.length; i++) if (text(c[i][0]).toUpperCase() === "NAMA") { head = i + 1; break; }
  if (!head) throw new Error("Tab " + sh.getName() + " tiada baris tajuk NAMA di lajur C.");
  var vals = sh.getRange(head + 1, ALUMNI_FIRST, n - head, ALUMNI_LAST - ALUMNI_FIRST + 1).getDisplayValues();
  var last = head;
  vals.forEach(function (r, k) { if (r.some(function (v) { return text(v) !== ""; })) last = head + 1 + k; });
  return { head: head, first: head + 1, last: last };
}

// Column kinds from the first data row's validation: checkbox, list (with options) or text.
function alumniColumns(sh, L) {
  var cols = [];
  var heads = sh.getRange(L.head, ALUMNI_FIRST, 1, ALUMNI_LAST - ALUMNI_FIRST + 1).getDisplayValues()[0];
  for (var c = ALUMNI_FIRST; c <= ALUMNI_LAST; c++) {
    var cell = sh.getRange(L.first, c);
    var dv = cell.getDataValidation();
    var kind = "text", options = [];
    if (dv) {
      var t = dv.getCriteriaType();
      if (t === SpreadsheetApp.DataValidationCriteria.CHECKBOX) kind = "check";
      else if (t === SpreadsheetApp.DataValidationCriteria.VALUE_IN_LIST || t === SpreadsheetApp.DataValidationCriteria.VALUE_IN_RANGE) {
        kind = "list"; options = listOptions(cell);
      }
    }
    cols.push({ c: c, label: text(heads[c - ALUMNI_FIRST]).replace(/\s+/g, " "), kind: kind, options: options });
  }
  return cols;
}

function alumniRows(sh, L, cols) {
  if (L.last < L.first) return [];
  var n = L.last - L.first + 1, w = ALUMNI_LAST - ALUMNI_FIRST + 1;
  var raw = sh.getRange(L.first, ALUMNI_FIRST, n, w).getValues();
  var shown = sh.getRange(L.first, ALUMNI_FIRST, n, w).getDisplayValues();
  var out = [];
  for (var i = 0; i < n; i++) {
    out.push({ r: L.first + i, v: cols.map(function (col, j) { return col.kind === "check" ? raw[i][j] === true : text(shown[i][j]); }) });
  }
  return out;
}

function readAlumni(cawangan) {
  var sh = alumniSheet(cawangan);
  var L = alumniLayout(sh);
  var cols = alumniColumns(sh, L);
  return { cawangan: text(cawangan).toUpperCase(), columns: cols, rows: alumniRows(sh, L, cols) };
}

// body: { cawangan, edits: [{ r, c, old, val }], adds: [[...values for C..K]] }
function saveAlumni(body) {
  var sh = alumniSheet(body.cawangan);
  var L = alumniLayout(sh);
  var cols = alumniColumns(sh, L);
  var rows = alumniRows(sh, L, cols);
  var byRow = {};
  rows.forEach(function (row) { byRow[row.r] = row; });
  var writes = [];
  (body.edits || []).forEach(function (ed) {
    var row = byRow[ed.r], j = ed.c - ALUMNI_FIRST;
    if (!row || j < 0 || j >= cols.length) throw new Error("Data sudah berubah. Muat semula halaman.");
    var now = row.v[j];
    if (same(now, ed.val)) return;
    if (!same(now, ed.old)) throw new Error("Ada orang lain telah mengemas kini senarai ini. Muat semula halaman dan cuba lagi.");
    writes.push([ed.r, ed.c, cols[j].kind === "check" ? ed.val === true : safe(ed.val)]);
  });
  writes.forEach(function (w) { sh.getRange(w[0], w[1]).setValue(w[2]); });

  var adds = (body.adds || []).filter(function (vals) { return vals.some(function (v) { return v !== "" && v !== false && v != null; }); });
  if (adds.length) {
    var next = L.last + 1;
    var bil = rows.filter(function (row) { return text(row.v[0]) !== ""; }).length;
    adds.forEach(function (vals) {
      var r = next++;
      if (r > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), 1);
      if (r > L.first) {
        sh.getRange(r - 1, 2, 1, ALUMNI_LAST - 1).copyTo(sh.getRange(r, 2, 1, ALUMNI_LAST - 1), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
        sh.getRange(r - 1, 2, 1, ALUMNI_LAST - 1).copyTo(sh.getRange(r, 2, 1, ALUMNI_LAST - 1), SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
      }
      sh.getRange(r, 2).setValue(++bil);
      var line = cols.map(function (col, j) {
        var v = vals[j];
        if (col.kind === "check") return v === true;
        return v == null ? "" : safe(v);
      });
      sh.getRange(r, ALUMNI_FIRST, 1, line.length).setValues([line]);
    });
  }
  SpreadsheetApp.flush();
  var L2 = alumniLayout(sh);
  return { ok: true, rows: alumniRows(sh, L2, cols) };
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

// ---------- Images (Planning) ----------

// Pictures are kept in Google Drive: folder "Yosh Legality – Gambar" / cawangan / sekolah.
// Each cawangan sheet has a "Gambar" tab listing them: Sekolah | Bahagian | Nama fail | File ID | Pautan | Dimuat naik.
// Files are shared "anyone with the link can view" so the portal can show them.
var IMAGE_TAB = "Gambar";
var IMAGE_ROOT = "Yosh Legality – Gambar";
var IMAGE_SECTIONS = ["planning"];
var IMAGE_MAX_BYTES = 8 * 1024 * 1024;

function imageSheet(ss, create) {
  var sh = ss.getSheetByName(IMAGE_TAB);
  if (sh || !create) return sh;
  sh = ss.insertSheet(IMAGE_TAB);
  var head = ["Sekolah", "Bahagian", "Nama fail", "File ID", "Pautan", "Dimuat naik"];
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold").setBackground("#1f1f1f").setFontColor("#ffc300");
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, 3, 180);
  sh.setColumnWidth(5, 320);
  return sh;
}

function imageView(id) {
  return {
    thumb: "https://drive.google.com/thumbnail?id=" + id + "&sz=w800",
    full: "https://drive.google.com/thumbnail?id=" + id + "&sz=w2000",
    url: "https://drive.google.com/file/d/" + id + "/view"
  };
}

function listImages(ss, school) {
  var sh = imageSheet(ss, false);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 6).getValues()
    .filter(function (r) { return text(r[0]) === school && text(r[3]); })
    .map(function (r) {
      var v = imageView(text(r[3]));
      return { id: text(r[3]), section: text(r[1]), name: text(r[2]), thumb: v.thumb, full: v.full, url: v.url,
               date: r[5] instanceof Date ? iso(r[5]) : text(r[5]) };
    });
}

function childFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function imageFolder(cawangan, school) {
  var props = PropertiesService.getScriptProperties();
  var root = null, id = props.getProperty("GAMBAR_FOLDER");
  if (id) { try { root = DriveApp.getFolderById(id); if (root.isTrashed()) root = null; } catch (e) { root = null; } }
  if (!root) {
    root = DriveApp.createFolder(IMAGE_ROOT);
    props.setProperty("GAMBAR_FOLDER", root.getId());
  }
  return childFolder(childFolder(root, cawangan), school);
}

/** body: { cawangan, sekolah, section, name, mime, data (base64) } */
function uploadImage(body) {
  var section = text(body.section);
  if (IMAGE_SECTIONS.indexOf(section) < 0) throw new Error("Gambar tidak boleh dimuat naik untuk bahagian ini.");
  var mime = text(body.mime);
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) throw new Error("Hanya gambar JPG, PNG, WEBP atau GIF.");
  var bytes = Utilities.base64Decode(String(body.data || ""));
  if (!bytes.length) throw new Error("Gambar kosong.");
  if (bytes.length > IMAGE_MAX_BYTES) throw new Error("Gambar terlalu besar (had 8 MB).");
  var ss = book(body.cawangan);
  var school = text(body.sekolah);
  if (schoolNames(ss).indexOf(school) < 0) throw new Error("Sekolah tidak dijumpai: " + body.sekolah);
  var cawangan = text(body.cawangan).toUpperCase();
  var name = (text(body.name) || "gambar").replace(/[\\/:*?"<>|]+/g, "_").slice(0, 120);
  var file = imageFolder(cawangan, school).createFile(Utilities.newBlob(bytes, mime, name));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  var v = imageView(file.getId());
  imageSheet(ss, true).appendRow([school, section, name, file.getId(), v.url, new Date()]);
  return { ok: true, images: listImages(ss, school) };
}

/** body: { cawangan, sekolah, id }. The file goes to Drive's bin, so it can still be restored. */
function deleteImage(body) {
  var ss = book(body.cawangan);
  var school = text(body.sekolah), id = text(body.id);
  var sh = imageSheet(ss, false);
  if (sh && sh.getLastRow() > 1) {
    var vals = sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
    for (var i = vals.length - 1; i >= 0; i--) {
      if (text(vals[i][0]) === school && text(vals[i][3]) === id) {
        sh.deleteRow(i + 2);
        try { DriveApp.getFileById(id).setTrashed(true); } catch (e) {}
      }
    }
  }
  return { ok: true, images: listImages(ss, school) };
}

/** Run once from the editor after adding the image feature, to allow Drive access. */
function setupGambar() {
  var f = imageFolder("TENGAH", "_ujian");
  Logger.log("Folder gambar sedia: " + f.getUrl());
  f.setTrashed(true);
}

// ---------- Program Sekolah (program.html) ----------

// Every programme sent from the Program page is kept in its own Google Sheet ("Program Sekolah – Yosh Junior"),
// separate from the cawangan Checklist Legality sheets. The sheet is made on the first save and its id kept
// in Script Properties (PROGRAM_SHEET). One row per programme; sending again with the same ID updates that row.
var PROGRAM_TITLE = "Program Sekolah – Yosh Junior";
var PROGRAM_TAB = "Program";
var PROGRAM_HEAD = ["ID", "Dihantar", "Cawangan", "Sekolah", "Negeri", "Nama program", "Jenis", "Tarikh mula", "Tarikh tamat",
  "Masa", "Guru bertugas", "Bil. guru", "Pelajar", "Jumlah pelajar", "Manpower", "Manpower tambahan",
  "Sheet program", "Main PIC", "PIC Legality", "PIC Virality", "Telegram"];
// Program page names → cawangan codes used everywhere else.
var PROGRAM_CAWANGAN = { "Tengah": "TENGAH", "Utara": "UTARA", "Pantai Timur": "PT", "Borneo": "BORNEO", "Indonesia": "INDONESIA", "MEA": "MEA" };

function programSheet() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("PROGRAM_SHEET"), ss = null;
  if (id) { try { ss = SpreadsheetApp.openById(id); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create(PROGRAM_TITLE);
    props.setProperty("PROGRAM_SHEET", ss.getId());
    ss.getSheets()[0].setName(PROGRAM_TAB);
  }
  var sh = ss.getSheetByName(PROGRAM_TAB) || ss.insertSheet(PROGRAM_TAB);
  // Columns changed while the sheet is still empty: start it again with the new heading.
  if (sh.getLastRow() === 1 && sh.getRange(1, 1, 1, PROGRAM_HEAD.length).getValues()[0].join("|") !== PROGRAM_HEAD.join("|")) {
    sh.clear(); sh.showColumns(1, sh.getMaxColumns());
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1, PROGRAM_HEAD.length).setValues([PROGRAM_HEAD])
      .setFontWeight("bold").setBackground("#1f1f1f").setFontColor("#ffc300").setVerticalAlignment("middle");
    sh.setFrozenRows(1);
    sh.setRowHeight(1, 32);
    sh.hideColumns(1);
    sh.setColumnWidths(2, PROGRAM_HEAD.length - 1, 140);
    sh.setColumnWidth(4, 220); sh.setColumnWidth(6, 240); sh.setColumnWidth(11, 260);
    sh.getRange("B:B").setNumberFormat("d/m/yyyy h:mm");
    sh.getRange("H:I").setNumberFormat("d/m/yyyy");
  }
  return sh;
}

function ymd(v) {
  var m = text(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : "";
}
function at(v) { var h = text(v).replace(/^@+/, ""); return h ? "@" + h : ""; }
// "@ali (Alumni · Kader Tengah)"
function withAlumni(handle, status, kader) {
  if (!handle) return "";
  var bits = [text(status), text(kader) ? "Kader " + text(kader) : ""].filter(String);
  return handle + (bits.length ? " (" + bits.join(" · ") + ")" : "");
}

/** body: { id, program: {...the Program form...}, telegram: "Berjaya" | "Gagal: ..." | "Ujian" } */
function saveProgram(body) {
  var d = body.program || {};
  var id = text(body.id).slice(0, 60);
  if (!/^[A-Za-z0-9_-]{8,60}$/.test(id)) throw new Error("ID program tidak sah.");
  if (!PROGRAM_CAWANGAN[text(d.cawangan)]) throw new Error("Cawangan tidak dikenali: " + d.cawangan);
  if (!text(d.sekolah) || !text(d.namaProgram)) throw new Error("Nama sekolah dan nama program perlu diisi.");
  var guru = (Array.isArray(d.guru) ? d.guru : []).slice(0, 20).filter(function (g) { return g && text(g.nama); });
  var pelajar = (Array.isArray(d.pelajar) ? d.pelajar : []).slice(0, 5);
  var bil = d.pelajarBilangan || {};
  var jumlah = pelajar.reduce(function (t, k) { return t + (parseInt(bil[k], 10) || 0); }, 0);
  var row = [
    id, new Date(), PROGRAM_CAWANGAN[text(d.cawangan)], safe(d.sekolah), safe(text(d.negeri).slice(0, 60)), safe(d.namaProgram), safe(d.jenis),
    ymd(d.tarikhMula), ymd(d.tarikhTamat),
    text(d.masaMula) && text(d.masaTamat) ? "'" + text(d.masaMula) + " – " + text(d.masaTamat) : "",
    safe(guru.map(function (g, i) { return (i + 1) + ". " + text(g.nama) + (text(g.jawatan) ? " (" + text(g.jawatan) + ")" : ""); }).join("\n")),
    guru.length,
    safe(pelajar.map(function (k) { return "Tingkatan " + text(k).replace(/^T/, "") + ": " + (parseInt(bil[k], 10) || 0); }).join("\n")),
    jumlah,
    parseInt(d.manpower, 10) || 0,
    d.tambahan === "Ya" ? (parseInt(d.tambahanJumlah, 10) || 0) : 0,
    safe(d.sheet),
    safe(withAlumni(at(d.mainPic), d.mainPicAlumni, d.mainPicKader)),
    safe(withAlumni(at(d.legality), d.legalityAlumni, d.legalityKader)),
    safe(withAlumni(at(d.virality), d.viralityAlumni, d.viralityKader)),
    safe(text(body.telegram).slice(0, 300))
  ];
  var sh = programSheet();
  var r = 0;
  if (sh.getLastRow() > 1) {
    var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) if (text(ids[i][0]) === id) { r = i + 2; break; }
  }
  if (r) {
    row[1] = sh.getRange(r, 2).getValue() || row[1];   // keep the first send time
    sh.getRange(r, 1, 1, row.length).setValues([row]);
  } else {
    sh.appendRow(row);
    r = sh.getLastRow();
  }
  sh.getRange(r, 1, 1, row.length).setVerticalAlignment("top").setWrap(true);
  CacheService.getScriptCache().remove("programs");
  return { ok: true, id: id };
}

function iso2(v) { return v instanceof Date ? iso(v) : text(v); }

/** Admin: every programme, newest first. */
function listPrograms() {
  var sh = programSheet();
  var out = [];
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, PROGRAM_HEAD.length).getValues().forEach(function (r) {
      if (!text(r[0]) && !text(r[3])) return;
      out.push({
        id: text(r[0]), dihantar: r[1] instanceof Date ? r[1].toISOString() : text(r[1]),
        cawangan: text(r[2]), sekolah: text(r[3]), negeri: text(r[4]), nama: text(r[5]), jenis: text(r[6]),
        mula: iso2(r[7]), tamat: iso2(r[8]), masa: text(r[9]),
        guru: text(r[10]), bilGuru: Number(r[11]) || 0, pelajar: text(r[12]), jumlahPelajar: Number(r[13]) || 0,
        manpower: Number(r[14]) || 0, tambahan: Number(r[15]) || 0, sheet: text(r[16]),
        mainPic: text(r[17]), legality: text(r[18]), virality: text(r[19]), telegram: text(r[20])
      });
    });
  }
  out.sort(function (a, b) { return a.dihantar < b.dihantar ? 1 : a.dihantar > b.dihantar ? -1 : 0; });
  return { programs: out, sheetUrl: sh.getParent().getUrl(), generated: new Date().toISOString() };
}

// ---------- PIC Legality ----------

// The Legality PIC(s) of each school, in a "PIC Legality" tab of the cawangan sheet:
// Sekolah | Nama PIC | Username Telegram | Dikemas kini. A school can have more than one PIC.
var PIC_TAB = "PIC Legality";

function picSheet(ss, create) {
  var sh = ss.getSheetByName(PIC_TAB);
  if (sh || !create) return sh;
  sh = ss.insertSheet(PIC_TAB);
  var head = ["Sekolah", "Nama PIC", "Username Telegram", "Dikemas kini"];
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold").setBackground("#1f1f1f").setFontColor("#ffc300");
  sh.setFrozenRows(1);
  sh.setColumnWidths(1, 3, 200);
  sh.setColumnWidth(4, 150);
  sh.getRange("D:D").setNumberFormat("d/m/yyyy h:mm");
  return sh;
}

function readPic(ss, school) {
  var sh = picSheet(ss, false);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues()
    .filter(function (r) { return text(r[0]) === school && (text(r[1]) || text(r[2])); })
    .map(function (r) { return { nama: text(r[1]), username: text(r[2]).replace(/^@+/, "") }; });
}

/** body: { cawangan, sekolah, pics: [{ nama, username }] } — replaces the school's PIC list. */
function savePic(body) {
  var ss = book(body.cawangan);
  var school = text(body.sekolah);
  if (schoolNames(ss).indexOf(school) < 0) throw new Error("Sekolah tidak dijumpai: " + body.sekolah);
  var pics = (Array.isArray(body.pics) ? body.pics : []).slice(0, 10).map(function (p) {
    return { nama: text(p && p.nama).slice(0, 100), username: text(p && p.username).replace(/^@+/, "").replace(/\s+/g, "").slice(0, 40) };
  }).filter(function (p) { return p.nama || p.username; });
  pics.forEach(function (p) {
    if (p.username && !/^[A-Za-z0-9_]{3,40}$/.test(p.username)) throw new Error("Username Telegram tidak sah: @" + p.username);
  });
  var sh = picSheet(ss, true);
  if (sh.getLastRow() > 1) {
    var names = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = names.length - 1; i >= 0; i--) if (text(names[i][0]) === school) sh.deleteRow(i + 2);
  }
  var now = new Date();
  if (pics.length) {
    sh.getRange(sh.getLastRow() + 1, 1, pics.length, 4).setValues(pics.map(function (p) {
      return [school, safe(p.nama), p.username ? "@" + p.username : "", now];
    }));
  }
  SpreadsheetApp.flush();
  return { ok: true, pic: readPic(ss, school) };
}

// ---------- Bot semakan Legality (Legality Tds Tengah) ----------

// Checks each school of a cawangan for sections still empty in the Checklist Legality sheet and posts one
// message to the TDS group, tagging each school's PIC Legality (from the "PIC Legality" tab).
// For now it checks Planning Legality and Peluang Lain Tahun Depan; add keys to BOT_CHECKS for more.
//
// Script Properties (Project Settings → Script properties):
//   LEGALITY_BOT_TENGAH   token of the "Legality Tds Tengah" bot (from @BotFather)
//   LEGALITY_BOT_CHAT    chat id of the group, e.g. -1001234567890   (t.me/c/1234567890/… → -1001234567890)
//   LEGALITY_BOT_THREAD  optional topic id inside that group           (t.me/c/1234567890/25 → 25)
var BOT_CAWANGAN = "TENGAH";
var BOT_CHECKS = [
  { key: "planning", label: "Planning Legality" },
  { key: "peluang", label: "Peluang Lain Tahun Depan" }
];
var PORTAL_URL = "https://tdslkd.netlify.app/legality/database";

// "*Tulis Timeline disini" and similar template hints do not count as filled in.
function isPlaceholder(v) { return /^\*?\s*(tulis|isi)\b/i.test(text(v)); }
function filledText(v) { return text(v) !== "" && v !== false && !isPlaceholder(v); }

function sectionFilled(sh, key, m, ss, school) {
  var rows = readSection(sh, key, m).rows;
  if (key === "planning") {
    var written = rows.some(function (row) { return !row.lock[1] && filledText(row.v[1]); });
    return written || listImages(ss, school).some(function (im) { return im.section === "planning"; });
  }
  // Peluang: the "Peluang" column itself must be written. Permanfaatan alone often only holds the template
  // example ("- Singgah Kopi, Printago, Wakaf Quran"), so it does not count.
  return rows.some(function (row) { return filledText(row.v[0]); });
}

/** What each school still has to fill in: [{ sekolah, pics: [{nama, username}], missing: [labels] }] */
function legalityGaps(cawangan) {
  var ss = book(cawangan);
  return schoolNames(ss).map(function (school) {
    var sh = ss.getSheetByName(school);
    var m = markers(sh);
    var missing = BOT_CHECKS.filter(function (c) { return !sectionFilled(sh, c.key, m, ss, school); })
      .map(function (c) { return c.label; });
    return { sekolah: school, pics: readPic(ss, school), missing: missing };
  }).filter(function (s) { return s.missing.length; });
}

function gapsMessage(cawangan, gaps) {
  var c = text(cawangan).toUpperCase();
  if (!gaps.length) return "";
  var lines = [
    "📋 SEMAKAN DATABASE LEGALITY · CAWANGAN " + c,
    "",
    "Bahagian berikut masih kosong. Mohon PIC Legality kemas kini 🙏",
    ""
  ];
  gaps.forEach(function (g) {
    var who = g.pics.filter(function (p) { return p.username; }).map(function (p) { return "@" + p.username; });
    lines.push("🏫 " + g.sekolah + " — " + (who.length ? who.join(" ") : "(PIC belum ditetapkan)"));
    g.missing.forEach(function (label) { lines.push("     ✕ " + label); });
    lines.push("");
  });
  lines.push("Kemas kini di: " + PORTAL_URL + "#/" + encodeURIComponent(c));
  return lines.join("\n");
}

function botConfig() {
  var p = PropertiesService.getScriptProperties();
  return { token: p.getProperty("LEGALITY_BOT_TENGAH"), chat: p.getProperty("LEGALITY_BOT_CHAT"), thread: p.getProperty("LEGALITY_BOT_THREAD") };
}

// Telegram allows 4096 characters per message; long lists are split between schools.
function splitMessage(msg) {
  var parts = [], cur = "";
  msg.split("\n\n").forEach(function (block) {
    var next = cur ? cur + "\n\n" + block : block;
    if (next.length > 3800 && cur) { parts.push(cur); cur = block; } else cur = next;
  });
  if (cur) parts.push(cur);
  return parts;
}

function sendBotMessage(textMsg) {
  var cfg = botConfig();
  if (!cfg.token || !cfg.chat) throw new Error("Bot belum disediakan: isi LEGALITY_BOT_TENGAH dan LEGALITY_BOT_CHAT dalam Script Properties.");
  splitMessage(textMsg).forEach(function (part) {
    var payload = { chat_id: cfg.chat, text: part, link_preview_options: { is_disabled: true } };
    if (cfg.thread) payload.message_thread_id = Number(cfg.thread);
    var res = UrlFetchApp.fetch("https://api.telegram.org/bot" + cfg.token + "/sendMessage", {
      method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    var body = JSON.parse(res.getContentText() || "{}");
    if (!body.ok) throw new Error("Telegram: " + (body.description || res.getResponseCode()));
  });
}

/** Admin preview (no message sent): { cawangan, gaps, text, ready } */
function legalityReminder(cawangan) {
  var c = text(cawangan || BOT_CAWANGAN).toUpperCase();
  var gaps = legalityGaps(c);
  var cfg = botConfig();
  return { cawangan: c, checks: BOT_CHECKS.map(function (x) { return x.label; }), gaps: gaps,
           text: gapsMessage(c, gaps), ready: !!(cfg.token && cfg.chat) };
}

/** Admin: send the reminder now. */
function sendLegalityReminder(body) {
  var r = legalityReminder(body.cawangan);
  if (!r.text) return { ok: true, sent: false, reason: "Semua sekolah sudah lengkap." };
  sendBotMessage(r.text);
  return { ok: true, sent: true, schools: r.gaps.length };
}

/** For a time-driven trigger (Triggers → Add trigger → semakLegalityTengah). Sends only when something is empty. */
function semakLegalityTengah() {
  var r = legalityReminder(BOT_CAWANGAN);
  if (r.text) sendBotMessage(r.text);
  Logger.log(r.text || "Semua sekolah " + BOT_CAWANGAN + " sudah lengkap.");
}

/** Run once from the editor after setting the token: checks the bot can reach the group (sends nothing). */
function semakBotLegality() {
  var cfg = botConfig();
  if (!cfg.token) throw new Error("LEGALITY_BOT_TENGAH belum diisi dalam Script Properties.");
  var me = JSON.parse(UrlFetchApp.fetch("https://api.telegram.org/bot" + cfg.token + "/getMe", { muteHttpExceptions: true }).getContentText());
  Logger.log("Bot: " + (me.ok ? "@" + me.result.username : me.description));
  if (cfg.chat) {
    var chat = JSON.parse(UrlFetchApp.fetch("https://api.telegram.org/bot" + cfg.token + "/getChat?chat_id=" + encodeURIComponent(cfg.chat), { muteHttpExceptions: true }).getContentText());
    Logger.log("Group: " + (chat.ok ? chat.result.title : chat.description));
  }
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
