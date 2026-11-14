// POST /.netlify/functions/telegram-webhook
// Telegram calls this for the Program bot (TELEGRAM_BOT_TOKEN) when someone taps a reporting button or replies to
// one of the bot's reporting questions. Set up once with report-bot { setup: true }. See backend/lib/report-bot.mjs.
//
// Buttons (callback_data "rp:<step>:<programme id>"):
//   rp:ya     "Ya, berjalan"    → 1st question answered: asks to duplicate the template [Reporting topic]
//   rp:batal  "Tidak berjalan"  → Reporting = Dibatalkan, no more messages         [Reporting topic]
//   rp:dup    "Siap duplicate"  → asks for the Canva link (reply)            [Reporting topic]
//   rp:siap   "Sudah siap"      → approval request to Program Tengah topic 60  [Reporting topic]
//   rp:belum  "Belum"           → noted; asked again in 2 days                [Reporting topic]
//   rp:lulus  "Lulus"           → Reporting = Lulus, PIC told                  [Program Tengah]
//   rp:baiki  "Perlu baiki"     → asks the admin what to fix (reply)          [Program Tengah]
// Replies to the bot's questions carry a tag in the question: "#RP-LINK-<id>" (Canva link) or "#RP-FIX-<id>" (comment).
// After "Siap duplicate" the PIC can also just paste the link as a normal message (remembered for 1 hour per person).
import { api, tg, json, keyboard, send, head, notify, canvaProblem, webhookSecret, whereFor, APPROVAL, TEMPLATE } from '../lib/report-bot.mjs';

const ID = '[A-Za-z0-9_-]{8,60}';
const who = (u) => (u && u.username ? '@' + u.username : [u?.first_name, u?.last_name].filter(Boolean).join(' ') || 'seseorang');

export default async (req) => {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (req.method !== 'POST' || !token) return json(200, { ok: true });
  if (req.headers.get('x-telegram-bot-api-secret-token') !== webhookSecret(token)) return json(401, { ok: false });
  let update;
  try { update = await req.json(); } catch { return json(200, { ok: true }); }
  const kod = process.env.KOD_TENGAH || '';
  try {
    if (update.callback_query) await onButton(token, kod, update.callback_query);
    else if (update.message) await onMessage(token, kod, update.message);
  } catch (e) {
    console.error('telegram-webhook', e);
  }
  return json(200, { ok: true });   // always 200, so Telegram does not resend the update
};

