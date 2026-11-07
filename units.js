// The five units. Each one becomes a tab.
// To fill in a unit, add text to `summary` and entries to `sections`:
//   sections: [{ title: "Tajuk", body: "Penerangan…" }]
// `body` may contain HTML. Units with no sections show an empty state.
// The entry marked `overview: true` is the Overall tab, shown as a dashboard.
// Its figures are counted from the units below. On that entry you can also set:
//   sections: [{ title, body }]         -> "Makluman" (the first one is featured)
//   members:  [{ name, role, unit }]    -> "Ahli Pasukan"
//   stats:    [{ label, value, note }]  -> extra tiles after the first four
window.UNITS = [
  { id: "overall",   name: "Overall",        summary: "", sections: [], overview: true },
  { id: "murabbi",   name: "Unit Murabbi",   summary: "", sections: [] },
  { id: "mutarabbi", name: "Unit Mutarabbi", summary: "", sections: [] },
  { id: "legality",  name: "Unit Legality",
    summary: "Checklist Legality sekolah bagi setiap cawangan: CRM cikgu dan KPI, program, analisa dan perancangan.",
    sections: [
      { title: "Borang Checklist Legality",
        body: "Pautan untuk ahli cawangan mengemas kini data sekolah (perlu kod akses): <a href=\"legality.html\">Buka borang Checklist Legality →</a>" },
      { title: "Sheet setiap cawangan",
        body: "<a href=\"https://docs.google.com/spreadsheets/d/1xrAVOswvIrRmmrmPaywzdKPEijJXYUiGkQujr9TfFUs\" target=\"_blank\" rel=\"noopener\">TENGAH</a> · " +
              "<a href=\"https://docs.google.com/spreadsheets/d/1F2AjjajCZuP_WJn7pfnx8Sz_rcEvw2pZDI3jxyzN8pQ\" target=\"_blank\" rel=\"noopener\">UTARA</a> · " +
              "<a href=\"https://docs.google.com/spreadsheets/d/1Cskf9vo-nTtGOpM7C2C8pjKiBA_ILCt2hKT-JHgDwhE\" target=\"_blank\" rel=\"noopener\">PT</a> · " +
              "<a href=\"https://docs.google.com/spreadsheets/d/1i0koio9dQV79MlFFp0890DP0yEaiOzpCtulSSBC0-hU\" target=\"_blank\" rel=\"noopener\">INDONESIA</a> · " +
              "<a href=\"https://docs.google.com/spreadsheets/d/1RVxHQzdP66Ne38i6TNfxgr-1OKsmJFOAOYcuRdjX71I\" target=\"_blank\" rel=\"noopener\">BORNEO</a> · " +
              "<a href=\"https://docs.google.com/spreadsheets/d/168_tRkIJCW6Pd2H_iJ9wBrRXYhiMqh7SteTh39ExBp4\" target=\"_blank\" rel=\"noopener\">MEA</a>" }
    ] },
  { id: "virality",  name: "Unit Virality",  summary: "", sections: [] },
  { id: "tls",       name: "Unit TLS",       summary: "", sections: [] }
];
