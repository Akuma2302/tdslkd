// Login gate: a full-screen "Log masuk" screen shown right after the intro, on every page.
// One login for everyone — the code decides where they go:
//   user code  → user portal (/)        admin code → admin dashboard (/admin)
// <body data-gate="user"> on portal pages, <body data-gate="admin"> on the admin page.
// A code that worked is remembered in this browser (via LegalityApi), so the gate shows once per device.
// Page scripts start their work with YoshGate.ready(fn); YoshGate.show() asks for the code again
// (e.g. after the code was changed by the admin).
// Load this BEFORE components/intro.js so it hears the intro closing.
(function () {
  "use strict";

  var Api = window.LegalityApi;
  var role = document.body.getAttribute("data-gate") || "user";
  var unlocked = false;
  var waiting = [];
  var gate = null;

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function unlock() {
    unlocked = true;
    if (gate) { gate.remove(); gate = null; }
    document.body.classList.remove("gated");
    var fns = waiting; waiting = [];
    fns.forEach(function (fn) { try { fn(); } catch (e) { setTimeout(function () { throw e; }); } });
  }

  function show(message) {
    unlocked = false;
    Api.setKod("");
    if (gate) { gate.querySelector(".gate-error").textContent = message || ""; return; }
    document.body.classList.add("gated");

    gate = el("div", "gate");
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-labelledby", "gateTitle");
    var card = el("form", "gate-card");
    card.noValidate = true;

    var logo = el("img", "gate-logo");
    logo.src = "assets/images/logo.png";
    logo.alt = "Yosh Junior";
    card.appendChild(logo);
    var title = el("h1", "gate-title", "Log masuk");
    title.id = "gateTitle";
    card.appendChild(title);
    card.appendChild(el("p", "gate-text",
      "Masukkan kod akses yang diberi oleh pentadbir. Anda hanya perlu memasukkannya sekali pada peranti ini."));

    var input = el("input", "gate-input");
    input.type = "password";
    input.autocomplete = "off";
    input.spellcheck = false;
    input.placeholder = "Kod akses";
    input.setAttribute("aria-label", "Kod akses");
    var peek = el("button", "gate-peek", "Tunjuk");
    peek.type = "button";
    peek.addEventListener("click", function () {
      input.type = input.type === "password" ? "text" : "password";
      peek.textContent = input.type === "password" ? "Tunjuk" : "Sorok";
      input.focus();
    });
    var row = el("div", "gate-row");
    row.appendChild(input);
    row.appendChild(peek);
    card.appendChild(row);

    var error = el("p", "gate-error", message || "");
    error.setAttribute("role", "alert");
    card.appendChild(error);
    var go = el("button", "gate-go", "Masuk");
    go.type = "submit";
    card.appendChild(go);

    card.addEventListener("submit", function (e) {
      e.preventDefault();
      var kod = input.value.trim();
      if (!kod) { error.textContent = "Masukkan kod akses."; input.focus(); return; }
      error.textContent = "";
      go.disabled = true; go.textContent = "Menyemak…";
      Api.ping(kod)
        .then(function (r) {
          if (r !== role) {
            // The code belongs to the other interface: remember it there and go.
            Api.setKodFor(r, kod);
            go.textContent = r === "admin" ? "Membuka admin…" : "Membuka portal…";
            location.href = r === "admin" ? "admin.html" : "./";
            return;
          }
          Api.setKod(kod);
          unlock();
        })
        .catch(function (err) {
          error.textContent = err.kod ? "Kod tidak sah. Cuba lagi."
            : "Tidak dapat menyemak kod: " + (err.message || err) + ". Semak sambungan internet.";
          go.disabled = false; go.textContent = "Masuk";
          input.select();
        });
    });

    gate.appendChild(card);
    document.body.appendChild(gate);
    input.focus();
  }

  window.YoshGate = {
    role: role,
    ready: function (fn) { if (unlocked) fn(); else waiting.push(fn); },
    show: show
  };

  if (!Api || !Api.configured) { unlock(); return; }

  if (Api.getKod()) {
    // Remembered code: open straight away, and quietly confirm it is still valid.
    var saved = Api.getKod();
    unlock();
    Api.ping(saved).then(function (r) {
      if (r !== role) show();
    }).catch(function (err) {
      if (err.kod) show("Kod akses telah ditukar. Masukkan kod baru.");
    });
    return;
  }

  // No code yet: ask as soon as the intro is gone.
  if (document.getElementById("intro")) window.addEventListener("yosh:introclosed", function () { show(); }, { once: true });
  else show();
})();
