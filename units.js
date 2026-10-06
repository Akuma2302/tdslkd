// The five units. Each one becomes a tab.
// To fill in a unit, add text to `summary` and entries to `sections`:
//   sections: [{ title: "Tajuk", body: "Penerangan…" }]
// `body` may contain HTML. Units with no sections show an empty state.
// The entry marked `overview: true` is the Overall tab; it also lists the units below it.
window.UNITS = [
  { id: "overall",   name: "Overall",        summary: "", sections: [], overview: true },
  { id: "murabbi",   name: "Unit Murabbi",   summary: "", sections: [] },
  { id: "mutarabbi", name: "Unit Mutarabbi", summary: "", sections: [] },
  { id: "legality",  name: "Unit Legality",  summary: "", sections: [] },
  { id: "virality",  name: "Unit Virality",  summary: "", sections: [] },
  { id: "tls",       name: "Unit TLS",       summary: "", sections: [] }
];
