// Legality API service: every call to the Unit Legality Apps Script goes through here.
// Shared by the user portal (pages/portal/legality.js), the admin dashboard
// (features/legality/legality-admin.js) and the access-code gate (components/gate.js).
// Backend: backend/legality/Legality.gs.
(function () {
  "use strict";

  var URL_ = ((window.YOSH_CONFIG || {}).legalityApi || "").trim();
  // Each interface keeps its own code: admin (<body data-gate="admin">), the Tengah page
  // (data-gate="tengah", /tengah) and the user portal (everything else).
  var KEYS = { admin: "admin:kod", user: "legality:kod", tengah: "tengah:kod" };
  var ROLE = (document.body && document.body.getAttribute("data-gate")) || "user";
  if (!KEYS[ROLE]) ROLE = "user";
  var KEY = KEYS[ROLE];

  // Codes live only for this browser session: closing the tab or browser logs everyone out,
  // so the login screen comes back each time the app is opened. (Older versions kept them in
  // localStorage — clear those.)
  try { localStorage.removeItem(KEYS.admin); localStorage.removeItem(KEYS.user); } catch (e) {}

  function getKod() { try { return sessionStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function setKod(k) { setKodFor(ROLE, k); }
  // Saves the code for the given interface ("user" or "admin"), used when the login sends someone across.
  function setKodFor(role, k) {
    var key = KEYS[role] || KEYS.user;
    try { if (k) sessionStorage.setItem(key, k); else sessionStorage.removeItem(key); } catch (e) {}
  }

  // A wrong code clears the saved one and throws an error marked .kod = true.
  function checked(d) {
    if (d.error === "KOD_SALAH") { setKod(""); var e = new Error("Kod akses tidak sah."); e.kod = true; throw e; }
    if (d.error) throw new Error(d.error);
    return d;
  }

  function query(params) {
    return Object.keys(params).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");
  }

  function get(params) {
    params = params || {};
    params.kod = getKod();
    return fetch(URL_ + (URL_.indexOf("?") < 0 ? "?" : "&") + query(params))
      .then(function (r) { return r.json(); })
      .then(checked);
  }

  function post(body) {
    body = body || {};
    body.kod = getKod();
    // text/plain keeps this a "simple" request, which Apps Script accepts from another site.
    return fetch(URL_, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(checked);
  }

  // Checks a code without saving it. Resolves to "user", "admin" or "tengah"; rejects with .kod = true if wrong.
  function ping(kod) {
    return fetch(URL_ + (URL_.indexOf("?") < 0 ? "?" : "&") + query({ action: "ping", kod: kod }))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error === "KOD_SALAH") { var e = new Error("Kod akses tidak sah."); e.kod = true; throw e; }
        if (d.error) throw new Error(d.error);
        return d.role;
      });
  }

  // Forget every code (log out of the portal, admin and the Tengah page).
  function clearAll() { setKodFor("admin", ""); setKodFor("user", ""); setKodFor("tengah", ""); }

  window.LegalityApi = {
    configured: !!URL_,
    getKod: getKod,
    setKod: setKod,
    setKodFor: setKodFor,
    clearAll: clearAll,
    get: get,
    post: post,
    ping: ping
  };
})();
