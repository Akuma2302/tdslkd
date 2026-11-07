// Legality API service: every call to the Unit Legality Apps Script goes through here.
// Shared by the user portal (pages/portal/legality.js) and the admin dashboard
// (features/legality/legality-admin.js). Backend: backend/legality/Legality.gs.
(function () {
  "use strict";

  var URL_ = ((window.YOSH_CONFIG || {}).legalityApi || "").trim();
  var KEY = "legality:kod";

  // The access code is asked once and kept in this browser (shared by portal and admin).
  function getKod() { try { return localStorage.getItem(KEY) || ""; } catch (e) { return ""; } }
  function setKod(k) { try { if (k) localStorage.setItem(KEY, k); else localStorage.removeItem(KEY); } catch (e) {} }

  // A wrong code clears the saved one and throws an error marked .kod = true.
  function checked(d) {
    if (d.error === "KOD_SALAH") { setKod(""); var e = new Error("Kod akses tidak sah."); e.kod = true; throw e; }
    if (d.error) throw new Error(d.error);
    return d;
  }

  function get(params) {
    params = params || {};
    params.kod = getKod();
    var q = Object.keys(params).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");
    return fetch(URL_ + (URL_.indexOf("?") < 0 ? "?" : "&") + q)
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

  window.LegalityApi = {
    configured: !!URL_,
    getKod: getKod,
    setKod: setKod,
    get: get,
    post: post
  };
})();
