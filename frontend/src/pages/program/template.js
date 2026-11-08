// Shared between the page (app.js) and the Netlify function (hantar.mjs),
// so the message the user previews is exactly the message the bot sends.

export const CAWANGAN = {
  // Tengah joins the PIC Virality Tengah group; joinLabel overrides the button text
  'Tengah':       { joinLink: 'https://t.me/+7MJo6v18sE9jNGM9', joinLabel: 'PIC Virality Tengah' },
  'Utara':        { joinLink: 'https://t.me/+jJh44JFEUj43ZDE1' },
  'Pantai Timur': { joinLink: 'https://t.me/+eOgwnIbcTkUxOTJl' },
  'Borneo':       { joinLink: 'https://t.me/+zdbMKEDkUkU4NTI1' },
  'Indonesia':    { joinLink: 'https://t.me/+gqRdkJKyrvIwYTdl' },
  // MEA: no join link yet; add joinLink here when the MEA group invite link is ready
  'MEA':          {},
};

export const JENIS_PROGRAM = ['Kepimpinan', 'Kerohanian', 'Akademik', 'Lain-lain'];
export const TINGKATAN = ['T1', 'T2', 'T3', 'T4', 'T5'];

function formatDate(value) {
  return new Date(value + 'T00:00:00').toLocaleDateString('ms-MY', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatDateRange(mula, tamat) {
  return mula === tamat ? formatDate(mula) : `${formatDate(mula)} – ${formatDate(tamat)}`;
}

// "🔻 Pelajar (75 orang):" followed by one line per tingkatan
function pelajarLines(d) {
  const bil = d.pelajarBilangan || {};
  const counts = d.pelajar.map((t) => Number(bil[t]) || 0);
  const total = counts.reduce((a, b) => a + b, 0);
  return [
    `🔻 Pelajar (${total} orang):`,
    ...d.pelajar.map((t, i) => `     • Tingkatan ${t.slice(1)}: ${counts[i]} orang`),
  ];
}

/**
 * data: {
 *   cawangan, sekolah, negeri, namaProgram, jenis, tarikhMula, tarikhTamat, masaMula, masaTamat,
 *   guru: [{ nama, jawatan }], pelajar: ['T1', ...], pelajarBilangan: { T1: '30', ... }, manpower,
 *   tambahan: 'Ya' | 'Tidak', tambahanJumlah, sheet, mainPic, legality, virality,
 *   mainPicAlumni, legalityAlumni, viralityAlumni: 'Alumni' | 'Bukan Alumni',
 *   mainPicKader, legalityKader, viralityKader: cawangan name (Tengah, Utara, …)
 * }
 */
export function buildTemplate(d) {
  // "@ali (Alumni · Kader Tengah)"
  const about = (status, kader) => {
    const bits = [status, kader ? `Kader ${kader}` : ''].filter(Boolean);
    return bits.length ? ` (${bits.join(' · ')})` : '';
  };
  const or = (v) => (v === undefined || v === null || String(v).trim() === '' ? '—' : String(v).trim());

  const lines = [
    `📋 DETAIL PROGRAM SEKOLAH ${or(d.cawangan).toUpperCase()}`,
    '',
    `🔻 Cawangan: ${or(d.cawangan)}`,
    `🔻 Sekolah: ${or(d.sekolah)}`,
    `🔻 Negeri: ${or(d.negeri)}`,
    `🔻 Nama Program: ${or(d.namaProgram)}`,
    `🔻 Jenis Program: ${or(d.jenis)}`,
    `🔻 Tarikh Program: ${formatDateRange(d.tarikhMula, d.tarikhTamat)}`,
    `🔻 Masa: ${or(d.masaMula)} – ${or(d.masaTamat)}`,
    ...(d.guru.every((g) => /^tiada$/i.test(g.nama))
      ? ['🔻 Guru Bertugas: Tiada']
      : [`🔻 Guru Bertugas (${d.guru.length} orang):`, ...d.guru.map((g, i) => `     ${i + 1}. ${g.nama} (${g.jawatan})`)]),
    '',
    ...pelajarLines(d),
    `🔻 Jumlah Manpower: ${or(d.manpower)}`,
    `🔻 Perlukan Manpower Tambahan: ${d.tambahan}`,
  ];
  if (d.tambahan === 'Ya') lines.push(`🔻 Jumlah Manpower Tambahan: ${or(d.tambahanJumlah)}`);
  lines.push(
    `🔻 Sheet Program: ${or(d.sheet)}`,
    '',
    '📌 PIC PROGRAM',
    `🔻 Main PIC: @${or(d.mainPic)}${about(d.mainPicAlumni, d.mainPicKader)}`,
    `🔻 PIC Legality: @${or(d.legality)}${about(d.legalityAlumni, d.legalityKader)}`,
    `🔻 PIC Virality: @${or(d.virality)}${about(d.viralityAlumni, d.viralityKader)}`,
    '',
    '🔻 Ketetapan Virality: Telah dibaca & diakui'
  );
  return lines.join('\n');
}
