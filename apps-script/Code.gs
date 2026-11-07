/**
 * Yosh Junior · Unit Murabbi — Google Apps Script behind borang.html and the dashboard.
 *
 * The Google Sheet this script is attached to holds four tabs:
 *   Tetapan  – which month the form is open for, and whether it is open
 *   Soalan   – the questions, one row per question per month (edit freely each month)
 *   Murabbi  – the list of murabbi (cawangan + nama) shown in the form
 *   Jawapan  – every submission; one column per question code (added automatically)
 *
 * Setup steps are in apps-script/README.md.
 */

var TAB = { settings: "Tetapan", questions: "Soalan", people: "Murabbi", answers: "Jawapan" };
var BASE = ["Masa", "Bulan", "Cawangan", "Nama"];
var TYPES = ["Ya/Tidak", "Nombor", "Pilihan", "Teks", "Teks panjang"];
var VIEWS = ["Tindakan", "Progress", "Jumlah", "Kekerapan", "Purata", "Analisa", "Butiran"];
var MONTHS = ["Januari", "Februari", "Mac", "April", "Mei", "Jun", "Julai",
              "Ogos", "September", "Oktober", "November", "Disember"];

// ---------- Web app entry points ----------

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "data";
  try {
    if (action === "config") return json(formConfig());
    if (action === "data") return json(allData());
    return json({ error: "Tindakan tidak dikenali: " + action });
  } catch (err) {
    return json({ error: String(err && err.message || err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    var body = JSON.parse(e.postData.contents);
    lock.waitLock(20000);
    return json(submit(body));
  } catch (err) {
    return json({ error: String(err && err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (x) {}
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Reading the sheet ----------

function tab(name) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name);
  if (!s) throw new Error("Tab '" + name + "' tiada. Jalankan setup() dahulu.");
  return s;
}

function values(name) {
  var s = tab(name);
  if (s.getLastRow() < 1) return [];
  return s.getDataRange().getValues();
}

function text(v) { return String(v == null ? "" : v).trim(); }

// "2026-10" typed into a cell may come back as a date; accept both.
function monthId(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM");
  var m = text(v).match(/^(\d{4})-(\d{1,2})$/);
  return m ? m[1] + "-" + ("0" + m[2]).slice(-2) : "";
}

function monthLabel(id) {
  var m = id.match(/^(\d{4})-(\d{2})$/);
  return m ? MONTHS[+m[2] - 1] + " " + m[1] : id;
}

function settings() {
  var map = {};
  values(TAB.settings).slice(1).forEach(function (r) { map[text(r[0]).toLowerCase()] = r[1]; });
  return {
    month: monthId(map["bulan dibuka"]),
    open: /^ya$/i.test(text(map["borang dibuka"]))
  };
}

function normType(v) {
  var t = text(v).toLowerCase();
  if (t === "ya/tidak") return "yesno";
  if (t === "nombor") return "number";
  if (t === "pilihan") return "choice";
  if (t === "teks panjang") return "longtext";
  return "text";
}

function questions(month) {
  return values(TAB.questions).slice(1).filter(function (r) {
    return monthId(r[0]) === month && text(r[1]);
  }).map(function (r) {
    return {
      code: text(r[1]),
      text: text(r[2]),
      label: text(r[3]) || text(r[2]),
      type: normType(r[4]),
      options: text(r[5]) ? text(r[5]).split(/\s*[,\n]\s*/).filter(String) : [],
      view: text(r[6]).toLowerCase() || "butiran",
      required: /^ya$/i.test(text(r[7]))
    };
  });
}

function people() {
  return values(TAB.people).slice(1).filter(function (r) {
    return text(r[0]) && text(r[1]) && !/^tidak$/i.test(text(r[2]));
  }).map(function (r) { return { cawangan: text(r[0]), nama: text(r[1]) }; });
}

function formConfig() {
  var s = settings();
  return {
    open: s.open && !!s.month,
    month: s.month,
    monthLabel: monthLabel(s.month),
    questions: s.month ? questions(s.month) : [],
    murabbi: people()
  };
}

// Every month that has answers, newest first; each person keeps only their latest submission.
function allData() {
  var tz = Session.getScriptTimeZone();
  var v = values(TAB.answers);
  if (v.length < 2) return { months: [] };
  var head = v[0].map(text);
  var byMonth = {};
  v.slice(1).forEach(function (r) {
    var id = monthId(r[1]);
    if (!id) return;
    var when = r[0] instanceof Date ? r[0] : new Date(r[0]);
    var row = {
      time: isNaN(when) ? text(r[0]) : Utilities.formatDate(when, tz, "dd/MM/yyyy HH:mm:ss"),
      stamp: isNaN(when) ? 0 : when.getTime(),
      cawangan: text(r[2]),
      nama: text(r[3]),
      answers: {}
    };
    for (var c = BASE.length; c < head.length; c++) {
      if (head[c] && text(r[c]) !== "") row.answers[head[c]] = text(r[c]);
    }
    var m = byMonth[id] || (byMonth[id] = { received: 0, people: {} });
    m.received++;
    var key = (row.cawangan + "|" + row.nama).toLowerCase();
    if (!m.people[key] || m.people[key].stamp <= row.stamp) m.people[key] = row;
  });
  var months = Object.keys(byMonth).sort().reverse().map(function (id) {
    var rows = Object.keys(byMonth[id].people).map(function (k) { return byMonth[id].people[k]; })
      .sort(function (a, b) { return a.stamp - b.stamp; });
    rows.forEach(function (x) { delete x.stamp; });
    return {
      id: id,
      label: monthLabel(id),
      questions: questions(id),
      received: byMonth[id].received,
      duplicatesRemoved: byMonth[id].received - rows.length,
      rows: rows
    };
  });
  return { months: months };
}

// ---------- Saving a submission ----------

// Stops answers like "=IMPORTXML(...)" from being run as a formula in the sheet.
function safe(v) {
  var s = String(v == null ? "" : v).slice(0, 3000);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function submit(body) {
  var s = settings();
  if (!s.open || !s.month) throw new Error("Borang ditutup buat masa ini.");
  if (body.month !== s.month) throw new Error("Borang telah bertukar ke bulan " + monthLabel(s.month) + ". Muat semula halaman.");

  var who = people().filter(function (p) {
    return p.cawangan === text(body.cawangan) && p.nama === text(body.nama);
  })[0];
  if (!who) throw new Error("Nama tidak dijumpai dalam senarai murabbi. Muat semula halaman.");

  var qs = questions(s.month);
  var answers = body.answers || {};
  var missing = qs.filter(function (q) { return q.required && text(answers[q.code]) === ""; });
  if (missing.length) throw new Error("Sila jawab: " + missing.map(function (q) { return q.label; }).join(", "));

  var sheet = tab(TAB.answers);
  var head = sheet.getLastColumn() ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(text) : [];
  if (!head.length) { head = BASE.slice(); sheet.getRange(1, 1, 1, head.length).setValues([head]); }
  qs.forEach(function (q) {
    if (head.indexOf(q.code) < 0) {
      head.push(q.code);
      sheet.getRange(1, head.length).setValue(q.code);
    }
  });

  var row = head.map(function () { return ""; });
  row[0] = new Date();
  row[1] = "'" + s.month;
  row[2] = safe(who.cawangan);
  row[3] = safe(who.nama);
  qs.forEach(function (q) {
    var a = text(answers[q.code]);
    if (a === "") return;
    row[head.indexOf(q.code)] = q.type === "number" && /^\d+(\.\d+)?$/.test(a) ? Number(a) : safe(a);
  });
  sheet.appendRow(row);
  return { ok: true, month: s.month, monthLabel: monthLabel(s.month), nama: who.nama };
}

// ---------- One-time setup (run from the Apps Script editor) ----------

function setup() {
  var book = SpreadsheetApp.getActiveSpreadsheet();
  function ensure(name, head) {
    var s = book.getSheetByName(name) || book.insertSheet(name);
    if (s.getLastRow() === 0) {
      s.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight("bold");
      s.setFrozenRows(1);
    }
    return s;
  }

  var set = ensure(TAB.settings, ["Tetapan", "Nilai"]);
  if (set.getLastRow() < 2) {
    set.getRange(2, 1, 2, 2).setNumberFormat("@").setValues([["Bulan dibuka", "2026-10"], ["Borang dibuka", "Ya"]]);
  }
  set.getRange(3, 2).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Ya", "Tidak"], true).build());

  var q = ensure(TAB.questions, ["Bulan", "Kod", "Soalan", "Label pendek", "Jenis", "Pilihan", "Paparan", "Wajib"]);
  q.getRange("A:A").setNumberFormat("@");
  q.getRange("E2:E1000").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(TYPES, true).build());
  q.getRange("G2:G1000").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(VIEWS, true).build());
  q.getRange("H2:H1000").setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(["Ya", "Tidak"], true).build());
  if (q.getLastRow() < 2) {
    var rows = STARTER_QUESTIONS.map(function (r) { return ["2026-10"].concat(r); });
    q.getRange(2, 1, rows.length, 8).setValues(rows);
  }

  ensure(TAB.people, ["Cawangan", "Nama", "Aktif"]);
  var a = ensure(TAB.answers, BASE);
  a.getRange("B:B").setNumberFormat("@");
}

// Starting question set (September's report). Edit or copy these rows in the Soalan tab each month.
// [Kod, Soalan, Label pendek, Jenis, Pilihan, Paparan, Wajib]
var STARTER_QUESTIONS = [
  ["turun", "Berapa kali antum turun sekolah bulan ini?", "Turun sekolah", "Nombor", "", "Kekerapan", "Ya"],
  ["sirah", "Adakah antum bawa artikel sirah?", "Bawa artikel sirah", "Ya/Tidak", "", "Butiran", "Ya"],
  ["integrasi", "Adakah antum bawa integrasi menthiqohkan?", "Bawa integrasi", "Ya/Tidak", "", "Butiran", "Ya"],
  ["artikel", "Berapa banyak artikel sirah yang antum bawa? (contoh: 30)", "Artikel sirah", "Nombor", "", "Purata", "Ya"],
  ["telefon", "Adakah antum letakkan nombor telefon antum pada artikel?", "Letak nombor telefon", "Ya/Tidak", "", "Tindakan", "Ya"],
  ["share", "Adakah antum arahkan MT untuk sharekan artikel?", "Arah MT share artikel", "Ya/Tidak", "", "Tindakan", "Ya"],
  ["tampal", "Adakah antum arahkan MT untuk tampal artikel?", "Arah MT tampal artikel", "Ya/Tidak", "", "Tindakan", "Ya"],
  ["pancang", "Adakah antum menyampaikan tanam pancang?", "Tanam pancang", "Ya/Tidak", "", "Tindakan", "Ya"],
  ["kenal", "1. Adakah antum telah memperkenalkan …?", "Memperkenalkan (1)", "Ya/Tidak", "", "Tindakan", "Ya"],
  ["talk", "2. Ada buat talk online dan jemput ikh akh level H1?", "Talk online level H1", "Ya/Tidak", "", "Tindakan", "Ya"],
  ["task", "3. Ada bagi task pada MT untuk contact ikh akh?", "Task MT contact ikh akh", "Ya/Tidak", "", "Tindakan", "Ya"],
  ["influencer", "4. Ada kenalkan ikh akh influencer?", "Kenalkan influencer", "Ya/Tidak", "", "Tindakan", "Ya"],
  ["qiyadah", "5. Ada kenalkan qiyadah dakwah?", "Kenalkan qiyadah dakwah", "Ya/Tidak", "", "Tindakan", "Ya"],
  ["contactbalik", "6. Ada bagi pengarahan untuk contact balik ikh akh?", "Arah contact balik ikh akh", "Ya/Tidak", "", "Tindakan", "Ya"],
  ["kumpul", "Berapa ramai mad'u/MT baru yang antum berjaya kumpul?", "Mad'u dikumpul", "Nombor", "", "Progress", "Ya"],
  ["dicontact", "Berapa ramai mad'u yang berjaya dicontact?", "Berjaya dicontact", "Nombor", "", "Progress", "Ya"],
  ["pertemuan", "Berapa ramai mad'u yang berjaya diajak ke pertemuan?", "Diajak ke pertemuan", "Nombor", "", "Progress", "Ya"],
  ["konsisten", "Berapa ramai MT yang konsisten jumpa antum?", "MT konsisten jumpa", "Nombor", "", "Jumlah", "Ya"],
  ["analisa", "Apakah analisa antum terhadap kegagalan/keberjayaan bulan ini?", "Analisa", "Teks panjang", "", "Analisa", "Tidak"]
];
