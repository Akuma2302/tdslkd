// Intro screen (logo, "Program Sekolah Sedunia", MASUK button), shared by admin and the user portal.
// Needs the #intro markup in the page and <body class="locked">.
// <body data-intro="once-per-visit"> skips the intro when arriving from another page of this site
// (e.g. switching portal tabs), so it only plays when someone opens the site.
// Fires "yosh:introclosed" on window once the intro is gone.
(function () {
  "use strict";

  var intro = document.getElementById("intro");
  if (!intro) return;
  var enterBtn = document.getElementById("introEnter");
  var logo = document.getElementById("introLogo");
  var logoWrap = document.getElementById("introLogoWrap");
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function fromThisSite() {
    try { return !!document.referrer && new URL(document.referrer).origin === location.origin; } catch (e) { return false; }
  }

  function done() { window.dispatchEvent(new Event("yosh:introclosed")); }

  function closeIntro(instant) {
    if (!intro || intro.classList.contains("out")) return;
    document.removeEventListener("keydown", onIntroKey);
    document.body.classList.remove("locked");
    if (instant) { intro.remove(); intro = null; done(); return; }
    intro.classList.add("out");
    setTimeout(function () {
      if (intro) { intro.remove(); intro = null; }
      done();
    }, 1150);
  }

  function onIntroKey(e) {
    if (e.key === "Enter" && intro && intro.classList.contains("ready")) {
      e.preventDefault();
      closeIntro(reduced);
    }
  }

  if (document.body.getAttribute("data-intro") === "once-per-visit" && fromThisSite()) {
    closeIntro(true);
    return;
  }

  function logoMissing() { logoWrap.classList.add("no-logo"); }
  if (logo.complete && logo.naturalWidth === 0) logoMissing();
  logo.addEventListener("error", logoMissing);

  // Timers may fire after the intro is gone (e.g. a hidden tab delays animation frames).
  requestAnimationFrame(function () { if (intro) intro.classList.add("on"); });
  setTimeout(function () { if (intro) intro.classList.add("sub"); }, reduced ? 0 : 900);
  setTimeout(function () {
    if (!intro) return;
    intro.classList.add("ready");
    enterBtn.focus({ preventScroll: true });
  }, reduced ? 0 : 2200);
  enterBtn.addEventListener("click", function () { closeIntro(reduced); });
  document.addEventListener("keydown", onIntroKey);
})();
