// POST /.netlify/functions/hantar
// Validates the programme form, builds the message server-side (so the bot
// can't be used to post arbitrary text) and sends it via the Telegram bot to:
//   1. the cawangan's topic in the compilation group
//   2. the cawangan's own group
//   3. any extra topics listed for that cawangan in EXTRA_TARGETS (Tengah has two)
//
// Environment variables (Netlify → Site configuration → Environment variables):
//   TELEGRAM_BOT_TOKEN   required
//   GROUP_TENGAH, GROUP_UTARA, GROUP_PANTAI_TIMUR, GROUP_BORNEO, GROUP_INDONESIA, GROUP_MEA (optional)
//                        numeric chat id of each cawangan group, e.g. -1001234567890
//   DRY_RUN=1            optional: build + validate but don't call Telegram

import { buildTemplate, CAWANGAN, JENIS_PROGRAM, TINGKATAN } from '../../frontend/src/pages/program/template.js';

// Compilation group "[TDS] Program Sekolah Sedunia" (t.me/c/4420848460/...)
const COMPILATION_CHAT_ID = '-1004420848460';
const TOPIC_ID = {
  'Tengah': 2,
  'Utara': 4,
  'Pantai Timur': 6,
  'Borneo': 8,
  'Indonesia': 10,
  'MEA': 25,          // t.me/c/4420848460/25
};
const GROUP_ENV = {
  'Tengah': 'GROUP_TENGAH',
  'Utara': 'GROUP_UTARA',
  'Pantai Timur': 'GROUP_PANTAI_TIMUR',
  'Borneo': 'GROUP_BORNEO',
  'Indonesia': 'GROUP_INDONESIA',
  'MEA': 'GROUP_MEA',  // optional: MEA has no own group yet, so only the compilation topic gets it
};

// Extra topics that also get a copy, per cawangan. These ids are fixed in code
// (like the compilation group above), so they need no environment variables.
// A t.me/c/<chat>/<topic> link maps to chatId "-100<chat>" and threadId <topic>.
const EXTRA_TARGETS = {
  'Tengah': [
    { name: 'PIC Virality Tengah', chatId: '-1003950267951', threadId: 7 },      // t.me/c/3950267951/7
    { name: 'Pemikir Tengah', chatId: '-1001790355836', threadId: 27732 },       // t.me/c/1790355836/27732
  ],
  'Utara': [
    // "TDS UTARA - Syuro Murobbi Sekolah", topic Legality TDS Utara
    { name: 'Legality TDS Utara', chatId: '-1002112154110', threadId: 804 },  // t.me/c/2112154110/804
  ],
  'Indonesia': [
    // "[IDN] TDS" — Program TDS Indonesia. t.me/c/3738721506/1 is the forum's General topic,
    // which takes no message_thread_id.
    { name: 'Program TDS Indonesia', chatId: '-1003738721506' },
  ],
};

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '2024-01-01' && v <= '2099-12-31' && !isNaN(new Date(v + 'T00:00:00'));
const hasText = (v) => /[\p{L}\p{N}]/u.test(v);
const isTime = (v) => /^\d{2}:\d{2}$/.test(v);
const handle = (v) => str(v, 40).replace(/^@+/, '');
const alumni = (v) => (['Alumni', 'Bukan Alumni'].includes(v) ? v : '');
const kader = (v) => (typeof v === 'string' && CAWANGAN[v] ? v : '');

