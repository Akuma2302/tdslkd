// Turns a unit's slide deck (plain data) into a PowerPoint file in the Yosh Junior slide template:
// light blue panel, navy capital titles, white rounded cards, and the five level colours.
(function () {
  "use strict";

  var LIB = "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js";
  var FONT = "Arial";
  var W = 13.333, H = 7.5;
  var X0 = 0.85, CW = W - 2 * X0;           // content box
  var T = {
    page: "EEF5FD", panel: "D6E8FA", navy: "13306B", sub: "3E4D6B", muted: "6B7A99",
    blue: "0B46A8", blueText: "1446A0", white: "FFFFFF", track: "EAF2FD", dot: "A9CDF2"
  };
  // Level colours from the template: bar fill and the darker label colour that goes with it.
  var LEVELS = [
    { fill: "F0A3AE", text: "C8324A" },
    { fill: "F3CD6F", text: "A87400" },
    { fill: "A8D290", text: "2E7D3E" },
    { fill: "8EB5E8", text: "1F5FC4" },
    { fill: "C4A6E6", text: "7D47BE" }
  ];

  var loading = null;
  function loadLib() {
    if (window.PptxGenJS) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = LIB;
      s.onload = function () { resolve(); };
      s.onerror = function () { loading = null; reject(new Error("load")); };
      document.head.appendChild(s);
    });
    return loading;
  }

  function frame(pptx, slide, deck, spec) {
    slide.background = { color: T.page };
    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.35, y: 0.3, w: W - 0.7, h: H - 0.6, rectRadius: 0.35, fill: { color: T.panel }, line: { color: T.panel }
    });
    [[W - 1.35, 0.5, 0.55], [0.6, H - 1.05, 0.45]].forEach(function (c) {
      slide.addShape(pptx.ShapeType.ellipse, {
        x: c[0], y: c[1], w: c[2], h: c[2], fill: { color: T.white, transparency: 100 }, line: { color: T.white, width: 1.5 }
      });
    });
    [[W - 0.95, 1.25, 0.2], [0.55, H - 2.1, 0.16]].forEach(function (c) {
      slide.addShape(pptx.ShapeType.ellipse, { x: c[0], y: c[1], w: c[2], h: c[2], fill: { color: T.dot }, line: { color: T.dot } });
    });
    slide.addText(spec.title.toUpperCase(), {
      x: X0, y: 0.5, w: CW, h: 0.75, fontFace: FONT, fontSize: 32, bold: true, color: T.navy, align: "center", valign: "middle", margin: 0
    });
    if (spec.subtitle) {
      slide.addText(spec.subtitle.toUpperCase(), {
        x: X0, y: 1.2, w: CW, h: 0.4, fontFace: FONT, fontSize: 15, bold: true, color: T.sub, align: "center", valign: "middle", margin: 0, charSpacing: 1
      });
    }
    if (deck.footer) {
      slide.addText(deck.footer, {
        x: X0 + 0.4, y: H - 0.72, w: CW - 0.8, h: 0.25, fontFace: FONT, fontSize: 9, color: T.muted, align: "center", margin: 0
      });
    }
  }

  function card(pptx, slide, x, y, w, h, fill) {
    slide.addShape(pptx.ShapeType.roundRect, {
      x: x, y: y, w: w, h: h, rectRadius: 0.16, fill: { color: fill || T.white }, line: { color: fill || T.white }
    });
  }

  // White card with a title and one bar per row, like the template's timeline chart.
  function barChart(pptx, slide, spec, y, h) {
    card(pptx, slide, X0, y, CW, h);
    var pad = 0.35;
    slide.addText(spec.chartTitle || "", {
      x: X0 + pad, y: y + 0.18, w: 6, h: 0.35, fontFace: FONT, fontSize: 13, bold: true, color: T.navy, margin: 0
    });
    if (spec.chartMeta) {
      slide.addText(spec.chartMeta, {
        x: X0 + CW - pad - 5, y: y + 0.18, w: 5, h: 0.35, fontFace: FONT, fontSize: 11, color: T.muted, align: "right", margin: 0
      });
    }
    var top = y + 0.68, bottom = y + h - (spec.foot ? 0.5 : 0.25);
    var labelW = 2.9, trackX = X0 + pad + labelW, trackW = CW - 2 * pad - labelW;
    var step = (bottom - top) / spec.rows.length;
    var barH = Math.min(0.42, step * 0.78);
    spec.rows.forEach(function (r, i) {
      var ry = top + i * step + (step - barH) / 2;
      var lv = LEVELS[i % LEVELS.length];
      slide.addText(r.label, {
        x: X0 + pad, y: ry, w: labelW - 0.15, h: barH, fontFace: FONT, fontSize: 12, bold: true, color: T.navy, valign: "middle", margin: 0
      });
      slide.addShape(pptx.ShapeType.roundRect, {
        x: trackX, y: ry, w: trackW, h: barH, rectRadius: 0.07, fill: { color: T.track }, line: { color: T.track }
      });
      var bw = r.max ? Math.max(trackW * Math.min(r.value / r.max, 1), 0) : 0;
      if (bw > 0.05) {
        slide.addShape(pptx.ShapeType.roundRect, {
          x: trackX, y: ry, w: bw, h: barH, rectRadius: 0.07, fill: { color: lv.fill }, line: { color: lv.fill }
        });
      }
      var inside = bw >= 1.5;
      slide.addText(r.text, {
        x: inside ? trackX + 0.12 : trackX + bw + 0.12, y: ry, w: inside ? bw - 0.2 : 2.6, h: barH,
        fontFace: FONT, fontSize: 12, bold: true, color: T.navy, valign: "middle", margin: 0
      });
    });
    if (spec.foot) {
      slide.addText(spec.foot, {
        x: X0 + pad, y: y + h - 0.45, w: CW - 2 * pad, h: 0.3, fontFace: FONT, fontSize: 10, color: T.muted, margin: 0
      });
    }
  }

  // Row of cards; the first is the solid blue one, as in the template.
  function statCards(pptx, slide, items, y, h) {
    var gap = 0.25, w = (CW - gap * (items.length - 1)) / items.length;
    items.forEach(function (s, i) {
      var x = X0 + i * (w + gap), lead = i === 0;
      card(pptx, slide, x, y, w, h, lead ? T.blue : T.white);
      slide.addText(s.label, {
        x: x + 0.25, y: y + 0.18, w: w - 0.5, h: 0.32, fontFace: FONT, fontSize: 12, bold: true, color: lead ? T.white : T.blueText, margin: 0
      });
      slide.addText(s.value, {
        x: x + 0.25, y: y + 0.48, w: w - 0.5, h: 0.55, fontFace: FONT, fontSize: 28, bold: true, color: lead ? T.white : T.navy, margin: 0, valign: "middle"
      });
      slide.addText(s.note || "", {
        x: x + 0.25, y: y + 1.03, w: w - 0.5, h: h - 1.1, fontFace: FONT, fontSize: 10, color: lead ? "DCE7FA" : T.sub, margin: 0, valign: "top"
      });
    });
  }

  function summarySlide(pptx, slide, spec) {
    barChart(pptx, slide, spec, 1.8, 2.9);
    statCards(pptx, slide, spec.stats, 4.92, 1.68);
  }

  function barsSlide(pptx, slide, spec) {
    barChart(pptx, slide, spec, 1.8, 4.85);
  }

  // Grid of small rounded cells: coloured top bar on headers, navy first column, accent strip on values.
  function tableSlide(pptx, slide, spec) {
    var y = 1.78;
    if (spec.strip) {
      var half = (CW - 0.25) / 2;
      spec.strip.forEach(function (s, i) {
        var x = X0 + i * (half + 0.25), lead = i === 0;
        card(pptx, slide, x, y, half, 0.5, lead ? T.blue : T.white);
        slide.addText([
          { text: s[0] + "   ", options: { bold: true, color: lead ? T.white : T.blueText } },
          { text: s[1], options: { color: lead ? T.white : T.sub } }
        ], { x: x + 0.25, y: y, w: half - 0.5, h: 0.5, fontFace: FONT, fontSize: 12, valign: "middle", margin: 0 });
      });
      y += 0.72;
    }
    var gap = 0.07, firstW = 3.1;
    var restW = (CW - firstW - gap * (spec.columns.length - 1)) / (spec.columns.length - 1);
    var colX = [X0];
    for (var c = 1; c < spec.columns.length; c++) colX.push(X0 + firstW + gap + (c - 1) * (restW + gap));
    function colW(c) { return c === 0 ? firstW : restW; }

    var headH = 0.5;
    spec.columns.forEach(function (label, c) {
      var lv = LEVELS[(c + 4) % LEVELS.length];
      card(pptx, slide, colX[c], y, colW(c), headH, T.white);
      slide.addShape(pptx.ShapeType.rect, { x: colX[c] + 0.08, y: y, w: colW(c) - 0.16, h: 0.05, fill: { color: lv.fill }, line: { color: lv.fill } });
      slide.addText(label, {
        x: colX[c] + 0.15, y: y + 0.05, w: colW(c) - 0.3, h: headH - 0.05, fontFace: FONT, fontSize: 12, bold: true,
        color: c === 0 ? T.navy : lv.text, valign: "middle", align: c === 0 ? "left" : "center", margin: 0
      });
    });
    y += headH + gap;

    var bottom = H - 0.95;
    var rowH = Math.min(0.5, (bottom - y) / Math.max(spec.rows.length, 1) - gap);
    spec.rows.forEach(function (row, r) {
      var ry = y + r * (rowH + gap);
      row.forEach(function (v, c) {
        if (c === 0) {
          card(pptx, slide, colX[0], ry, firstW, rowH, T.blue);
          slide.addText(v, {
            x: colX[0] + 0.15, y: ry, w: firstW - 0.3, h: rowH, fontFace: FONT, fontSize: v.length > 30 ? 9 : v.length > 24 ? 10 : 11, bold: true, color: T.white, valign: "middle", margin: 0
          });
        } else {
          var lv = LEVELS[(c + 4) % LEVELS.length];
          card(pptx, slide, colX[c], ry, restW, rowH, T.white);
          slide.addShape(pptx.ShapeType.rect, { x: colX[c], y: ry + 0.06, w: 0.045, h: rowH - 0.12, fill: { color: lv.fill }, line: { color: lv.fill } });
          slide.addText(v, {
            x: colX[c] + 0.1, y: ry, w: restW - 0.2, h: rowH, fontFace: FONT, fontSize: 12, color: v === "–" ? T.muted : T.navy, align: "center", valign: "middle", margin: 0
          });
        }
      });
    });
    if (spec.foot) {
      slide.addText(spec.foot, { x: X0 + 0.45, y: H - 0.98, w: CW - 0.45, h: 0.22, fontFace: FONT, fontSize: 9, color: T.muted, margin: 0 });
    }
  }

  function cardsSlide(pptx, slide, spec) {
    var y = 1.8, h = 4.6, gap = 0.25;
    var w = (CW - gap * (spec.cards.length - 1)) / spec.cards.length;
    spec.cards.forEach(function (k, i) {
      var x = X0 + i * (w + gap), lead = i === 0;
      card(pptx, slide, x, y, w, h, lead ? T.blue : T.white);
      slide.addText(k.title, {
        x: x + 0.25, y: y + 0.2, w: w - 0.5, h: 0.7, fontFace: FONT, fontSize: 14, bold: true, color: lead ? T.white : T.blueText, margin: 0, valign: "top"
      });
      var runs = [];
      k.lines.forEach(function (l, j) {
        runs.push({ text: l.text, options: { breakLine: true, color: lead ? T.white : T.sub } });
        runs.push({ text: "— " + l.by, options: { breakLine: j < k.lines.length - 1 || !!k.more, italic: true, fontSize: 10, color: lead ? "B9CCF2" : T.muted, paraSpaceAfter: 10 } });
      });
      if (k.more) runs.push({ text: k.more, options: { bold: true, color: lead ? T.white : T.blueText } });
      if (!runs.length) runs.push({ text: "Tiada jawapan dalam tema ini.", options: { color: lead ? T.white : T.muted } });
      slide.addText(runs, {
        x: x + 0.25, y: y + (k.title.length > 20 ? 0.95 : 0.7), w: w - 0.5, h: h - 1.15, fontFace: FONT, fontSize: 11, valign: "top", margin: 0
      });
    });
    if (spec.foot) {
      slide.addText(spec.foot, { x: X0 + 0.45, y: H - 0.98, w: CW - 0.45, h: 0.22, fontFace: FONT, fontSize: 9, color: T.muted, margin: 0 });
    }
  }

  var DRAW = { summary: summarySlide, bars: barsSlide, table: tableSlide, cards: cardsSlide };

  function build(deck) {
    var pptx = new window.PptxGenJS();
    pptx.layout = "LAYOUT_WIDE";
    pptx.author = "Yosh Junior";
    pptx.title = deck.fileName;
    deck.slides.forEach(function (spec) {
      var slide = pptx.addSlide();
      frame(pptx, slide, deck, spec);
      DRAW[spec.type](pptx, slide, spec);
    });
    return pptx;
  }

  function download(deck) {
    return loadLib().then(function () {
      return build(deck).writeFile({ fileName: deck.fileName.replace(/[\\/:*?"<>|]/g, "") + ".pptx" });
    });
  }

  // "Jana slaid" button; getDeck is called on click so it uses whatever month is selected.
  function button(getDeck) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "slides-btn";
    var label = "Jana slaid (.pptx)";
    b.textContent = label;
    b.addEventListener("click", function () {
      if (b.disabled) return;
      b.disabled = true;
      b.textContent = "Menjana…";
      download(getDeck()).then(function () {
        b.textContent = "Dimuat turun";
      }, function () {
        b.textContent = "Gagal. Semak internet dan cuba lagi";
      }).then(function () {
        setTimeout(function () { b.disabled = false; b.textContent = label; }, 2500);
      });
    });
    return b;
  }

  window.YoshSlides = { button: button, download: download, build: function (deck) { return loadLib().then(function () { return build(deck); }); } };
})();