async function onButton(token, kod, q) {
  const m = new RegExp(`^rp:(ya|batal|dup|siap|belum|lulus|baiki):(${ID})$`).exec(q.data || '');
  if (!m) return tg(token, 'answerCallbackQuery', { callback_query_id: q.id });
  const [, step, id] = m;
  const where = { chat: q.message.chat.id, thread: q.message.message_thread_id };
  const answer = (text, alert) => tg(token, 'answerCallbackQuery', { callback_query_id: q.id, text, show_alert: !!alert }).catch(() => {});
  if (!kod) return answer('Bot belum disediakan (KOD_TENGAH tiada dalam Netlify).', true);

  // 1st question "Adakah program … berjalan?"
  if (step === 'ya' || step === 'batal') {
    const r = await api({ action: 'reportUpdate', kod, id, step: step === 'ya' ? 'ran' : 'cancel', by: who(q.from) });
    const p = r.program;
    if (!r.changed) return answer(p.status === 'Dibatalkan' ? 'Program ini sudah ditanda tidak berjalan.' : 'Sudah dijawab.', true);
    await tg(token, 'editMessageText', {
      chat_id: q.message.chat.id, message_id: q.message.message_id, link_preview_options: { is_disabled: true },
      text: `${q.message.text}\n\n${step === 'ya' ? '✅ Program berjalan' : '❌ Program tidak berjalan (Dibatalkan)'} · ${who(q.from)}`,
    }).catch(() => {});
    if (step === 'batal') return answer('Ditanda Dibatalkan. Tiada tindakan lanjut.');
    await answer('Baik, sila sediakan report.');
    return send(token, where,
      `📝 REPORTING PROGRAM\n\n${head(p)}\n\nSila sediakan report program:\n1️⃣ Duplicate template ini: ${TEMPLATE}\n2️⃣ Tekan "✅ Siap duplicate" dan balas dengan link Canva anda.`,
      { reply_markup: keyboard([[{ text: '✅ Siap duplicate', data: `rp:dup:${id}` }]]) });
  }

  if (step === 'dup') {
    // Remember who pressed it: their next message with a link (no reply needed) is for this programme.
    const { program: p } = await api({ action: 'reportUpdate', kod, id, step: 'wait', waitKey: waitKeyOf(q.message.chat.id, q.from) });
    await answer('Tampal link Canva anda dalam chat.');
    return send(token, where,
      `🔗 ${who(q.from)}, tampal link Canva report anda dalam chat ini (terus hantar, tak perlu reply).\n\n${head(p)}\n\n(Template: ${TEMPLATE})\n#RP-LINK-${id}`,
      { reply_markup: { force_reply: true, selective: true, input_field_placeholder: 'https://www.canva.com/design/…' },
        reply_to_message_id: q.message.message_id });
  }

  if (step === 'belum') {
    const { program: p } = await api({ action: 'reportUpdate', kod, id, step: 'info' });
    await answer('Baik, saya akan tanya lagi 2 hari lagi.');
    return send(token, where, `⏳ Noted, ${who(q.from)}. Report "${p.nama}" belum siap, saya akan follow-up lagi dalam 2 hari.${notify(p)}`,
      { reply_to_message_id: q.message.message_id });
  }

  if (step === 'siap') {
    const r = await api({ action: 'reportUpdate', kod, id, step: 'submit' });
    const p = r.program;
    if (r.needLink) {
      await api({ action: 'reportUpdate', kod, id, step: 'wait', waitKey: waitKeyOf(q.message.chat.id, q.from) });
      await answer('Hantar link Canva dahulu.', true);
      return send(token, where, `🔗 ${who(q.from)}, tampal link Canva report anda dalam chat ini dahulu.\n\n${head(p)}\n#RP-LINK-${id}`,
        { reply_markup: { force_reply: true, selective: true }, reply_to_message_id: q.message.message_id });
    }
    if (!r.changed) return answer(p.status === 'Lulus' ? 'Report ini sudah diluluskan.' : 'Report ini sedang menunggu kelulusan.', true);
    await answer('Dihantar untuk kelulusan.');
    await tg(token, 'editMessageReplyMarkup', { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    await send(token, APPROVAL,
      `📋 KELULUSAN REPORT PROGRAM\n\n${head(p)}\n🔗 ${p.link}\n\nDihantar oleh ${who(q.from)}. Sila semak dan luluskan.`,
      { reply_markup: keyboard([[{ text: '✅ Lulus', data: `rp:lulus:${id}` }, { text: '✏️ Perlu baiki', data: `rp:baiki:${id}` }]]) });
    return send(token, where, `📤 Report "${p.nama}" dihantar kepada admin untuk kelulusan.${notify(p, 'sila tunggu keputusan admin.')}`);
  }

  if (step === 'lulus') {
    const r = await api({ action: 'reportUpdate', kod, id, step: 'approve', by: who(q.from) });
    const p = r.program;
    if (!r.changed) return answer(p.status === 'Lulus' ? 'Sudah diluluskan.' : 'Report ini tidak menunggu kelulusan.', true);
    await answer('Diluluskan ✅');
    await tg(token, 'editMessageText', {
      chat_id: q.message.chat.id, message_id: q.message.message_id,
      text: `${q.message.text}\n\n✅ Diluluskan oleh ${who(q.from)}`, link_preview_options: { is_disabled: true },
    }).catch(() => {});
    return send(token, whereFor(id), `✅ REPORT DILULUSKAN\n\n${head(p)}\n\nTerima kasih! Reporting program ini sudah selesai.${notify(p)}`);
  }

  if (step === 'baiki') {
    const { program: p } = await api({ action: 'reportUpdate', kod, id, step: 'info' });
    if (p.status !== 'Menunggu kelulusan') return answer('Report ini tidak menunggu kelulusan.', true);
    await answer('Balas dengan apa yang perlu dibaiki.');
    return send(token, where, `✏️ ${who(q.from)}, balas mesej ini dengan apa yang perlu dibaiki.\n\n📌 ${p.nama} · ${p.sekolah}\n#RP-FIX-${id}`,
      { reply_markup: { force_reply: true, selective: true }, reply_to_message_id: q.message.message_id });
  }
}

// "<chat>:<user id>" — whose link the bot is waiting for after "Siap duplicate"
const waitKeyOf = (chat, user) => `${chat}:${user && user.id}`;

// A message in the group: a reply to one of the bot's questions, or a plain message with a link from someone who
// just pressed "Siap duplicate" (so the PIC can paste the link without replying).
async function onMessage(token, kod, msg) {
  if (!kod || !msg.from || msg.from.is_bot) return;
  const text = (msg.text || msg.caption || '').trim();
  const asked = msg.reply_to_message;
  const tag = asked && asked.from && asked.from.is_bot ? new RegExp(`#RP-(LINK|FIX)-(${ID})`).exec(asked.text || '') : null;
  if (tag && tag[1] === 'FIX') return onFix(token, kod, msg, tag[2], text);
  const waitKey = waitKeyOf(msg.chat.id, msg.from);
  if (tag) return onLink(token, kod, msg, tag[2], text, waitKey);
  if (!/https?:\/\//i.test(text)) return;            // ordinary chat: nothing to do (no Apps Script call)
  const r = await api({ action: 'reportUpdate', kod, waitKey, step: 'info' });
  if (r.none || !r.program) return;                 // not waiting for a link from this person
  return onLink(token, kod, msg, r.program.id, text, waitKey);
}

async function onLink(token, kod, msg, id, text, waitKey) {
  const where = { chat: msg.chat.id, thread: msg.message_thread_id };
  const url = (text.match(/https?:\/\/\S+/) || [])[0];
  const problem = url ? canvaProblem(url) : 'tiada link dalam mesej';
  if (problem) {
    const { program: p0 } = await api({ action: 'reportUpdate', kod, id, step: 'wait', waitKey });
    return send(token, where,
      `❌ Link ditolak (${problem}), ${who(msg.from)}.\n\nSila duplicate template dahulu: ${TEMPLATE}\nkemudian tampal link Canva report anda sendiri (canva.com/design/…) dalam chat ini.\n\n${head(p0)}\n#RP-LINK-${id}`,
      { reply_to_message_id: msg.message_id, reply_markup: { force_reply: true, selective: true, input_field_placeholder: 'https://www.canva.com/design/…' } });
  }
  const r = await api({ action: 'reportUpdate', kod, id, step: 'link', url, waitKey });
  const p = r.program;
  return send(token, where,
    `✅ Link diterima, ${who(msg.from)}.\n\n${head(p)}\n🔗 ${p.link}\n\nReport sudah siap? Kalau belum, saya akan follow-up setiap 2 hari.`,
    { reply_to_message_id: msg.message_id, reply_markup: keyboard([[{ text: '✅ Sudah siap', data: `rp:siap:${id}` }, { text: '⏳ Belum', data: `rp:belum:${id}` }]]) });
}

// An admin's comment (reply to "Perlu baiki") on a report that needs changes
async function onFix(token, kod, msg, id, text) {
  const where = { chat: msg.chat.id, thread: msg.message_thread_id };
  if (!text) return;
  const r = await api({ action: 'reportUpdate', kod, id, step: 'reject', note: text, by: who(msg.from) });
  const p = r.program;
  if (!r.changed) return send(token, where, 'ℹ️ Report ini tidak lagi menunggu kelulusan.', { reply_to_message_id: msg.message_id });
  await send(token, where, `↩️ Komen dihantar kepada PIC "${p.nama}".`, { reply_to_message_id: msg.message_id });
  return send(token, whereFor(id),
    `❌ REPORT BELUM DILULUSKAN\n\n${head(p)}\n🔗 ${p.link}\n\n✏️ Perlu baiki (${who(msg.from)}):\n${text}\n\nSila baiki dan tekan "Sudah siap" bila selesai.${notify(p, 'sila ambil maklum dan baiki.')}`,
    { reply_markup: keyboard([[{ text: '✅ Sudah siap', data: `rp:siap:${id}` }]]) });
}
