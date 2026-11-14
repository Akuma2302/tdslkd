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
        body: "Pautan untuk ahli cawangan mengemas kini data sekolah (perlu kod akses): <a href=\"/\">Buka portal user (Database Legality) →</a>" },
      { title: "Sheet setiap cawangan",
        body: "<a href=\"https://docs.google.com/spreadsheets/d/1xrAVOswvIrRmmrmPaywzdKPEijJXYUiGkQujr9TfFUs\" target=\"_blank\" rel=\"noopener\">TENGAH</a> · " +
              "<a href=\"https://docs.google.com/spreadsheets/d/14mHT2GwPpOlyBV8NYbahXrLOSIKB_InqD3M4dRvyRaE\" target=\"_blank\" rel=\"noopener\">UTARA</a> · " +
              "<a href=\"https://docs.google.com/spreadsheets/d/1Q0EKt6vyCbasyeut2EA0JsEPa7veEpWQ8apPEVNXgBg\" target=\"_blank\" rel=\"noopener\">PT</a> · " +
              "<a href=\"https://docs.google.com/spreadsheets/d/1l7pW05yDTXCnxwaO6IIFW_eln0wuPglpvCvK-aLA69I\" target=\"_blank\" rel=\"noopener\">INDONESIA</a> · " +
              "<a href=\"https://docs.google.com/spreadsheets/d/1cv-fnk08JV4Eo4AJ0hfTr1aQyyEH0vNkKo2x2QBdLgE\" target=\"_blank\" rel=\"noopener\">BORNEO</a> · " +
              "<a href=\"https://docs.google.com/spreadsheets/d/1rl9w-8HA0ZoCpm8PxEcdIx5b3wyo6KiPZd8CXb6WawQ\" target=\"_blank\" rel=\"noopener\">MEA</a>" }
    ] },
  { id: "virality",  name: "Unit Virality",  summary: "", sections: [] },
  { id: "tls",       name: "Unit TLS",       summary: "", sections: [] }
];
