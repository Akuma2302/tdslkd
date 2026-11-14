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
  var tengah = props.getProperty("KOD_TENGAH");   // Tengah page (/tengah): MOM only
  if (!user && !admin) throw new Error("Kod akses belum ditetapkan oleh pentadbir.");
  var k = text(kod);
  if (admin && k === admin) return "admin";
  if (user && k === user) return "user";
  if (tengah && k === tengah) return "tengah";
  throw new Error("KOD_SALAH");
}

function doGet(e) {
  var p = (e && e.parameter) || {};
  try {
    var role = checkKod(p.kod);
    if (p.action === "ping") return json({ ok: true, role: role });
    if (p.action === "mom") {
      if (role !== "tengah" && role !== "admin") throw new Error("KOD_SALAH");
      return json(readMom());
    }
    if (role === "tengah") throw new Error("KOD_SALAH");   // the Tengah code opens the MOM page only
    if (p.action === "alumni") return json(readAlumni(p.cawangan));
    if (p.action === "cawangan") return json(listCawangan());
    if (p.action === "schools") return json(listSchools(p.cawangan));
    if (p.action === "schoolList") return json(schoolList(p.cawangan));
    if (p.action === "teachers") return json(schoolTeachers(p.cawangan, p.sekolah));
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
    var role = checkKod(body.kod);
    if (body.action === "saveMomItem" || body.action === "deleteMomItem") {
      if (role !== "tengah" && role !== "admin") throw new Error("KOD_SALAH");
      lock.waitLock(20000);
      return json(body.action === "saveMomItem" ? saveMomItem(body) : deleteMomItem(body));
    }
    if (body.action === "reportClaim" || body.action === "reportRelease" || body.action === "reportUpdate") {   // Netlify report-bot / telegram-webhook
      if (role !== "tengah" && role !== "admin") throw new Error("KOD_SALAH");
      lock.waitLock(20000);
      return json(body.action === "reportClaim" ? reportClaim(body) : body.action === "reportRelease" ? reportRelease(body) : reportUpdate(body));
    }
    if (body.action === "reportTest" || body.action === "reportTestClear") {   // admin: test the reporting bot
      if (role !== "admin") throw new Error("KOD_SALAH");
      lock.waitLock(20000);
      return json(body.action === "reportTest" ? reportTest(body) : reportTestClear());
    }
    if (body.action === "picoClaim" || body.action === "picoRelease") {   // Netlify function pico (any valid code)
      if (body.demo && role !== "admin") throw new Error("KOD_SALAH");
      lock.waitLock(20000);
      return json(body.action === "picoClaim" ? picoClaim(body) : picoRelease(body));
    }
    if (body.action === "momClaim" || body.action === "momRelease") {   // Netlify bot functions (mom-hantar, mom-reminder)
      if (role !== "tengah" && role !== "admin") throw new Error("KOD_SALAH");
      lock.waitLock(20000);
      return json(body.action === "momClaim" ? momClaim(body) : momRelease(body));
    }
    if (role === "tengah") throw new Error("KOD_SALAH");
    lock.waitLock(20000);
    if (body.action === "save") return json(saveSection(body));
    if (body.action === "addSchool") return json(addSchool(body.cawangan, body.sekolah));
    if (body.action === "saveProgress") return json(saveProgress(body));
    if (body.action === "saveProgressNote") return json(saveProgressNote(body));
    if (body.action === "saveLegalityStatus") {
      if (role !== "admin") throw new Error("Jenis dan Status Legality hanya boleh diubah oleh admin.");
      return json(saveLegalityStatus(body));
    }
    if (body.action === "saveAlumni") return json(saveAlumni(body));
    if (body.action === "uploadImage") return json(uploadImage(body));
    if (body.action === "saveWeekly") return json(saveWeekly(body));
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

// Names only (for the Program form's school picker): one small read of the "Senarai Sekolah" tab, cached 10 minutes.
function schoolList(cawangan) {
  var c = text(cawangan).toUpperCase();
  var cache = CacheService.getScriptCache();
  var hit = cache.get("schoolList:" + c);
  if (hit) return JSON.parse(hit);
  var out = { cawangan: c, schools: schoolNames(book(c)) };
  cache.put("schoolList:" + c, JSON.stringify(out), 600);
  return out;
}

// Teachers in a school's CRM (for "Guru Bertugas" on the Program form): name + Entiti as jawatan. Cached 5 minutes.
function teachersKey(c, s) { return "teachers:" + text(c).toUpperCase() + ":" + text(s); }
function schoolTeachers(cawangan, sekolah) {
  var c = text(cawangan).toUpperCase(), school = text(sekolah);
  var cache = CacheService.getScriptCache();
  var hit = cache.get(teachersKey(c, school));
  if (hit) return JSON.parse(hit);
  var ss = book(c);
  var sh = ss.getSheetByName(school);
  var out = { cawangan: c, sekolah: school, found: false, teachers: [] };
  if (sh && schoolNames(ss).indexOf(school) > -1) {
    out.found = true;
    var seen = {};
    readSection(sh, "crm").rows.forEach(function (row) {
      var nama = text(row.v[2]);
      if (!nama || seen[nama.toLowerCase()]) return;
      seen[nama.toLowerCase()] = 1;
      out.teachers.push({ nama: nama, jawatan: text(row.v[0]) });
    });
  }
  cache.put(teachersKey(c, school), JSON.stringify(out), 300);
  return out;
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
  data.progress = { items: PROGRESS_ITEMS, values: readProgress(ss, sh.getName()), note: readProgressNote(ss, sh.getName()),
                    options: { jenis: LEGALITY_JENIS, status: LEGALITY_STATUS } };
  data.images = listImages(ss, sh.getName());
  data.pic = readPic(ss, sh.getName());
  data.weekly = readWeekly(ss, sh.getName(), cawangan);
  data.sheetUrl = ss.getUrl() + "#gid=" + sh.getSheetId();   // "Buka Google Sheet" on the school page
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

// "Progress semasa": a free-text note per school about where things stand, in two columns after
// "Dikemas kini" in the Progress tab: Progress semasa | Catatan dikemas kini.
function noteCol() { return PROGRESS_ITEMS.length + 3; }
function ensureNoteHeader(sh) {
  var c = noteCol();
  if (text(sh.getRange(1, c).getValue()) === "") {
    sh.getRange(1, c, 1, 2).setValues([["PROGRESS SEMASA", "Catatan dikemas kini"]])
      .setBackground("#0b47a1").setFontColor("#ffffff").setFontWeight("bold").setFontSize(10).setWrap(true).setVerticalAlignment("top");
    sh.setColumnWidth(c, 320);
    sh.setColumnWidth(c + 1, 140);
    sh.getRange(2, c, 300, 1).setWrap(true).setVerticalAlignment("top");
    sh.getRange(2, c + 1, 300, 1).setNumberFormat("d mmm yyyy h:mm").setFontColor("#666666");
  }
}
// Jenis Legality and Status Legality of each school: two more columns after "Catatan dikemas kini", with dropdowns.
var LEGALITY_JENIS = ["A", "B", "C"];
var LEGALITY_STATUS = ["Legal with B&W", "Legal w/o B&W", "Tidak Legal"];
function ensureStatusHeader(sh) {
  var c = noteCol() + 2;
  if (sh.getMaxColumns() < c + 1) sh.insertColumnsAfter(sh.getMaxColumns(), c + 1 - sh.getMaxColumns());
  if (text(sh.getRange(1, c).getValue()) !== "") return;
  sh.getRange(1, c, 1, 2).setValues([["JENIS LEGALITY", "STATUS LEGALITY"]])
    .setBackground("#0b47a1").setFontColor("#ffffff").setFontWeight("bold").setFontSize(10).setWrap(true).setVerticalAlignment("top");
  sh.setColumnWidth(c, 110);
  sh.setColumnWidth(c + 1, 150);
  sh.getRange(2, c, 300, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(LEGALITY_JENIS, true).setAllowInvalid(false).build());
  sh.getRange(2, c + 1, 300, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(LEGALITY_STATUS, true).setAllowInvalid(false).build());
}
function readProgressNote(ss, school) {
  var p = progressRow(ss, school, false);
  if (!p.r) return { text: "", updated: "", jenis: "", status: "" };
  var n = Math.min(4, p.sh.getMaxColumns() - noteCol() + 1);
  if (n < 2) return { text: "", updated: "", jenis: "", status: "" };
  var v = p.sh.getRange(p.r, noteCol(), 1, n).getValues()[0];
  return { text: text(v[0]), updated: v[1] instanceof Date ? v[1].toISOString() : "",
           jenis: text(v[2]), status: text(v[3]) };
}
/** body: { cawangan, sekolah, note, old } — old is the note as it was when the page loaded. (PIC; Jenis/Status are admin-only.) */
function saveProgressNote(body) {
  var ss = book(body.cawangan);
  var school = text(body.sekolah);
  if (schoolNames(ss).indexOf(school) < 0) throw new Error("Sekolah tidak dijumpai: " + school);
  var p = progressRow(ss, school, true);
  ensureNoteHeader(p.sh);
  var cell = p.sh.getRange(p.r, noteCol(), 1, 2);
  var now = text(cell.getValues()[0][0]);
  var note = String(body.note == null ? "" : body.note).trim().slice(0, 3000);
  if (now !== text(body.old) && now !== note) throw new Error("Ada orang lain telah mengemas kini progress semasa ini. Muat semula halaman dan cuba lagi.");
  if (now !== note) {
    cell.setValues([[safe(note), new Date()]]);
    markSummaryStale();
  }
  return { ok: true, note: readProgressNote(ss, school) };
}

/** Admin only. body: { cawangan, sekolah, jenis, status } — does not change the Progress semasa date. */
function saveLegalityStatus(body) {
  var ss = book(body.cawangan);
  var school = text(body.sekolah);
  if (schoolNames(ss).indexOf(school) < 0) throw new Error("Sekolah tidak dijumpai: " + school);
  var jenis = text(body.jenis), status = text(body.status);
  if (jenis && LEGALITY_JENIS.indexOf(jenis) < 0) throw new Error("Jenis Legality tidak sah: " + jenis);
  if (status && LEGALITY_STATUS.indexOf(status) < 0) throw new Error("Status Legality tidak sah: " + status);
  var p = progressRow(ss, school, true);
  ensureNoteHeader(p.sh);
  ensureStatusHeader(p.sh);
  p.sh.getRange(p.r, noteCol() + 2, 1, 2).setValues([[jenis, status]]);
  SpreadsheetApp.flush();
  markSummaryStale();
  return { ok: true, note: readProgressNote(ss, school) };
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
    markSummaryStale();
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
// Admin summary of every cawangan. Reading 15+ school tabs takes a while, so:
//  - each school tab is read once (one getValues, markers found from that same block);
//  - the result is cached for 6 hours and returned at once; after any save it is only marked out of date
//    ("stale": true) and the admin page fetches a fresh copy in the background.
var SUMMARY_KEY = "summary3", SUMMARY_STALE = "summaryStale";
// The flag holds the time of the last save, so a summary that was already being built before that save does not clear it.
function markSummaryStale() { CacheService.getScriptCache().put(SUMMARY_STALE, String(Date.now()), 21600); }

function summaryMarkers(a) {
  function find(prefix, from) {
    for (var i = (from || 2); i < a.length; i++) if (text(a[i][0]).toLowerCase().indexOf(prefix) === 0) return i + 1;
    return 0;
  }
  var alumni = find("alumni sekolah");
  if (!alumni) return null;
  var program = find("program yang telah", alumni);
  var analisa = find("analisa situasi", program);
  return { crmEnd: alumni - 1, program: program, analisa: analisa };
}

function summary(fresh) {
  var cache = CacheService.getScriptCache();
  if (!fresh) {
    var hit = cache.get(SUMMARY_KEY);
    if (hit) {
      var cached = JSON.parse(hit);
      cached.stale = !!cache.get(SUMMARY_STALE);
      return cached;
    }
  }
  var startedAt = Date.now();
  var map = sheetMap();
  var out = { items: PROGRESS_ITEMS, generated: new Date().toISOString(), cawangan: [] };
  CAWANGAN.forEach(function (c) {
    if (!map[c]) { out.cawangan.push({ id: c, ready: false, schools: [] }); return; }
    var ss = SpreadsheetApp.openById(map[c]);
    var prog = {}, note = {};
    var psh = ss.getSheetByName(PROGRESS_TAB);
    if (psh && psh.getLastRow() >= 2) {
      var N = PROGRESS_ITEMS.length;
      psh.getRange(2, 1, psh.getLastRow() - 1, Math.min(psh.getMaxColumns(), N + 6)).getValues().forEach(function (r) {
        if (!text(r[0])) return;
        prog[text(r[0])] = r.slice(1, N + 1).map(function (v) { return v === true; });
        note[text(r[0])] = { text: text(r[N + 2]), updated: r[N + 3] instanceof Date ? r[N + 3].toISOString() : "",
                             jenis: text(r[N + 4]), status: text(r[N + 5]) };
      });
    }
    var pics = {};
    var pk = picSheet(ss, false);
    if (pk && pk.getLastRow() >= 2) {
      pk.getRange(2, 1, pk.getLastRow() - 1, 3).getValues().forEach(function (r) {
        var u = text(r[2]).replace(/^@+/, "");
        if (!text(r[0]) || !(u || text(r[1]))) return;
        (pics[text(r[0])] = pics[text(r[0])] || []).push({ nama: text(r[1]), username: u });
      });
    }
    var schools = [];
    schoolNames(ss).forEach(function (n) {
      var sh = ss.getSheetByName(n);
      var rows = Math.min(sh.getLastRow(), 400);
      if (rows < 3) return;
      var a = sh.getRange(1, 1, rows, COL.LAST).getValues();   // the only read for this school
      var m = summaryMarkers(a);
      if (!m) return;
      var people = 0, aktif = 0, phase = {}, kategori = {}, checks = 0;
      a.slice(2, m.crmEnd).forEach(function (r) {
        var named = text(r[3]) !== "";
        if (!named && r[2] !== true) return;
        people++;
        if (r[2] === true) aktif++;
        var ph = text(r[COL.KPI]);       // I = Phase
        var kt = text(r[COL.KPI - 1]);   // H = Kategori
        if (ph) phase[ph] = (phase[ph] || 0) + 1;
        if (kt) kategori[kt] = (kategori[kt] || 0) + 1;
        for (var c2 = COL.KPI_CHECK - 1; c2 < COL.LAST; c2++) if (r[c2] === true) checks++;
      });
      var programs = 0;
      if (m.program && m.analisa) {
        a.slice(m.program + 1, m.analisa - 1).forEach(function (r) { if (text(r[0]) !== "") programs++; });
      }
      schools.push({
        name: n, people: people, aktif: aktif, phase: phase, kategori: kategori, checks: checks,
        programs: programs, progress: prog[n] || PROGRESS_ITEMS.map(function () { return false; }),
        note: note[n] || { text: "", updated: "" }, pic: pics[n] || []
      });
    });
    out.cawangan.push({ id: c, ready: true, url: ss.getUrl(), schools: schools });
  });
  try {
    cache.put(SUMMARY_KEY, JSON.stringify(out), 21600);
    var savedAt = +(cache.get(SUMMARY_STALE) || 0);
    if (savedAt < startedAt) cache.remove(SUMMARY_STALE);   // a save during the build keeps it marked out of date
  } catch (e) {}
  out.stale = false;
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
  startReporting(sh, r, row[2], body.telegram, row);   // reporting reminders (Tengah, new programmes)
  CacheService.getScriptCache().remove("programs");
  return { ok: true, id: id };
}

function iso2(v) { return v instanceof Date ? iso(v) : text(v); }

/** Admin: every programme, newest first. */
function listPrograms() {
  var sh = programSheet();
  var out = [];
  var width = Math.min(sh.getMaxColumns(), PROGRAM_HEAD.length + REPORT_HEAD.length);
  if (sh.getLastRow() > 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, width).getValues().forEach(function (r) {
      if (!text(r[0]) && !text(r[3])) return;
      out.push({
        id: text(r[0]), dihantar: r[1] instanceof Date ? r[1].toISOString() : text(r[1]),
        cawangan: text(r[2]), sekolah: text(r[3]), negeri: text(r[4]), nama: text(r[5]), jenis: text(r[6]),
        mula: iso2(r[7]), tamat: iso2(r[8]), masa: text(r[9]),
        guru: text(r[10]), bilGuru: Number(r[11]) || 0, pelajar: text(r[12]), jumlahPelajar: Number(r[13]) || 0,
        manpower: Number(r[14]) || 0, tambahan: Number(r[15]) || 0, sheet: text(r[16]),
        mainPic: text(r[17]), legality: text(r[18]), virality: text(r[19]), telegram: text(r[20]),
        reporting: { status: text(r[21]), link: text(r[22]), updated: r[23] instanceof Date ? r[23].toISOString() : "",
                     next: r[24] instanceof Date ? r[24].toISOString() : "", komen: text(r[25]) },
        video: text(r[26])
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

// ---------- MOM Tengah (/tengah) ----------

// Minutes of meeting for cawangan Tengah, kept in a "MOM" tab of the TENGAH sheet. The /tengah page saves one
// item at a time (saveMomItem / deleteMomItem). Telegram (bot "SU Tengah", token SU_BOT_TENGAH in Netlify, never here):
//  - right after a save the page calls the Netlify function mom-hantar, which posts each new item to its
//    unit's topic, plus one list of the new items to "MOM Keseluruhan";
//  - the Apps Script trigger momReminderTick (every minute) asks the same function to post the reminders.
// Both take their messages from momClaim(), which marks them as sent in the "Telegram" column so nothing is
// posted twice; momRelease() puts back the ones Telegram refused, so they are tried again a minute later.
var MOM_TAB = "MOM";
var MOM_HEAD = ["Bil", "ID", "Tarikh MOM", "Tindakan", "Tarikh Due", "Masa Due", "Unit", "PIC", "Reminder", "Telegram", "Dikemas kini"];
var MOM_COLS = MOM_HEAD.length;
var MOM_TZ = "Asia/Kuala_Lumpur";
// Topics of the SU Tengah group (t.me/c/1790355836/<topic>)
var MOM_UNITS = [
  { id: "murobbi",   label: "Unit Murobbi",   thread: 16599 },
  { id: "mutarobbi", label: "Unit Mutarobbi", thread: 16597 },
  { id: "legality",  label: "Unit Legality",  thread: 16598 },
  { id: "virality",  label: "Unit Virality",  thread: 18527 },
  { id: "tls",       label: "Unit TLS",       thread: 16596 }
];
var MOM_THREAD_ALL = 16601;   // "MOM Keseluruhan"
var MOM_PICS = ["@nrhazirahrosli", "@Aznie_Sazreen", "@akmalasyraaaaf", "@muzamilmimilzamil", "@aaliyasyakirah",
                "@IzzahAnnuar", "@Saummi", "@adibahnahran", "@nadirahaisyah", "@hakimiesaharo", "@najmannoordin"];
// Reminder = number + time unit: "15m" (15 minit), "2h", "3d", "1w", "1b" (1 bulan = 30 hari). Several per item.
var MOM_REM_UNITS = [
  { id: "m", label: "minit",  min: 1,     max: 60 },
  { id: "h", label: "jam",    min: 60,    max: 24 },
  { id: "d", label: "hari",   min: 1440,  max: 365 },
  { id: "w", label: "minggu", min: 10080, max: 52 },
  { id: "b", label: "bulan",  min: 43200, max: 12 }
];
var MOM_REM_MAX = 10;   // reminders per item
var MOM_LATE_GRACE = 10;   // minutes after the due time a missed reminder may still go out

function momUnit(id) { for (var i = 0; i < MOM_UNITS.length; i++) if (MOM_UNITS[i].id === id || MOM_UNITS[i].label === id) return MOM_UNITS[i]; return null; }
// "15m" or "15 minit sebelum" -> { id: "15m", label: "15 minit sebelum", min: 15 }; null when not a valid reminder.
function momRem(x) {
  var m = text(x).toLowerCase().match(/^(\d{1,3})\s*([a-z]+)/);
  if (!m) return null;
  var n = +m[1];
  for (var i = 0; i < MOM_REM_UNITS.length; i++) {
    var u = MOM_REM_UNITS[i];
    if ((m[2] === u.id || m[2] === u.label) && n >= 1 && n <= u.max) return { id: n + u.id, label: n + " " + u.label + " sebelum", min: n * u.min };
  }
  return null;
}
// Valid reminder ids, without repeats, nearest to the due time first.
function momRemIds(list) {
  var out = [];
  list.forEach(function (x) { var r = momRem(x); if (r && out.indexOf(r.id) < 0) out.push(r.id); });
  return out.sort(function (a, b) { return momRem(a).min - momRem(b).min; }).slice(0, MOM_REM_MAX);
}
function momList(v) { return text(v).split(/\s*,\s*/).filter(function (x) { return x; }); }
function momUniq(a) { return a.filter(function (x, i) { return x && a.indexOf(x) === i; }); }
function momTime(v) {
  var m = text(v).match(/^(\d{1,2}):(\d{2})/);
  return m && +m[1] < 24 && +m[2] < 60 ? ("0" + +m[1]).slice(-2) + ":" + m[2] : "";
}
function momYmd(v) { return /^\d{4}-\d{2}-\d{2}$/.test(text(v)) ? text(v) : ""; }

function momSheet(create) {
  var ss = book("TENGAH");
  var sh = ss.getSheetByName(MOM_TAB);
  if (!sh) {
    if (!create) return null;
    sh = ss.insertSheet(MOM_TAB);
  }
  if (text(sh.getRange(1, 2).getValue()) !== "ID") momLayout(sh);
  return sh;
}

// Sets up the columns; rows from the first layout (Bil | Tindakan | Due | PIC | Dikemas kini) are carried over.
function momLayout(sh) {
  var old = [];
  if (sh.getLastRow() > 1 && text(sh.getRange(1, 2).getValue()) === "Tindakan") {
    old = sh.getRange(2, 1, sh.getLastRow() - 1, 5).getValues().filter(function (r) { return text(r[1]); });
  }
  sh.clear();
  sh.getRange(1, 1, 1, MOM_COLS).setValues([MOM_HEAD])
    .setFontWeight("bold").setBackground("#1f1f1f").setFontColor("#ffc300").setVerticalAlignment("middle");
  sh.setFrozenRows(1);
  [45, 90, 100, 380, 100, 80, 120, 220, 200, 110, 130].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange("D:D").setWrap(true);
  sh.getRange("C:C").setNumberFormat("d/m/yyyy");
  sh.getRange("E:E").setNumberFormat("d/m/yyyy");
  sh.getRange("F:F").setNumberFormat("@");
  sh.getRange("B:B").setFontColor("#999999");
  sh.getRange("J:J").setFontColor("#999999");
  sh.getRange("K:K").setNumberFormat("d/m/yyyy h:mm").setFontColor("#999999");
  if (old.length) {
    sh.getRange(2, 1, old.length, MOM_COLS).setValues(old.map(function (r, i) {
      return [i + 1, momNewId(), "", r[1], r[2], "", "", text(r[3]), "", "", r[4]];
    }));
  }
}

function momNewId() { return Utilities.getUuid().replace(/-/g, "").slice(0, 10); }

function momRow(r) {
  var unit = momUnit(text(r[6]));
  return {
    id: text(r[1]),
    tarikh: r[2] instanceof Date ? iso(r[2]) : momYmd(r[2]),
    tindakan: text(r[3]),
    due: r[4] instanceof Date ? iso(r[4]) : momYmd(r[4]),
    masa: momTime(r[5]),
    unit: unit ? unit.id : "",
    pic: momList(r[7]),
    reminder: momRemIds(momList(r[8])),
    sent: momList(r[9])
  };
}

function momRows(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, MOM_COLS).getValues();
}

function readMom() {
  var items = [], updated = "";
  momRows(momSheet(false)).forEach(function (r) {
    if (!text(r[1]) || !text(r[3])) return;
    items.push(momRow(r));
    if (r[10] instanceof Date && r[10].toISOString() > updated) updated = r[10].toISOString();
  });
  return {
    items: items, updated: updated, pics: MOM_PICS,
    units: MOM_UNITS.map(function (u) { return { id: u.id, label: u.label }; }),
    remUnits: MOM_REM_UNITS.map(function (u) { return { id: u.id, label: u.label, max: u.max }; })
  };
}

// What the page edits (the "Telegram" column is left out: the bot changes it on its own).
function momKey(items) {
  return JSON.stringify((items || []).map(function (it) {
    return [text(it.id), text(it.tarikh), text(it.tindakan), text(it.due), text(it.masa), text(it.unit),
            (it.pic || []).join(","), (it.reminder || []).join(",")];
  }));
}

// One item as sent by the page, cleaned up.
function momClean(it) {
  it = it || {};
  var unit = momUnit(text(it.unit));
  return {
    id: text(it.id), tarikh: momYmd(it.tarikh), tindakan: text(it.tindakan).slice(0, 2000),
    due: momYmd(it.due), masa: momTime(it.masa), unit: unit ? unit.id : "",
    pic: momUniq((Array.isArray(it.pic) ? it.pic : []).map(at).filter(function (p) { return /^@\w{3,32}$/.test(p); })).slice(0, 20),
    reminder: momRemIds(Array.isArray(it.reminder) ? it.reminder : [])
  };
}

function momCells(it, bil, sent, now) {
  var unit = momUnit(it.unit);
  return [bil, it.id, ymd(it.tarikh), safe(it.tindakan), ymd(it.due), it.masa, unit ? unit.label : "",
          it.pic.join(", "), it.reminder.map(function (x) { return momRem(x).label; }).join(", "), sent.join(", "), now];
}

function momFind(sh, id) {
  var rows = momRows(sh);
  for (var i = 0; i < rows.length; i++) if (id && text(rows[i][1]) === id) return { row: i + 2, r: rows[i] };
  return null;
}

var MOM_CONFLICT = "Ada orang lain telah mengemas kini item MOM ini. Muat semula halaman dan cuba lagi.";

/**
 * Saves ONE item (the "Simpan MOM" button of that item). body: { item, old: <item as loaded, or null if new> }.
 * A new item is added at the end and is announced on Telegram once (mom-hantar, called by the page).
 * An edited item is never announced again: only its reminders go out; changing Tarikh/Masa Due restarts them.
 */
function saveMomItem(body) {
  var it = momClean(body.item);
  if (!it.tindakan) throw new Error("Tindakan perlu diisi.");
  if (it.masa && !it.due) throw new Error("Isi Tarikh Due untuk Masa Due itu.");
  if (it.reminder.length && !(it.due && it.masa)) throw new Error("Reminder perlu Tarikh Due dan Masa Due.");
  var sh = momSheet(true);
  var now = new Date(), found = it.id ? momFind(sh, it.id) : null, row, bil, sent;
  if (it.id && !found) throw new Error("Item ini telah dipadam oleh orang lain. Muat semula halaman.");
  if (found) {
    var prev = momRow(found.r);
    if (momKey([prev]) !== momKey([momClean(body.old)])) throw new Error(MOM_CONFLICT);
    sent = prev.sent.slice();
    if (prev.due !== it.due || prev.masa !== it.masa) sent = sent.filter(function (x) { return !momRem(x); });   // new due: reminders start over
    row = found.row; bil = found.r[0];
  } else {
    it.id = momNewId(); sent = [];
    row = Math.max(sh.getLastRow(), 1) + 1; bil = row - 1;
  }
  sh.getRange(row, 6).setNumberFormat("@");
  sh.getRange(row, 1, 1, MOM_COLS).setValues([momCells(it, bil, sent, now)]).setVerticalAlignment("top");
  SpreadsheetApp.flush();
  it.sent = sent;
  return { ok: true, item: it, isNew: !found, updated: now.toISOString() };
}

/** body: { id, old: <item as loaded> } — removes one item and renumbers Bil. */
function deleteMomItem(body) {
  var sh = momSheet(false);
  var found = sh && momFind(sh, text(body.id));
  if (!found) return { ok: true };
  if (momKey([momRow(found.r)]) !== momKey([momClean(body.old)])) throw new Error(MOM_CONFLICT);
  sh.deleteRow(found.row);
  var n = sh.getLastRow() - 1;
  if (n > 0) sh.getRange(2, 1, n, 1).setValues(range_(1, n).map(function (i) { return [i]; }));
  SpreadsheetApp.flush();
  return { ok: true };
}

// ----- Telegram messages for the SU Tengah bot -----

var MOM_HARI = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
var MOM_BULAN = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogo", "Sep", "Okt", "Nov", "Dis"];
function momFmtDate(s) {
  var m = text(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return MOM_HARI[d.getUTCDay()] + ", " + +m[3] + " " + MOM_BULAN[+m[2] - 1] + " " + m[1];
}
function momFmtTime(s) { return momTime(s); }   // 24-hour, e.g. "21:20"
function momFmtDue(it) {
  if (!it.due) return "Tiada";
  return momFmtDate(it.due) + (it.masa ? ", " + momFmtTime(it.masa) : "");
}
function momDue(it) {
  return it.due && it.masa ? Utilities.parseDate(it.due + " " + it.masa, MOM_TZ, "yyyy-MM-dd HH:mm") : null;
}
function momPics(it) { return it.pic.length ? it.pic.join(" ") : "Belum ditetapkan"; }
function momLeft(ms) {
  var min = Math.round(ms / 60000);
  if (min <= 0) return "sudah tiba masa due";
  if (min < 60) return min + " minit lagi";
  if (min < 1440) return Math.round(min / 60) + " jam lagi";
  return Math.round(min / 1440) + " hari lagi";
}

function momInfoText(it) {
  var unit = momUnit(it.unit);
  var lines = ["📝 MOM Tengah · " + (unit ? unit.label : "Tiada unit")];
  if (it.tarikh) lines.push("🗓 Mesyuarat: " + momFmtDate(it.tarikh));
  lines.push("", "📌 Tindakan: " + it.tindakan, "📅 Due: " + momFmtDue(it), "👤 PIC: " + momPics(it));
  return lines.join("\n");
}

function momAllText(items) {
  var dates = momUniq(items.map(function (it) { return it.tarikh; }));
  var head = "📝 MOM Tengah · " + items.length + " tindakan baru";
  if (dates.length === 1 && dates[0]) head += "\n🗓 Mesyuarat: " + momFmtDate(dates[0]);
  return head + "\n\n" + items.map(function (it, i) {
    var unit = momUnit(it.unit);
    var meta = [unit ? unit.label : "Tiada unit", "📅 " + momFmtDue(it), "👤 " + momPics(it)];
    if (dates.length > 1 && it.tarikh) meta.unshift("🗓 MOM " + momFmtDate(it.tarikh));
    return (i + 1) + ". " + it.tindakan + "\n    " + meta.join(" · ");
  }).join("\n\n");
}

function momReminderText(it, due, now) {
  var unit = momUnit(it.unit);
  return ["⏰ Peringatan MOM · " + momLeft(due.getTime() - now),
          "", "📌 Tindakan: " + it.tindakan, "📅 Due: " + momFmtDue(it),
          "🗂 " + (unit ? unit.label : "Tiada unit"), "👤 PIC: " + momPics(it)].join("\n");
}

/**
 * Messages that are due now, for the Netlify bot functions: { jobs: [{ thread, text, refs: [{ id, key }] }] }.
 * They are marked as sent at once (unless body.peek), so two runs never post the same message.
 * Keys in the "Telegram" column: "all" (in the MOM Keseluruhan list), "info" (posted to the unit's topic),
 * and the reminder ids ("15m", "2h", "3d", "1w", "1b").
 */
function momClaim(body) {
  var sh = momSheet(false);
  var rows = momRows(sh);
  var now = Date.now(), jobs = [], fresh = [], changed = [];
  rows.forEach(function (r, i) {
    if (!text(r[1]) || !text(r[3])) return;
    var it = momRow(r), sent = it.sent.slice();
    var unit = momUnit(it.unit);
    var thread = unit ? unit.thread : MOM_THREAD_ALL;
    var isNew = sent.indexOf("all") < 0;
    if (isNew) { fresh.push(it); sent.push("all"); }
    if (sent.indexOf("info") < 0) {   // announced to the unit's topic once; an item without a unit has nothing to announce there
      if (unit) jobs.push({ thread: thread, text: momInfoText(it), refs: [{ id: it.id, key: "info" }] });
      sent.push("info");
    }
    var due = momDue(it);
    if (due) {
      var hit = it.reminder.filter(function (x) {
        return sent.indexOf(x) < 0 && now >= due.getTime() - momRem(x).min * 60000 && now <= due.getTime() + MOM_LATE_GRACE * 60000;
      });
      // A new item already shows its due date, so reminders whose time has passed are skipped, not sent at once.
      if (hit.length && !isNew) jobs.push({ thread: thread, text: momReminderText(it, due, now), refs: hit.map(function (x) { return { id: it.id, key: x }; }) });
      sent = sent.concat(hit);
    }
    if (sent.join(",") !== it.sent.join(",")) changed.push({ row: i + 2, sent: sent });
  });
  if (fresh.length) jobs.unshift({ thread: MOM_THREAD_ALL, text: momAllText(fresh), refs: fresh.map(function (it) { return { id: it.id, key: "all" }; }) });
  if (!body.peek) {
    changed.forEach(function (c) { sh.getRange(c.row, 10).setValue(c.sent.join(", ")); });
    SpreadsheetApp.flush();
  }
  return { jobs: jobs };
}

// Time-driven trigger, every minute (Apps Script → Triggers → momReminderTick → Time-driven → Minutes timer →
// Every minute). Asks the Netlify bot (which holds the SU_BOT_TENGAH token) to post whatever is due; Netlify is
// called only when something is waiting, so most runs end after one quick read of the MOM tab.
var MOM_BOT_URL = "https://tdslkd.netlify.app/.netlify/functions/mom-hantar";
function momReminderTick() {
  var props = PropertiesService.getScriptProperties();
  var kod = props.getProperty("KOD_TENGAH") || props.getProperty("KOD_ADMIN");
  if (!kod) { Logger.log("KOD_TENGAH belum diisi dalam Script Properties."); return; }
  if (momClaim({ peek: true }).jobs.length) {
    var res = UrlFetchApp.fetch(MOM_BOT_URL, {
      method: "post", contentType: "application/json", payload: JSON.stringify({ kod: kod }), muteHttpExceptions: true
    });
    Logger.log(res.getResponseCode() + " " + res.getContentText());
  }
  try { picoTick(kod); } catch (e) { Logger.log("pico: " + e); }   // Checklist Mingguan (bot PICO)
  try { reportTick(kod); } catch (e) { Logger.log("report: " + e); }   // Reporting program (bot Program)
}

/** body: { refs: [{ id, key }] } — messages Telegram refused; they go back in the queue. */
function momRelease(body) {
  var sh = momSheet(false);
  var drop = {};
  (Array.isArray(body.refs) ? body.refs : []).forEach(function (x) {
    if (!x) return;
    (drop[text(x.id)] = drop[text(x.id)] || []).push(text(x.key));
  });
  momRows(sh).forEach(function (r, i) {
    var keys = drop[text(r[1])];
    if (!keys) return;
    sh.getRange(i + 2, 10).setValue(momList(r[9]).filter(function (s) { return keys.indexOf(s) < 0; }).join(", "));
  });
  return { ok: true };
}

// ---------- Checklist Mingguan + bot PICO ----------
//
// A weekly checklist on each school page (cawangan in WEEKLY_CAWANGAN). A week runs Isnin–Ahad (Malaysia time)
// and starts empty every Monday. An item is ticked by uploading a screenshot as proof (one per school per week).
// Kept in a "Checklist Mingguan" tab of the cawangan sheet: Minggu | Sekolah | Item | PIC | Screenshot | File ID |
// Masa | Telegram. Screenshots go to the same Drive folder as the Planning pictures.
//
// Bot PICO (token LEGALITY_BOT_TENGAH in Netlify; group Program Tengah) posts through the Netlify function pico:
//  - each new screenshot, right after it is uploaded (the page calls pico; the trigger retries if that failed);
//  - Isnin–Jumaat from 8:00 pagi: tags the PIC of schools that have not done the week's checklist;
//  - Sabtu from 8:00 pagi: summary of the week (failed = not done by Jumaat 23:59).
// picoClaim() hands out what is due and marks it as sent, so nothing goes out twice; picoRelease() puts back what
// Telegram refused. The every-minute trigger momReminderTick also asks pico to run when something is waiting.
var WEEKLY_TAB = "Checklist Mingguan";
var WEEKLY_HEAD = ["Minggu", "Sekolah", "Item", "PIC", "Screenshot", "File ID", "Masa", "Telegram"];
var WEEKLY_ITEMS = [{ key: "pm", label: "PM cikgu" }];
var WEEKLY_CAWANGAN = ["TENGAH"];
var PICO_HOUR = 8;          // daily reminder and Saturday summary go out from this hour …
var PICO_LAST_HOUR = 12;    // … until this hour (if the trigger was down at 8, they still go out that morning)
var PICO_BOT_URL = "https://tdslkd.netlify.app/.netlify/functions/pico";
var PICO_PENDING = "picoPending";   // cache flag: a screenshot is waiting to be posted
// Progress Semasa: every Isnin at 8 pagi PICO posts a weekly reminder listing every school; on the other days it
// posts an amaran (warning) for schools not updated for PROGRESS_STALE_DAYS or more (or never), until they update.
var PROGRESS_STALE_DAYS = 7;

function weeklyEnabled(c) { return WEEKLY_CAWANGAN.indexOf(text(c).toUpperCase()) >= 0; }

function picoYmd(ms) { return new Date(ms).toISOString().slice(0, 10); }
// The week of a moment, in Malaysia time: { start (Isnin), end (Ahad), today, dow (1 = Isnin … 7 = Ahad), hour }
function weekInfo(date) {
  var d = date || new Date();
  var today = Utilities.formatDate(d, MOM_TZ, "yyyy-MM-dd");
  var dow = +Utilities.formatDate(d, MOM_TZ, "u");
  var p = today.split("-"), base = Date.UTC(+p[0], +p[1] - 1, +p[2]);
  var mon = base - (dow - 1) * 86400000;
  return { start: picoYmd(mon), end: picoYmd(mon + 6 * 86400000), today: today, dow: dow,
           hour: +Utilities.formatDate(d, MOM_TZ, "H") };
}
function weekLabel(w) {
  var a = w.start.split("-"), b = w.end.split("-");
  return +a[2] + (a[1] === b[1] ? "" : " " + MOM_BULAN[+a[1] - 1]) + "–" + +b[2] + " " + MOM_BULAN[+b[1] - 1] + " " + b[0];
}

function weeklySheet(ss, create) {
  var sh = ss.getSheetByName(WEEKLY_TAB);
  if (sh || !create) return sh;
  sh = ss.insertSheet(WEEKLY_TAB);
  sh.getRange(1, 1, 1, WEEKLY_HEAD.length).setValues([WEEKLY_HEAD])
    .setFontWeight("bold").setBackground("#1f1f1f").setFontColor("#ffc300");
  sh.setFrozenRows(1);
  [100, 160, 120, 200, 300, 120, 140, 140].forEach(function (w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange("A:A").setNumberFormat("@");
  sh.getRange("G:G").setNumberFormat("d/m/yyyy h:mm");
  sh.getRange("F:F").setFontColor("#999999");
  sh.getRange("H:H").setFontColor("#999999");
  return sh;
}
function weeklyRows(sh) {
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, WEEKLY_HEAD.length).getValues();
}

/** This week's checklist of one school, for the school page (null when the cawangan has none). */
function readWeekly(ss, school, cawangan) {
  if (!weeklyEnabled(cawangan)) return null;
  var w = weekInfo();
  var rows = weeklyRows(weeklySheet(ss, false)).filter(function (r) { return text(r[0]) === w.start && text(r[1]) === school; });
  return {
    week: { start: w.start, end: w.end, label: weekLabel(w), lastDay: w.dow >= 5 },
    items: WEEKLY_ITEMS.map(function (it) {
      var r = rows.filter(function (x) { return text(x[2]) === it.label; })[0];
      return { key: it.key, label: it.label, done: !!r, pic: r ? text(r[3]) : "",
               shot: r && text(r[5]) ? imageView(text(r[5])) : null,
               at: r && r[6] instanceof Date ? r[6].toISOString() : "", posted: !!(r && text(r[7])) };
    })
  };
}

/** body: { cawangan, sekolah, item, mime, data (base64), name } — ticks one item with its screenshot. */
function saveWeekly(body) {
  if (!weeklyEnabled(body.cawangan)) throw new Error("Checklist Mingguan belum dibuka untuk cawangan ini.");
  var item = WEEKLY_ITEMS.filter(function (x) { return x.key === text(body.item); })[0];
  if (!item) throw new Error("Item checklist tidak dikenali.");
  var mime = text(body.mime);
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mime)) throw new Error("Screenshot mesti gambar JPG, PNG, WEBP atau GIF.");
  var bytes = Utilities.base64Decode(String(body.data || ""));
  if (!bytes.length) throw new Error("Screenshot kosong.");
  if (bytes.length > IMAGE_MAX_BYTES) throw new Error("Screenshot terlalu besar (had 8 MB).");
  var ss = book(body.cawangan);
  var school = text(body.sekolah);
  if (schoolNames(ss).indexOf(school) < 0) throw new Error("Sekolah tidak dijumpai: " + body.sekolah);
  var cawangan = text(body.cawangan).toUpperCase();
  var w = weekInfo();
  var sh = weeklySheet(ss, true);
  var done = weeklyRows(sh).some(function (r) { return text(r[0]) === w.start && text(r[1]) === school && text(r[2]) === item.label; });
  if (done) throw new Error(item.label + " sudah ditanda untuk minggu ini.");
  var name = item.label + " " + school + " " + w.today + (mime === "image/png" ? ".png" : ".jpg");
  var file = imageFolder(cawangan, school).createFile(Utilities.newBlob(bytes, mime, name));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  var pics = readPic(ss, school).filter(function (p) { return p.username; }).map(function (p) { return "@" + p.username; });
  var row = sh.getLastRow() + 1;
  sh.getRange(row, 1).setNumberFormat("@");
  sh.getRange(row, 1, 1, WEEKLY_HEAD.length).setValues([[w.start, school, item.label, pics.join(" "),
    imageView(file.getId()).url, file.getId(), new Date(), ""]]);
  SpreadsheetApp.flush();
  CacheService.getScriptCache().put(PICO_PENDING, "1", 21600);
  return { ok: true, weekly: readWeekly(ss, school, cawangan) };
}

// Which schools of a cawangan have not done the week's items: [{ sekolah, pics: ["@a"], missing: [labels], late }]
function weeklyStatus(ss, w, deadlineMs) {
  var rows = weeklyRows(weeklySheet(ss, false)).filter(function (r) { return text(r[0]) === w.start; });
  return schoolNames(ss).map(function (school) {
    var missing = [], late = false;
    WEEKLY_ITEMS.forEach(function (it) {
      var r = rows.filter(function (x) { return text(x[1]) === school && text(x[2]) === it.label; })[0];
      if (!r) missing.push(it.label);
      else if (deadlineMs && r[6] instanceof Date && r[6].getTime() > deadlineMs) { missing.push(it.label); late = true; }
    });
    var pics = readPic(ss, school).filter(function (p) { return p.username; }).map(function (p) { return "@" + p.username; });
    return { sekolah: school, pics: pics, missing: missing, late: late };
  });
}
function picoWho(s) { return s.pics.length ? s.pics.join(" ") : "(PIC belum ditetapkan)"; }
function picoItems() { return WEEKLY_ITEMS.map(function (x) { return x.label; }).join(", "); }

function picoDailyText(c, w, status) {
  var todo = status.filter(function (s) { return s.missing.length; });
  if (!todo.length) return "";
  var lines = ["📋 CHECKLIST MINGGUAN · " + c, "Minggu " + weekLabel(w) + " · " + picoItems(),
               w.dow >= 5 ? "⚠️ Hari ini hari terakhir (Jumaat)." : "Tinggal " + (6 - w.dow) + " hari (sehingga Jumaat).", "",
               "Belum selesai:"];
  todo.forEach(function (s) {
    lines.push("🏫 " + s.sekolah + " — " + picoWho(s) + (WEEKLY_ITEMS.length > 1 ? "\n     ✕ " + s.missing.join(", ") : ""));
  });
  lines.push("", "Tanda dan muat naik screenshot di: " + PORTAL_URL + "#/" + encodeURIComponent(c));
  return lines.join("\n");
}

function picoSummaryText(c, w, status) {
  var done = status.filter(function (s) { return !s.missing.length; });
  var failed = status.filter(function (s) { return s.missing.length; });
  var lines = ["📊 RINGKASAN CHECKLIST MINGGUAN · " + c, "Minggu " + weekLabel(w) + " · " + picoItems(), "",
               "✅ Selesai (" + done.length + ")"];
  done.forEach(function (s) { lines.push("• " + s.sekolah + " — " + picoWho(s)); });
  if (!done.length) lines.push("• Tiada");
  lines.push("", "❌ Gagal (" + failed.length + ")");
  failed.forEach(function (s) {
    lines.push("• " + s.sekolah + " — " + picoWho(s) + (s.late ? " (lewat)" : "") +
               (WEEKLY_ITEMS.length > 1 ? " · " + s.missing.join(", ") : ""));
  });
  if (!failed.length) lines.push("• Tiada. Tahniah semua! 🎉");
  return lines.join("\n");
}

// "baru tadi", "5 jam lepas", "1 hari lepas", "12 hari lepas"
function agoText(ms) {
  var min = Math.floor(ms / 60000);
  if (min < 60) return "baru tadi";
  if (min < 1440) return Math.floor(min / 60) + " jam lepas";
  return Math.floor(min / 1440) + " hari lepas";
}

// Every school of a cawangan with how long ago its Progress Semasa was updated, least recent first:
// [{ sekolah, pics, days (-1 = never written), ago, stale (7+ days or never) }]
function progressAges(ss) {
  var updated = {};
  var sh = ss.getSheetByName(PROGRESS_TAB);
  if (sh && sh.getLastRow() >= 2 && sh.getMaxColumns() >= noteCol() + 1) {
    sh.getRange(2, 1, sh.getLastRow() - 1, noteCol() + 1).getValues().forEach(function (r) {
      var d = r[noteCol()];
      if (text(r[0]) && text(r[noteCol() - 1]) && d instanceof Date) updated[text(r[0])] = d.getTime();
    });
  }
  var now = Date.now();
  return schoolNames(ss).map(function (school) {
    var t = updated[school];
    var days = t ? Math.floor((now - t) / 86400000) : -1;
    return { sekolah: school, days: days, ago: t ? agoText(now - t) : "", stale: days < 0 || days >= PROGRESS_STALE_DAYS,
             pics: readPic(ss, school).filter(function (p) { return p.username; }).map(function (p) { return "@" + p.username; }) };
  }).sort(function (a, b) { return (b.days < 0 ? 1e9 : b.days) - (a.days < 0 ? 1e9 : a.days); });
}

function progressLine(s, mark) {
  return (mark && s.stale ? "⚠️ " : "🏫 ") + s.sekolah + " — " + picoWho(s) + " · " +
         (s.days < 0 ? "belum pernah dikemas kini" : "dikemas kini " + s.ago);
}

// Isnin: weekly reminder listing every school. Other days: amaran for schools not updated for 7+ days (or never).
function picoProgressText(c, ages, w) {
  var url = "Kemas kini Progress Semasa di: " + PORTAL_URL + "#/" + encodeURIComponent(c);
  if (w.dow === 1) {
    var lines = ["📝 REMINDER MINGGUAN · PROGRESS LEGALITY SEMASA · " + c,
                 "Minggu " + weekLabel(w) + ". Mohon semua PIC kemas kini Progress Semasa sekolah masing-masing minggu ini 🙏", ""];
    ages.forEach(function (s) { lines.push(progressLine(s, true)); });
    if (ages.some(function (s) { return s.stale; })) {
      lines.push("", "⚠️ = tidak dikemas kini " + PROGRESS_STALE_DAYS + " hari atau lebih — amaran akan dihantar setiap hari sehingga dikemas kini.");
    }
    lines.push("", url);
    return lines.join("\n");
  }
  var stale = ages.filter(function (s) { return s.stale; });
  if (!stale.length) return "";
  var out = ["⚠️ AMARAN · PROGRESS LEGALITY SEMASA · " + c,
             "Progress Semasa sekolah berikut tidak dikemas kini " + PROGRESS_STALE_DAYS + " hari atau lebih. Mohon PIC kemas kini hari ini 🙏", ""];
  stale.forEach(function (s) { out.push(progressLine(s, false)); });
  out.push("", "Amaran ini dihantar setiap hari sehingga Progress Semasa dikemas kini.", url);
  return out.join("\n");
}

function picoCaption(r) {
  var at = r[6] instanceof Date ? r[6] : new Date();
  return "✅ " + text(r[2]) + " · " + text(r[1]) + "\n👤 " + (text(r[3]) || "(PIC belum ditetapkan)") + "\n🗓 " +
         momFmtDate(Utilities.formatDate(at, MOM_TZ, "yyyy-MM-dd")) + ", " + Utilities.formatDate(at, MOM_TZ, "HH:mm");
}

/**
 * What PICO should post now. body.peek: only { pending: n } (quick; used by the every-minute trigger).
 * body.preview: the messages without marking them (dry run). Otherwise the messages are marked as sent:
 * { jobs: [{ type: "text", text } | { type: "photo", caption, mime, data (base64), name }, refs: [...]] }
 */
function picoClaim(body) {
  var props = PropertiesService.getScriptProperties();
  var w = weekInfo();
  var inHours = w.hour >= PICO_HOUR && w.hour < PICO_LAST_HOUR;
  var dailyDue = inHours && w.dow <= 5 && props.getProperty("PICO_DAILY") !== w.today;
  var summaryDue = inHours && w.dow === 6 && props.getProperty("PICO_SUMMARY") !== w.today;
  var progressDue = inHours && props.getProperty("PICO_PROGRESS") !== w.today;   // every day (Isnin: weekly list)
  if (body.peek) {
    return { pending: (CacheService.getScriptCache().get(PICO_PENDING) ? 1 : 0) + (dailyDue ? 1 : 0) + (summaryDue ? 1 : 0) +
                      (progressDue ? 1 : 0) };
  }
  if (body.demo) return picoDemo(w);
  var mark = !body.preview, jobs = [];
  WEEKLY_CAWANGAN.forEach(function (c) {
    var ss = book(c), sh = weeklySheet(ss, false);
    weeklyRows(sh).forEach(function (r, i) {
      if (!text(r[5]) || text(r[7])) return;
      var job = { type: "photo", caption: picoCaption(r), name: text(r[2]) + ".jpg",
                  refs: [{ type: "photo", cawangan: c, row: i + 2, file: text(r[5]) }] };
      if (mark) {
        var blob = DriveApp.getFileById(text(r[5])).getBlob();
        job.mime = blob.getContentType(); job.data = Utilities.base64Encode(blob.getBytes());
        sh.getRange(i + 2, 8).setValue("Dihantar " + Utilities.formatDate(new Date(), MOM_TZ, "d/M HH:mm"));
      }
      jobs.push(job);
    });
    if (dailyDue) {
      var t = picoDailyText(c, w, weeklyStatus(ss, w, 0));
      if (t) jobs.push({ type: "text", text: t, refs: [{ type: "prop", key: "PICO_DAILY", old: props.getProperty("PICO_DAILY") || "" }] });
    }
    if (progressDue) {
      var pt = picoProgressText(c, progressAges(ss), w);
      if (pt) jobs.push({ type: "text", text: pt, refs: [{ type: "prop", key: "PICO_PROGRESS", old: props.getProperty("PICO_PROGRESS") || "" }] });
    }
    if (summaryDue) {
      // Saturday: the week that just ended (Isnin–Jumaat); done after Jumaat 23:59 counts as failed.
      var fri = w.start.split("-");
      var deadline = Utilities.parseDate(picoYmd(Date.UTC(+fri[0], +fri[1] - 1, +fri[2]) + 4 * 86400000) + " 23:59:59", MOM_TZ, "yyyy-MM-dd HH:mm:ss").getTime();
      jobs.push({ type: "text", text: picoSummaryText(c, w, weeklyStatus(ss, w, deadline)),
                  refs: [{ type: "prop", key: "PICO_SUMMARY", old: props.getProperty("PICO_SUMMARY") || "" }] });
    }
  });
  if (mark) {
    if (dailyDue) props.setProperty("PICO_DAILY", w.today);
    if (summaryDue) props.setProperty("PICO_SUMMARY", w.today);
    if (progressDue) props.setProperty("PICO_PROGRESS", w.today);
    CacheService.getScriptCache().remove(PICO_PENDING);
    SpreadsheetApp.flush();
  }
  return { jobs: jobs };
}

// Admin demo: the messages as they would look now, marked DEMO; nothing is marked as sent.
// PICO_DEMO picks which: "progress" (Progress Legality Sekolah only) or "all" (also the Checklist Mingguan ones).
var PICO_DEMO = "progress";
function picoDemo(w) {
  var jobs = [];
  WEEKLY_CAWANGAN.forEach(function (c) {
    var ss = book(c);
    if (PICO_DEMO === "all") {
      var daily = picoDailyText(c, w, weeklyStatus(ss, w, 0)) || "(Semua sekolah sudah selesai — tiada reminder.)";
      jobs.push({ type: "text", text: "🧪 DEMO — reminder harian (Isnin–Jumaat 8 pagi)\n\n" + daily, refs: [] });
      jobs.push({ type: "text", text: "🧪 DEMO — ringkasan (Sabtu 8 pagi)\n\n" + picoSummaryText(c, w, weeklyStatus(ss, w, 0)), refs: [] });
    }
    var ages = progressAges(ss);
    var mon = { start: w.start, end: w.end, dow: 1 }, other = { start: w.start, end: w.end, dow: 2 };
    jobs.push({ type: "text", text: "🧪 DEMO — reminder mingguan Progress (setiap Isnin 8 pagi)\n\n" + picoProgressText(c, ages, mon), refs: [] });
    jobs.push({ type: "text", text: "🧪 DEMO — amaran Progress (setiap hari 8 pagi, selagi belum dikemas kini)\n\n" +
               (picoProgressText(c, ages, other) || "(Tiada — semua sekolah dikemas kini dalam 7 hari.)"), refs: [] });
  });
  return { jobs: jobs };
}

/** body: { refs } — what Telegram refused goes back in the queue (tried again within a minute). */
function picoRelease(body) {
  var props = PropertiesService.getScriptProperties();
  (Array.isArray(body.refs) ? body.refs : []).forEach(function (x) {
    if (!x) return;
    if (x.type === "prop" && /^PICO_(DAILY|SUMMARY|PROGRESS)$/.test(text(x.key))) {
      if (text(x.old)) props.setProperty(x.key, text(x.old)); else props.deleteProperty(x.key);
    }
    if (x.type === "photo" && weeklyEnabled(x.cawangan)) {
      var sh = weeklySheet(book(x.cawangan), false);
      var row = +x.row;
      if (sh && row >= 2 && row <= sh.getLastRow() && text(sh.getRange(row, 6).getValue()) === text(x.file)) {
        sh.getRange(row, 8).setValue("");
        CacheService.getScriptCache().put(PICO_PENDING, "1", 21600);
      }
    }
  });
  return { ok: true };
}

function picoTick(kod) {
  if (!picoClaim({ peek: true }).pending) return;
  var res = UrlFetchApp.fetch(PICO_BOT_URL, {
    method: "post", contentType: "application/json", payload: JSON.stringify({ kod: kod }), muteHttpExceptions: true
  });
  Logger.log("pico " + res.getResponseCode() + " " + res.getContentText());
}

// ---------- Reporting program (bot TELEGRAM_BOT_TOKEN) ----------
//
// After a programme of a cawangan in REPORT_CAWANGAN ends, the Program bot (token TELEGRAM_BOT_TOKEN in Netlify)
// chases its report in the Reporting topic (t.me/c/2078197579/4523), tagging the Main PIC and PIC Legality of the
// Program form:
//   program tamat + 2 jam → duplicate the Canva template, tap "Siap duplicate", reply with the Canva link
//   every 2 days, 9 pagi  → "Report sudah siap?" [Sudah siap] [Belum]
//   Sudah siap            → approval request in Program Tengah, topic 60: [Lulus] [Perlu baiki]
//   Lulus                 → Reporting = Lulus (ticked); Perlu baiki → the admin's comment goes back to the topic
//                           and the follow-ups continue until it is approved.
// Only programmes sent after this was added are chased (their Reporting column is filled when they are saved).
// Kept in extra columns of the Program sheet (REPORT_HEAD, after "Telegram"). Netlify functions report-bot (sends
// what is due, called by the every-minute trigger) and telegram-webhook (buttons and replies) use the actions
// reportClaim / reportRelease / reportUpdate below.
var REPORT_CAWANGAN = ["TENGAH"];
var REPORT_HEAD = ["Reporting", "Link Canva", "Reporting dikemas kini", "Follow-up seterusnya", "Komen reporting", "Video program"];
var REPORT_COL = PROGRAM_HEAD.length + 1;   // first reporting column
var REPORT_TEMPLATE = "https://canva.link/m38sc8m51fkhgjq";
var REPORT_AFTER_HOURS = 2;
var REPORT_EVERY_DAYS = 2;
var REPORT_HOUR = 9;
var REPORT_NEXT = "reportNextAt";   // cache: when the next reporting message is due (ms)
var RS = { WAIT: "Menunggu program tamat", TEMPLATE: "Template", MAKING: "Sedang dibuat", REVIEW: "Menunggu kelulusan",
           FIX: "Perlu baiki", DONE: "Lulus", CONFIRM: "Menunggu pengesahan", CANCEL: "Dibatalkan" };

function ensureReportHeader(sh) {
  if (sh.getMaxColumns() < REPORT_COL + REPORT_HEAD.length - 1) {
    sh.insertColumnsAfter(sh.getMaxColumns(), REPORT_COL + REPORT_HEAD.length - 1 - sh.getMaxColumns());
  }
  if (text(sh.getRange(1, REPORT_COL).getValue()) === REPORT_HEAD[0]) return;
  sh.getRange(1, REPORT_COL, 1, REPORT_HEAD.length).setValues([REPORT_HEAD])
    .setFontWeight("bold").setBackground("#1f1f1f").setFontColor("#ffc300").setVerticalAlignment("middle");
  sh.setColumnWidth(REPORT_COL, 150);
  sh.setColumnWidth(REPORT_COL + 1, 240);
  sh.getRange(1, REPORT_COL + 2, sh.getMaxRows(), 2).setNumberFormat("d/m/yyyy h:mm");
}

// "@ali (Alumni · Kader Tengah)" -> "@ali"
function handleOf(v) { var m = text(v).match(/@[A-Za-z0-9_]{3,40}/); return m ? m[0] : ""; }
// The next REPORT_HOUR o'clock, REPORT_EVERY_DAYS days from now (Malaysia time)
function reportNextFollowUp(fromMs) {
  var day = Utilities.formatDate(new Date((fromMs || Date.now()) + REPORT_EVERY_DAYS * 86400000), MOM_TZ, "yyyy-MM-dd");
  return Utilities.parseDate(day + " " + ("0" + REPORT_HOUR).slice(-2) + ":00", MOM_TZ, "yyyy-MM-dd HH:mm");
}
// End of the programme: Tarikh tamat + end time from "08:00 – 17:00" (17:00 if none), Malaysia time
function programEnd(tamat, masa) {
  var day = tamat instanceof Date ? Utilities.formatDate(tamat, Session.getScriptTimeZone(), "yyyy-MM-dd") : text(tamat);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  var m = text(masa).match(/(\d{1,2}):(\d{2})\s*$/);
  return Utilities.parseDate(day + " " + (m ? ("0" + m[1]).slice(-2) + ":" + m[2] : "17:00"), MOM_TZ, "yyyy-MM-dd HH:mm");
}

/** Called by saveProgram for a NEW programme row: starts its reporting if the cawangan takes part. */
function startReporting(sh, r, cawangan, telegram, row) {
  if (REPORT_CAWANGAN.indexOf(cawangan) < 0 || !/^Berjaya/.test(text(telegram))) return;
  ensureReportHeader(sh);
  if (text(sh.getRange(r, REPORT_COL).getValue())) return;
  var end = programEnd(row[8], row[9]);
  var due = end ? new Date(end.getTime() + REPORT_AFTER_HOURS * 3600000) : new Date();
  sh.getRange(r, REPORT_COL, 1, 4).setValues([[RS.WAIT, "", new Date(), due]]);
  CacheService.getScriptCache().remove(REPORT_NEXT);
}

function reportRow(r) {
  var c = REPORT_COL - 1;
  return {
    id: text(r[0]), cawangan: text(r[2]), sekolah: text(r[3]), nama: text(r[5]),
    tamat: r[8] instanceof Date ? Utilities.formatDate(r[8], Session.getScriptTimeZone(), "yyyy-MM-dd") : text(r[8]),
    pics: momUniq([handleOf(r[17]), handleOf(r[18])]),
    status: text(r[c]), link: text(r[c + 1]), next: r[c + 3] instanceof Date ? r[c + 3].getTime() : 0, komen: text(r[c + 4])
  };
}
function reportRows(sh) {
  if (sh.getLastRow() < 2 || sh.getMaxColumns() < REPORT_COL + REPORT_HEAD.length - 1) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, REPORT_COL + REPORT_HEAD.length - 1).getValues();
}
function reportFind(sh, id) {
  var rows = reportRows(sh);
  for (var i = 0; i < rows.length; i++) if (text(rows[i][0]) === id) return { row: i + 2, p: reportRow(rows[i]) };
  return null;
}
function reportHead(p) {
  return "📌 " + p.nama + "\n🏫 " + p.sekolah + (p.tamat ? " · 📅 " + momFmtDate(p.tamat) : "") +
         "\n👤 " + (p.pics.length ? p.pics.join(" ") : "(PIC tiada username)");
}

/**
 * Reporting messages that are due now (marked as sent at once; body.peek only counts them):
 * { jobs: [{ id, kind: "start" | "link" | "ask", text, buttons: [[{ text, data }]] }] }
 */
function reportClaim(body) {
  var sh = programSheet();
  var rows = reportRows(sh);
  var now = Date.now(), jobs = [], earliest = 0;
  rows.forEach(function (r, i) {
    var p = reportRow(r);
    if (!p.id || [RS.WAIT, RS.CONFIRM, RS.TEMPLATE, RS.MAKING, RS.FIX].indexOf(p.status) < 0 || !p.next) return;
    if (p.next > now) { if (!earliest || p.next < earliest) earliest = p.next; return; }
    var job = { id: p.id };
    if (p.status === RS.WAIT || p.status === RS.CONFIRM) {
      // 1st question: did the programme run? (Ya → duplicate the template; Tidak → Dibatalkan, nothing more)
      job.kind = "run";
      job.text = (p.status === RS.WAIT ? "📝 REPORTING PROGRAM\n\n" : "⏰ PERINGATAN REPORTING\n\n") + reportHead(p) +
                 "\n\nAdakah program \"" + p.nama + "\" berjalan?";
      job.buttons = [[{ text: "✅ Ya, berjalan", data: "rp:ya:" + p.id }, { text: "❌ Tidak berjalan", data: "rp:batal:" + p.id }]];
    } else if (p.status === RS.TEMPLATE) {
      job.kind = "link";
      job.text = "⏰ PERINGATAN REPORTING\n\n" + reportHead(p) + "\n\nLink Canva report belum dihantar.\n" +
                 "Duplicate template: " + REPORT_TEMPLATE + "\nkemudian tekan \"✅ Siap duplicate\".";
      job.buttons = [[{ text: "✅ Siap duplicate", data: "rp:dup:" + p.id }]];
    } else {
      job.kind = "ask";
      job.text = (p.status === RS.FIX ? "⏰ FOLLOW-UP REPORTING (perlu baiki)\n\n" : "⏰ FOLLOW-UP REPORTING\n\n") + reportHead(p) +
                 (p.link ? "\n🔗 " + p.link : "") + (p.status === RS.FIX && p.komen ? "\n✏️ Perlu baiki: " + p.komen : "") +
                 "\n\nReport sudah siap?";
      job.buttons = [[{ text: "✅ Sudah siap", data: "rp:siap:" + p.id }, { text: "⏳ Belum", data: "rp:belum:" + p.id }]];
    }
    jobs.push(job);
    if (!body.peek) {
      var next = reportNextFollowUp(now);
      sh.getRange(i + 2, REPORT_COL, 1, 4).setValues([[p.status === RS.WAIT ? RS.CONFIRM : p.status, p.link, new Date(), next]]);
      if (!earliest || next.getTime() < earliest) earliest = next.getTime();
    }
  });
  if (!body.peek) {
    SpreadsheetApp.flush();
    CacheService.getScriptCache().put(REPORT_NEXT, String(earliest || now + 6 * 3600000), 21600);
    CacheService.getScriptCache().remove("programs");
  }
  return { jobs: jobs };
}

/** body: { ids } — messages Telegram refused: try again in 5 minutes. */
function reportRelease(body) {
  var sh = programSheet();
  (Array.isArray(body.ids) ? body.ids : []).forEach(function (id) {
    var f = reportFind(sh, text(id));
    if (!f) return;
    sh.getRange(f.row, REPORT_COL + 3).setValue(new Date(Date.now() + 5 * 60000));
  });
  CacheService.getScriptCache().remove(REPORT_NEXT);
  return { ok: true };
}

/**
 * Buttons and replies from Telegram (Netlify telegram-webhook). body: { id, step, url?, note?, by? }
 *   info   → the programme (no change)
 *   ran    → the programme ran                           → Template (duplicate it)
 *   cancel → the programme did not run                   → Dibatalkan (stops)
 *   link   → Canva link received                          → Sedang dibuat
 *   submit → PIC says the report is ready                 → Menunggu kelulusan
 *   approve→ approved in Program Tengah                   → Lulus (stops)
 *   reject → needs changes (note = what to fix)           → Perlu baiki, follow-up again in 2 days
 * Returns { ok, program, changed } — changed is false when the step no longer applies (e.g. already approved).
 */
function reportUpdate(body) {
  // "Siap duplicate" remembers (1 hour) which programme a person is sending a link for, so a plain message with the
  // link works too (no reply needed): body.waitKey = "<chat>:<user>"; without body.id the remembered one is used.
  var cache = CacheService.getScriptCache(), waitKey = text(body.waitKey) ? "rpwait:" + text(body.waitKey) : "";
  if (!text(body.id) && waitKey) {
    var wid = cache.get(waitKey);
    if (!wid) return { ok: true, none: true };
    body.id = wid;
  }
  var sh = programSheet();
  ensureReportHeader(sh);
  var f = reportFind(sh, text(body.id));
  if (!f || !f.p.status) throw new Error("Program ini tiada dalam senarai reporting.");
  var p = f.p, step = text(body.step), now = new Date();
  var set = null;
  if (step === "link") {
    var url = text(body.url).slice(0, 400);
    if (!/^https?:\/\/\S+$/.test(url)) throw new Error("Link tidak sah.");
    if (!/^https?:\/\/([a-z0-9-]+\.)*canva\.(com|link)\//i.test(url + "/")) throw new Error("Bukan link Canva.");
    if (url.replace(/^https?:\/\/(www\.)?/i, "").replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase() ===
        REPORT_TEMPLATE.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/+$/, "").toLowerCase()) throw new Error("Ini link template.");
    if (p.status === RS.DONE || p.status === RS.REVIEW) return { ok: true, changed: false, program: p };
    set = [p.status === RS.FIX ? RS.FIX : RS.MAKING, url, now, reportNextFollowUp(now.getTime()), p.komen];
    if (waitKey) cache.remove(waitKey);
  } else if (step === "wait") {     // "Siap duplicate" pressed: the next link from this person is for this programme
    if (waitKey) cache.put(waitKey, p.id, 3600);
  } else if (step === "ran") {      // the programme ran → the PIC duplicates the template
    if ([RS.WAIT, RS.CONFIRM].indexOf(p.status) < 0) return { ok: true, changed: false, program: p };
    set = [RS.TEMPLATE, "", now, reportNextFollowUp(now.getTime()), ""];
  } else if (step === "cancel") {   // the programme did not run → Dibatalkan, no more messages
    if ([RS.WAIT, RS.CONFIRM].indexOf(p.status) < 0) return { ok: true, changed: false, program: p };
    set = [RS.CANCEL, "", now, "", "Program tidak berjalan (" + text(body.by).slice(0, 60) + ")"];
  } else if (step === "submit") {
    if ([RS.MAKING, RS.FIX, RS.TEMPLATE].indexOf(p.status) < 0) return { ok: true, changed: false, program: p };
    if (!p.link) return { ok: true, changed: false, needLink: true, program: p };
    set = [RS.REVIEW, p.link, now, "", p.komen];
  } else if (step === "approve") {
    if (p.status !== RS.REVIEW) return { ok: true, changed: false, program: p };
    set = [RS.DONE, p.link, now, "", "Diluluskan oleh " + text(body.by).slice(0, 60)];
  } else if (step === "reject") {
    if (p.status !== RS.REVIEW) return { ok: true, changed: false, program: p };
    var note = text(body.note).slice(0, 1000);
    if (!note) throw new Error("Komen kosong.");
    set = [RS.FIX, p.link, now, reportNextFollowUp(now.getTime()), safe(note)];
    if (waitKey) cache.remove(waitKey);
  } else if (step !== "info") {
    throw new Error("Langkah tidak dikenali: " + step);
  }
  if (set) {
    sh.getRange(f.row, REPORT_COL, 1, 5).setValues([set]);
    SpreadsheetApp.flush();
    CacheService.getScriptCache().remove(REPORT_NEXT);
    CacheService.getScriptCache().remove("programs");
    p = reportFind(sh, p.id).p;
  }
  return { ok: true, changed: !!set, program: p };
}

/** Admin test: a test programme ("TEST-…") whose reminder is due now. Its PIC messages go to the testing topic
 *  instead of the Reporting topic (Netlify report-bot). body.pics: up to 2 usernames used as Main PIC / PIC Legality. { id } */
function reportTest(body) {
  var tagged = (body && Array.isArray(body.pics) ? body.pics : []).map(handleOf).filter(Boolean);
  var sh = programSheet();
  ensureReportHeader(sh);
  var id = "TEST-" + Utilities.getUuid().slice(0, 8);
  var now = new Date();
  var row = [id, now, "TENGAH", "UJIAN", "Selangor", "UJIAN REPORTING (abaikan)", "Ujian",
             ymd(Utilities.formatDate(now, MOM_TZ, "yyyy-MM-dd")), ymd(Utilities.formatDate(now, MOM_TZ, "yyyy-MM-dd")),
             "'08:00 – 10:00", "", 0, "", 0, 0, 0, "", tagged[0] || "", tagged[1] || tagged[0] || "", "", "Ujian"];
  sh.appendRow(row);
  var r = sh.getLastRow();
  sh.getRange(r, REPORT_COL, 1, 4).setValues([[RS.WAIT, "", now, now]]);
  SpreadsheetApp.flush();
  CacheService.getScriptCache().remove(REPORT_NEXT);
  CacheService.getScriptCache().remove("programs");
  return { ok: true, id: id };
}
/** Run from the editor: removes old test programmes and makes a new one tagging REPORT_TEST_PICS; the
 *  every-minute trigger then posts its first reminder to the testing topic (no access code needed). */
var REPORT_TEST_PICS = ["@akmalasyraaaf"];
function reportTestDemo() {
  reportTestClear();
  var r = reportTest({ pics: REPORT_TEST_PICS });
  Logger.log(JSON.stringify(r));
  return r;
}
/** Programmes of a REPORT_CAWANGAN that have already ended but never had reporting started (made before the
 *  reporting bot existed). apply = true starts them, one minute apart, so they are posted to the Reporting topic. */
function reportBackfill(apply) {
  var sh = programSheet();
  ensureReportHeader(sh);
  if (sh.getLastRow() < 2) return [];
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, REPORT_COL).getValues();
  var now = Date.now(), out = [];
  rows.forEach(function (r, i) {
    var id = text(r[0]);
    if (!id || /^TEST-/.test(id) || REPORT_CAWANGAN.indexOf(text(r[2])) < 0 || text(r[REPORT_COL - 1])) return;
    var end = programEnd(r[8], r[9]);
    if (!end || end.getTime() + REPORT_AFTER_HOURS * 3600000 > now) return;
    out.push({ row: i + 2, id: id, nama: text(r[5]), sekolah: text(r[3]), tamat: Utilities.formatDate(end, MOM_TZ, "yyyy-MM-dd") });
  });
  if (apply) {
    out.forEach(function (x, k) {
      sh.getRange(x.row, REPORT_COL, 1, 4).setValues([[RS.WAIT, "", new Date(), new Date(now + k * 60000)]]);
    });
    SpreadsheetApp.flush();
    CacheService.getScriptCache().remove(REPORT_NEXT);
    CacheService.getScriptCache().remove("programs");
  }
  return out;
}
/** Run from the editor: lists what reportBackfillRun would start (see the execution log). */
function reportBackfillPreview() {
  var list = reportBackfill(false);
  Logger.log(list.length + " program:\n" + list.map(function (x) { return x.tamat + " · " + x.sekolah + " · " + x.nama; }).join("\n"));
  return list.length;
}
/** Run from the editor: starts reporting for every programme reportBackfillPreview lists. */
function reportBackfillRun() {
  var list = reportBackfill(true);
  Logger.log(list.length + " program dimulakan.");
  return list.length;
}
/** Admin: removes the test programmes (ID "TEST-…"). */
function reportTestClear() {
  var sh = programSheet();
  var n = 0;
  if (sh.getLastRow() > 1) {
    var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = ids.length - 1; i >= 0; i--) if (/^TEST-/.test(text(ids[i][0]))) { sh.deleteRow(i + 2); n++; }
  }
  CacheService.getScriptCache().remove(REPORT_NEXT);
  CacheService.getScriptCache().remove("programs");
  return { ok: true, removed: n };
}

// Every-minute trigger (momReminderTick): ask the Netlify bot to post when a reporting message is due.
var REPORT_BOT_URL = "https://tdslkd.netlify.app/.netlify/functions/report-bot";
function reportTick(kod) {
  var at = +(CacheService.getScriptCache().get(REPORT_NEXT) || 0);
  if (at && Date.now() < at) return;
  if (!at) {   // nothing cached: look once, and remember when the next one is due
    var due = reportClaim({ peek: true }).jobs.length;
    if (!due) {
      var earliest = 0;
      reportRows(programSheet()).forEach(function (r) {
        var p = reportRow(r);
        if ([RS.WAIT, RS.CONFIRM, RS.TEMPLATE, RS.MAKING, RS.FIX].indexOf(p.status) > -1 && p.next && (!earliest || p.next < earliest)) earliest = p.next;
      });
      CacheService.getScriptCache().put(REPORT_NEXT, String(earliest || Date.now() + 6 * 3600000), 21600);
      return;
    }
  }
  var res = UrlFetchApp.fetch(REPORT_BOT_URL, {
    method: "post", contentType: "application/json", payload: JSON.stringify({ kod: kod }), muteHttpExceptions: true
  });
  Logger.log("report " + res.getResponseCode() + " " + res.getContentText());
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
  markSummaryStale();
  if (key === "crm") CacheService.getScriptCache().remove(teachersKey(body.cawangan, body.sekolah));
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
  markSummaryStale();
  SpreadsheetApp.flush();
  CacheService.getScriptCache().remove("schoolList:" + text(cawangan).toUpperCase());
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
  markSummaryStale();
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
  markSummaryStale();
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
