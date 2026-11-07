// Popup (modal) for filling in one item, e.g. a CRM person or an alumni entry. Shared by the portal pages.
// Uses the native <dialog>, so focus stays inside, Esc closes it and the page behind cannot be clicked.
// On phones it slides up from the bottom and takes most of the screen.
//
//   var m = YoshModal.open({
//     title: "Nama", subtitle: "Entiti · Phase",          // header text
//     body: node,                                         // the form fields
//     actions: [{ label: "Simpan", primary: true, onClick: fn }, ...],  // footer buttons (Tutup is always added)
//     onClose: fn                                         // runs after it closes, whichever way
//   });
//   m.setTitle(text, isEmpty); m.setSubtitle(text); m.close();
(function () {
  "use strict";

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function open(opts) {
    var dlg = el("dialog", "ym");
    dlg.setAttribute("aria-labelledby", "ymTitle");
    var panel = el("div", "ym-panel");

    var head = el("div", "ym-head");
    var titles = el("div", "ym-titles");
    var title = el("h2", "ym-title");
    title.id = "ymTitle";
    var sub = el("p", "ym-sub");
    titles.appendChild(title);
    titles.appendChild(sub);
    head.appendChild(titles);
    var x = el("button", "ym-x");
    x.type = "button";
    x.setAttribute("aria-label", "Tutup");
    x.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
    head.appendChild(x);
    panel.appendChild(head);

    var body = el("div", "ym-body");
    if (opts.body) body.appendChild(opts.body);
    panel.appendChild(body);

    var foot = el("div", "ym-foot");
    var close = el("button", "ym-btn", "Tutup");
    close.type = "button";
    foot.appendChild(close);
    (opts.actions || []).forEach(function (a) {
      var b = el("button", "ym-btn" + (a.primary ? " is-primary" : ""), a.label);
      b.type = "button";
      b.addEventListener("click", function () { a.onClick(api, b); });
      foot.appendChild(b);
    });
    panel.appendChild(foot);
    dlg.appendChild(panel);

    var api = {
      el: dlg,
      setTitle: function (t, empty) { title.textContent = t; title.classList.toggle("is-empty", !!empty); },
      setSubtitle: function (t) { sub.textContent = t || ""; sub.hidden = !t; },
      close: function () { if (dlg.open) dlg.close(); }
    };
    api.setTitle(opts.title || "", opts.titleEmpty);
    api.setSubtitle(opts.subtitle);

    x.addEventListener("click", api.close);
    close.addEventListener("click", api.close);
    // Clicking the dimmed area outside the panel closes it.
    dlg.addEventListener("click", function (e) { if (e.target === dlg) api.close(); });
    dlg.addEventListener("close", function () {
      document.documentElement.classList.remove("ym-lock");
      dlg.remove();
      if (opts.onClose) opts.onClose();
    });

    document.body.appendChild(dlg);
    document.documentElement.classList.add("ym-lock");
    dlg.showModal();
    // Start at the first empty field (or the first field) without the phone keyboard jumping the page.
    var fields = body.querySelectorAll("input:not([type=checkbox]), select, textarea");
    var first = Array.prototype.filter.call(fields, function (f) { return !f.value; })[0] || fields[0];
    if (first && opts.focusFirst) first.focus({ preventScroll: true });
    else x.focus({ preventScroll: true });
    body.scrollTop = 0;
    return api;
  }

  window.YoshModal = { open: open };
})();
