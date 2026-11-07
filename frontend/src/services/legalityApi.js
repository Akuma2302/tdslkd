// Legality API service: every call to the Unit Legality Apps Script goes through here.
// Shared by the user portal (pages/portal/legality.js), the admin dashboard
// (features/legality/legality-admin.js) and the access-code gate (components/gate.js).
// Backend: backend/legality/Legality.gs.
(function () {
  "use strict";

  var URL_ = ((window.YOSH_CONFIG || {}).legalityApi || "").trim();
  // Admin pages (<body data-gate="admin">) keep the admin code; portal pages keep the user code.
  var KEYS = { admin: "admin:kod", user: "legality:kod" };
  var KEY = document.body && document.body.getAttribute("data-gate") === "admin" ? KEYS.admin : KEYS.user;

  function getKod() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function setKod(k) { setKodFor(KEY === KEYS.admin ? "admin" : "user", k); }
  // Saves the code for the given interface ("user" or "admin"), used when the login sends someone across.
  function setKodFor(role, k) {
    var key = KEYS[role] || KEYS.user;
    try { if (k) localStorage.setItem(key, k); else localStorage.removeItem(key); } catch (e) {}
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

  // Checks a code without saving it. Resolves to "user" or "admin"; rejects with .kod = true if wrong.
  function ping(kod) {
    return fetch(URL_ + (URL_.indexOf("?") < 0 ? "?" : "&") + query({ action: "ping", kod: kod }))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.error === "KOD_SALAH") { var e = new Error("Kod akses tidak sah."); e.kod = true; throw e; }
        if (d.error) throw new Error(d.error);
        return d.role;
      });
  }

  window.LegalityApi = {
    configured: !!URL_,
    getKod: getKod,
    setKod: setKod,
    setKodFor: setKodFor,
    get: get,
    post: post,
    ping: ping
  };
})();
