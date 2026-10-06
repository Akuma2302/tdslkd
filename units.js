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
  { id: "legality",  name: "Unit Legality",  summary: "", sections: [] },
  { id: "virality",  name: "Unit Virality",  summary: "", sections: [] },
  { id: "tls",       name: "Unit TLS",       summary: "", sections: [] }
];
