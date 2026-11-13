// POST /.netlify/functions/telegram-webhook
// Telegram calls this for the Program bot (TELEGRAM_BOT_TOKEN) when someone taps a reporting button or replies to
// one of the bot's reporting questions. Set up once with report-bot { setup: true }. See backend/lib/report-bot.mjs.
//
// Buttons (callback_data "rp:<step>:<programme id>"):
//   rp:dup    "Siap duplicate"  → asks for the Canva link (reply)            [Reporting topic]
//   rp:siap   "Sudah siap"      → approval request to Program Tengah topic 60  [Reporting topic]
//   rp:belum  "Belum"           → noted; asked again in 2 days                [Reporting topic]
//   rp:lulus  "Lulus"           → Reporting = Lulus, PIC told                  [Program Tengah]
//   rp:baiki  "Perlu baiki"     → asks the admin what to fix (reply)          [Program Tengah]
// Replies to the bot's questions carry a tag in the question: "#RP-LINK-<id>" (Canva link) or "#RP-FIX-<id>" (comment).
import { api, tg, json, keyboard, send, head, webhookSecret, whereFor, APPROVAL, TEMPLATE } from '../lib/report-bot.mjs';

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
    else if (update.message && update.message.reply_to_message) await onReply(token, kod, update.message);
  } catch (e) {
    console.error('telegram-webhook', e);
  }
  return json(200, { ok: true });   // always 200, so Telegram does not resend the update
};

async function onButton(token, kod, q) {
  const m = new RegExp(`^rp:(dup|siap|belum|lulus|baiki):(${ID})$`).exec(q.data || '');
  if (!m) return tg(token, 'answerCallbackQuery', { callback_query_id: q.id });
  const [, step, id] = m;
  const where = { chat: q.message.chat.id, thread: q.message.message_thread_id };
  const answer = (text, alert) => tg(token, 'answerCallbackQuery', { callback_query_id: q.id, text, show_alert: !!alert }).catch(() => {});
  if (!kod) return answer('Bot belum disediakan (KOD_TENGAH tiada dalam Netlify).', true);

  if (step === 'dup') {
    const { program: p } = await api({ action: 'reportUpdate', kod, id, step: 'info' });
    await answer('Balas dengan link Canva anda.');
    return send(token, where,
      `🔗 Balas mesej ini dengan link Canva report anda.\n\n${head(p)}\n\n(Template: ${TEMPLATE})\n#RP-LINK-${id}`,
      { reply_markup: { force_reply: true, selective: false, input_field_placeholder: 'https://www.canva.com/design/…' } });
  }

  if (step === 'belum') {
    await answer('Baik, saya akan tanya lagi 2 hari lagi.');
    return send(token, where, `⏳ Noted, ${who(q.from)}. Saya akan follow-up lagi dalam 2 hari.`, { reply_to_message_id: q.message.message_id });
  }

  if (step === 'siap') {
    const r = await api({ action: 'reportUpdate', kod, id, step: 'submit' });
    const p = r.program;
    if (r.needLink) {
      await answer('Hantar link Canva dahulu.', true);
      return send(token, where, `🔗 Balas mesej ini dengan link Canva report anda dahulu.\n\n${head(p)}\n#RP-LINK-${id}`,
        { reply_markup: { force_reply: true, selective: false } });
    }
    if (!r.changed) return answer(p.status === 'Lulus' ? 'Report ini sudah diluluskan.' : 'Report ini sedang menunggu kelulusan.', true);
    await answer('Dihantar untuk kelulusan.');
    await tg(token, 'editMessageReplyMarkup', { chat_id: q.message.chat.id, message_id: q.message.message_id, reply_markup: { inline_keyboard: [] } }).catch(() => {});
    await send(token, APPROVAL,
      `📋 KELULUSAN REPORT PROGRAM\n\n${head(p)}\n🔗 ${p.link}\n\nDihantar oleh ${who(q.from)}. Sila semak dan luluskan.`,
      { reply_markup: keyboard([[{ text: '✅ Lulus', data: `rp:lulus:${id}` }, { text: '✏️ Perlu baiki', data: `rp:baiki:${id}` }]]) });
    return send(token, where, `📤 Report "${p.nama}" dihantar kepada admin untuk kelulusan.`);
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
    return send(token, whereFor(id), `✅ REPORT DILULUSKAN\n\n${head(p)}\n\nTerima kasih! Reporting program ini sudah selesai.`);
  }

  if (step === 'baiki') {
    const { program: p } = await api({ action: 'reportUpdate', kod, id, step: 'info' });
    if (p.status !== 'Menunggu kelulusan') return answer('Report ini tidak menunggu kelulusan.', true);
    await answer('Balas dengan apa yang perlu dibaiki.');
    return send(token, where, `✏️ ${who(q.from)}, balas mesej ini dengan apa yang perlu dibaiki.\n\n📌 ${p.nama} · ${p.sekolah}\n#RP-FIX-${id}`,
      { reply_markup: { force_reply: true, selective: true }, reply_to_message_id: q.message.message_id });
  }
}

async function onReply(token, kod, msg) {
  const asked = msg.reply_to_message;
  if (!asked.from || !asked.from.is_bot || !kod) return;
  const tag = new RegExp(`#RP-(LINK|FIX)-(${ID})`).exec(asked.text || '');
  if (!tag) return;
  const [, kind, id] = tag;
  const where = { chat: msg.chat.id, thread: msg.message_thread_id };
  const text = (msg.text || msg.caption || '').trim();

  if (kind === 'LINK') {
    const url = (text.match(/https?:\/\/\S+/) || [])[0];
    if (!url) return send(token, where, '⚠️ Saya tidak jumpa link. Balas mesej saya tadi dengan link Canva (bermula dengan https://).', { reply_to_message_id: msg.message_id });
    const r = await api({ action: 'reportUpdate', kod, id, step: 'link', url });
    const p = r.program;
    return send(token, where,
      `✅ Link diterima, ${who(msg.from)}.\n\n${head(p)}\n🔗 ${p.link}\n\nReport sudah siap? Kalau belum, saya akan follow-up setiap 2 hari.`,
      { reply_to_message_id: msg.message_id, reply_markup: keyboard([[{ text: '✅ Sudah siap', data: `rp:siap:${id}` }, { text: '⏳ Belum', data: `rp:belum:${id}` }]]) });
  }

  // FIX: an admin's comment on a report that needs changes
  if (!text) return;
  const r = await api({ action: 'reportUpdate', kod, id, step: 'reject', note: text, by: who(msg.from) });
  const p = r.program;
  if (!r.changed) return send(token, where, 'ℹ️ Report ini tidak lagi menunggu kelulusan.', { reply_to_message_id: msg.message_id });
  await send(token, where, `↩️ Komen dihantar kepada PIC "${p.nama}".`, { reply_to_message_id: msg.message_id });
  return send(token, whereFor(id),
    `❌ REPORT BELUM DILULUSKAN\n\n${head(p)}\n🔗 ${p.link}\n\n✏️ Perlu baiki (${who(msg.from)}):\n${text}\n\nSila baiki dan tekan "Sudah siap" bila selesai.`,
    { reply_markup: keyboard([[{ text: '✅ Sudah siap', data: `rp:siap:${id}` }]]) });
}
