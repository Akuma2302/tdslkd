// Borang Unit Murabbi: asks this month's questions (from the Soalan tab of the Google Sheet)
// and saves the answers there through the Apps Script set in config.js.
(function () {
  "use strict";

  var API = ((window.YOSH_CONFIG || {}).murabbiApi || "").trim();
  var root = document.getElementById("formRoot");
  var monthEl = document.getElementById("formMonth");
  var cfg = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function message(titleText, body, tone) {
    root.textContent = "";
    var box = el("div", "borang-card borang-message" + (tone ? " " + tone : ""));
    box.appendChild(el("h2", "borang-message-title", titleText));
    if (body) box.appendChild(el("p", null, body));
    root.appendChild(box);
    return box;
  }

  // Unsent answers are kept in this browser so a refresh doesn't lose them.
  function draftKey() { return "borangMurabbi:" + cfg.month; }
  function loadDraft() { try { return JSON.parse(localStorage.getItem(draftKey()) || "{}"); } catch (e) { return {}; } }
  function saveDraft(d) { try { localStorage.setItem(draftKey(), JSON.stringify(d)); } catch (e) {} }
  function clearDraft() { try { localStorage.removeItem(draftKey()); } catch (e) {} }

  if (!API) {
    message("Borang belum disambungkan", "Pentadbir perlu memasukkan pautan Apps Script dalam config.js. Lihat backend/murabbi/README.md.", "warn");
    return;
  }

  fetch(API + (API.indexOf("?") < 0 ? "?" : "&") + "action=config")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.error) throw new Error(d.error);
      cfg = d;
      monthEl.textContent = d.monthLabel ? "Laporan bulan " + d.monthLabel : "";
      if (!d.open) {
        message("Borang ditutup", "Borang laporan belum dibuka atau telah ditutup. Hubungi pentadbir Unit Murabbi.");
        return;
      }
      if (!d.questions.length) {
        message("Belum ada soalan", "Soalan untuk " + d.monthLabel + " belum dimasukkan. Hubungi pentadbir Unit Murabbi.");
        return;
      }
      build();
    })
    .catch(function (e) {
      message("Borang tidak dapat dimuatkan", "Semak sambungan internet dan muat semula halaman. (" + (e.message || e) + ")", "warn");
    });

  function build() {
    var draft = loadDraft();
    root.textContent = "";
    var form = el("form", "borang-form");
    form.noValidate = true;

    // ---- Who is filling ----
    var who = el("section", "borang-card");
    who.appendChild(el("h2", "borang-section", "Maklumat murabbi"));
    var branches = cfg.murabbi.map(function (p) { return p.cawangan; })
      .filter(function (b, i, a) { return a.indexOf(b) === i; }).sort();

    var bField = field("Cawangan", true);
    var bSelect = el("select");
    bSelect.id = "f-cawangan";
    bField.label.htmlFor = bSelect.id;
    bSelect.appendChild(option("", "Pilih cawangan"));
    branches.forEach(function (b) { bSelect.appendChild(option(b, b)); });
    bField.box.appendChild(bSelect);
    bField.box.appendChild(bField.error);
    who.appendChild(bField.box);

    var nField = field("Nama", true);
    var nSelect = el("select");
    nSelect.id = "f-nama";
    nField.label.htmlFor = nSelect.id;
    nField.box.appendChild(nSelect);
    nField.box.appendChild(nField.error);
    nField.box.appendChild(el("p", "borang-hint", "Tiada nama anda? Hubungi pentadbir Unit Murabbi."));
    who.appendChild(nField.box);

    function fillNames() {
      nSelect.textContent = "";
      nSelect.appendChild(option("", bSelect.value ? "Pilih nama" : "Pilih cawangan dahulu"));
      cfg.murabbi.filter(function (p) { return p.cawangan === bSelect.value; })
        .map(function (p) { return p.nama; }).sort()
        .forEach(function (n) { nSelect.appendChild(option(n, n)); });
      nSelect.disabled = !bSelect.value;
    }
    bSelect.value = branches.indexOf(draft.cawangan) > -1 ? draft.cawangan : "";
    fillNames();
    if (draft.nama) nSelect.value = draft.nama;
    bSelect.addEventListener("change", function () { fillNames(); changed(); });
    nSelect.addEventListener("change", changed);
    form.appendChild(who);

    // ---- Questions ----
    var qCard = el("section", "borang-card");
    qCard.appendChild(el("h2", "borang-section", "Laporan " + cfg.monthLabel));
    var inputs = {};
    cfg.questions.forEach(function (q, i) {
      var f = field((i + 1) + ". " + q.text, q.required);
      var control = makeControl(q, draft.answers && draft.answers[q.code]);
      inputs[q.code] = { q: q, control: control, error: f.error };
      if (control.input) f.label.htmlFor = control.input.id;
      f.box.appendChild(control.node);
      f.box.appendChild(f.error);
      qCard.appendChild(f.box);
    });
    form.appendChild(qCard);

    var status = el("p", "borang-error-summary");
    status.hidden = true;
    var submit = el("button", "borang-submit", "Hantar laporan");
    submit.type = "submit";
    var actions = el("div", "borang-actions");
    actions.appendChild(status);
    actions.appendChild(submit);
    actions.appendChild(el("p", "borang-hint", "Jika anda menghantar lebih sekali, hanya laporan terkini digunakan."));
    form.appendChild(actions);
    root.appendChild(form);

    form.addEventListener("input", changed);
    form.addEventListener("change", changed);

    function collect() {
      var answers = {};
      Object.keys(inputs).forEach(function (code) { answers[code] = inputs[code].control.get(); });
      return { cawangan: bSelect.value, nama: nSelect.value, answers: answers };
    }

    function changed(e) {
      saveDraft(collect());
      // Clear an error as soon as its field is edited.
      if (e && e.target) {
        var box = e.target.closest(".borang-field");
        if (box && box.classList.contains("has-error")) {
          box.classList.remove("has-error");
          box.querySelector(".borang-error").textContent = "";
        }
      }
    }

    function check() {
      var bad = [];
      function fail(f, msg) {
        f.box.classList.add("has-error");
        f.error.textContent = msg;
        bad.push(f.box);
      }
      [[bField, bSelect, "Pilih cawangan anda."], [nField, nSelect, "Pilih nama anda."]].forEach(function (x) {
        x[0].box.classList.remove("has-error");
        x[0].error.textContent = "";
        if (!x[1].value) fail(x[0], x[2]);
      });
      Object.keys(inputs).forEach(function (code) {
        var it = inputs[code], v = it.control.get(), box = it.error.parentNode;
        box.classList.remove("has-error");
        it.error.textContent = "";
        if (it.q.required && v === "") fail({ box: box, error: it.error }, "Soalan ini wajib dijawab.");
        else if (it.q.type === "number" && v !== "" && !/^\d+$/.test(v)) fail({ box: box, error: it.error }, "Masukkan nombor bulat sahaja, contoh 3.");
      });
      return bad;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var bad = check();
      if (bad.length) {
        status.hidden = false;
        status.textContent = bad.length + " soalan perlu dibetulkan sebelum dihantar.";
        bad[0].scrollIntoView({ behavior: "smooth", block: "center" });
        var focusable = bad[0].querySelector("select, input, textarea");
        if (focusable) focusable.focus({ preventScroll: true });
        return;
      }
      status.hidden = true;
      submit.disabled = true;
      submit.textContent = "Menghantar…";
      var payload = collect();
      payload.month = cfg.month;
      // text/plain keeps this a "simple" request, which Apps Script accepts from another site.
      fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.error) throw new Error(d.error);
          clearDraft();
          done(d);
        })
        .catch(function (err) {
          status.hidden = false;
          status.textContent = "Laporan belum dihantar: " + (err.message || err) + " Jawapan anda masih ada, cuba hantar semula.";
          submit.disabled = false;
          submit.textContent = "Hantar laporan";
        });
    });
  }

  function done(d) {
    var box = message("Terima kasih, " + d.nama, "Laporan " + d.monthLabel + " telah diterima.", "ok");
    var again = el("button", "link-btn", "Hantar laporan lain");
    again.type = "button";
    again.addEventListener("click", function () { build(); window.scrollTo(0, 0); });
    box.appendChild(again);
    window.scrollTo(0, 0);
  }

  function option(value, label) {
    var o = el("option", null, label);
    o.value = value;
    return o;
  }

  var uid = 0;
  function field(labelText, required) {
    var box = el("div", "borang-field");
    var label = el("label", "borang-label", labelText);
    if (required) {
      var star = el("span", "borang-req", " *");
      star.setAttribute("aria-label", "wajib");
      label.appendChild(star);
    }
    box.appendChild(label);
    var error = el("p", "borang-error");
    error.id = "err-" + (++uid);
    return { box: box, label: label, error: error };
  }

  // One control per question type; each returns { node, input?, get() }.
  function makeControl(q, saved) {
    var id = "q-" + q.code;
    saved = saved == null ? "" : String(saved);
    if (q.type === "yesno" || q.type === "choice") {
      var opts = q.type === "yesno" ? ["Ya", "Tidak"] : q.options;
      var group = el("div", "borang-choices");
      group.setAttribute("role", "radiogroup");
      opts.forEach(function (o, i) {
        var lab = el("label", "borang-choice");
        var r = el("input");
        r.type = "radio";
        r.name = id;
        r.value = o;
        r.id = id + "-" + i;
        if (saved === o) r.checked = true;
        lab.appendChild(r);
        lab.appendChild(el("span", null, o));
        group.appendChild(lab);
      });
      return {
        node: group,
        get: function () { var c = group.querySelector("input:checked"); return c ? c.value : ""; }
      };
    }
    var input;
    if (q.type === "longtext") {
      input = el("textarea", "borang-input");
      input.rows = 4;
    } else {
      input = el("input", "borang-input");
      input.type = "text";
      if (q.type === "number") {
        input.inputMode = "numeric";
        input.pattern = "[0-9]*";
        input.placeholder = "0";
        input.classList.add("is-number");
      }
    }
    input.id = id;
    input.value = saved;
    return { node: input, input: input, get: function () { return input.value.trim(); } };
  }
})();