function clean(raw) {
  const d = {
    cawangan: str(raw.cawangan, 30),
    sekolah: str(raw.sekolah, 150),
    negeri: str(raw.negeri, 60),
    namaProgram: str(raw.namaProgram, 150),
    jenis: str(raw.jenis, 30),
    tarikhMula: str(raw.tarikhMula, 10),
    tarikhTamat: str(raw.tarikhTamat, 10),
    masaMula: str(raw.masaMula, 5),
    masaTamat: str(raw.masaTamat, 5),
    guru: Array.isArray(raw.guru)
      ? raw.guru.slice(0, 20).map((g) => ({ nama: str(g?.nama, 100), jawatan: str(g?.jawatan, 60) }))
      : [],
    pelajar: Array.isArray(raw.pelajar) ? [...new Set(raw.pelajar.filter((t) => TINGKATAN.includes(t)))].sort() : [],
    manpower: str(String(raw.manpower ?? ''), 5),
    tambahan: raw.tambahan === 'Ya' ? 'Ya' : raw.tambahan === 'Tidak' ? 'Tidak' : '',
    tambahanJumlah: str(String(raw.tambahanJumlah ?? ''), 5),
    sheet: str(raw.sheet, 300),
    mainPic: handle(raw.mainPic),
    mainPicAlumni: alumni(raw.mainPicAlumni),
    legalityAlumni: alumni(raw.legalityAlumni),
    viralityAlumni: alumni(raw.viralityAlumni),
    legality: handle(raw.legality),
    mainPicKader: kader(raw.mainPicKader),
    legalityKader: kader(raw.legalityKader),
    viralityKader: kader(raw.viralityKader),
    virality: handle(raw.virality),
  };

  // Student count per selected tingkatan: whole number 1–9999
  const bil = raw.pelajarBilangan && typeof raw.pelajarBilangan === 'object' ? raw.pelajarBilangan : {};
  d.pelajarBilangan = Object.fromEntries(d.pelajar.map((t) => [t, str(String(bil[t] ?? ''), 4)]));

  const errors = [];
  if (!CAWANGAN[d.cawangan]) errors.push('cawangan');
  if (!hasText(d.sekolah)) errors.push('sekolah');
  if (!hasText(d.negeri)) errors.push('negeri');
  if (![d.mainPicKader, d.legalityKader, d.viralityKader].every(Boolean)) errors.push('kader');
  if (!hasText(d.namaProgram)) errors.push('namaProgram');
  if (!JENIS_PROGRAM.includes(d.jenis)) errors.push('jenis');
  if (!isDate(d.tarikhMula) || !isDate(d.tarikhTamat) || d.tarikhTamat < d.tarikhMula) errors.push('tarikh');
  if (!isTime(d.masaMula) || !isTime(d.masaTamat) ||
      (d.tarikhMula === d.tarikhTamat && d.masaTamat <= d.masaMula)) errors.push('masa');
  if (!d.guru.length || d.guru.some((g) => !hasText(g.nama) || !hasText(g.jawatan))) errors.push('guru');
  if (!d.pelajar.length || Object.values(d.pelajarBilangan).some((v) => !/^\d+$/.test(v) || Number(v) < 1)) errors.push('pelajar');
  if (!/^\d+$/.test(d.manpower)) errors.push('manpower');
  if (!d.tambahan) errors.push('tambahan');
  if (d.tambahan === 'Ya' && !/^\d+$/.test(d.tambahanJumlah)) errors.push('tambahanJumlah');
  if (d.sheet && !/^https?:\/\//i.test(d.sheet)) errors.push('sheet');
  if (![d.mainPic, d.legality, d.virality].every(hasText)) errors.push('pic');
  ['mainPicAlumni', 'legalityAlumni', 'viralityAlumni'].forEach((k) => { if (!d[k]) errors.push(k); });
  if (raw.amanah !== true) errors.push('amanah');
  return { d, errors };
}

async function sendMessage(token, chatId, text, threadId) {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      link_preview_options: { is_disabled: true },
      ...(threadId ? { message_thread_id: threadId } : {}),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (body.ok) return;

  // A basic group upgraded to a supergroup gets a new id; follow it once.
  const newId = body.parameters?.migrate_to_chat_id;
  if (newId && String(newId) !== String(chatId)) {
    console.warn(`Chat ${chatId} migrated to ${newId}; update the GROUP_* environment variable.`);
    return sendMessage(token, newId, text, threadId);
  }
  throw new Error(body.description || `HTTP ${res.status}`);
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  let raw;
  try { raw = await req.json(); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }

  // Honeypot: a hidden field real users never fill in
  if (raw.website) return json(200, { ok: true, sent: [] });

  const { d, errors } = clean(raw);
  if (errors.length) return json(400, { ok: false, error: 'Borang tidak lengkap', fields: errors });

  const text = buildTemplate(d);
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const groupId = process.env[GROUP_ENV[d.cawangan]];

  const targets = [
    { name: `Topik ${d.cawangan} (group kompilasi)`, chatId: COMPILATION_CHAT_ID, threadId: TOPIC_ID[d.cawangan] },
    // A cawangan whose own group is not set yet (GROUP_MEA) only goes to the compilation topic.
    ...(groupId || d.cawangan !== 'MEA' ? [{ name: `Group ${d.cawangan}`, chatId: groupId }] : []),
    ...(EXTRA_TARGETS[d.cawangan] || []),
  ];

  if (process.env.DRY_RUN === '1') {
    return json(200, { ok: true, dryRun: true, text, results: targets.map((t) => ({ name: t.name, ok: true, chatId: t.chatId || null })) });
  }
  if (!token) return json(500, { ok: false, error: 'Server belum dikonfigurasi (TELEGRAM_BOT_TOKEN tiada)' });

  const results = await Promise.all(targets.map(async (t) => {
    if (!t.chatId) return { name: t.name, ok: false, error: 'Chat ID belum ditetapkan' };
    try {
      await sendMessage(token, t.chatId, text, t.threadId);
      return { name: t.name, ok: true };
    } catch (e) {
      return { name: t.name, ok: false, error: e.message };
    }
  }));

  const ok = results.every((r) => r.ok);
  return json(ok ? 200 : 502, { ok, results });
};
