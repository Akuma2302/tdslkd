// POST /.netlify/functions/semak-legality
// Bot "Legality Tds Tengah": posts the list of TENGAH schools whose Planning / Peluang sections are still
// empty to the "Program Tengah" group, tagging each school's PIC Legality.
//
// The check itself runs in the Legality Apps Script (action "reminder", admin code only), which reads the
// Checklist Legality sheets and the "PIC Legality" tab and returns the finished message. This function
// only sends that message with the bot token, which lives here in Netlify and never in the browser.
//
// Body: { kod: <admin code>, cawangan: "TENGAH", mode: "check" | "send" }
//   check → confirms the bot and the group (sends nothing)
//   send  → sends the message (nothing is sent when every school is complete)
//
// Environment variables (Netlify → Site configuration → Environment variables):
//   LEGALITY_BOT_TENGAH   token of the Legality Tds Tengah bot          (required)
//   LEGALITY_BOT_CHAT     group chat id (optional; default: Program Tengah)
//   LEGALITY_BOT_THREAD   topic id inside that group (optional)

const LEGALITY_API = 'https://script.google.com/macros/s/AKfycbwSbdXQNM_xci-P1L_9ivhKzxOEf_aHhBiTvQLQ6YrpwcqDI730b7LXTEZiiJDQlIvh/exec';
const DEFAULT_CHAT = '-1004404368342'; // "Program Tengah" (supergroup; was -5212609665 before the upgrade)

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function tg(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (body.ok) return body.result;
  // A group upgraded to a supergroup gets a new id; follow it once.
  const newId = body.parameters?.migrate_to_chat_id;
  if (newId && payload.chat_id && String(newId) !== String(payload.chat_id)) {
    console.warn(`Chat ${payload.chat_id} moved to ${newId}; update LEGALITY_BOT_CHAT / DEFAULT_CHAT.`);
    return tg(token, method, { ...payload, chat_id: newId });
  }
  throw new Error(body.description || `HTTP ${res.status}`);
}

// Telegram allows 4096 characters per message; long lists are split between schools.
function split(text) {
  const parts = [];
  let cur = '';
  for (const block of text.split('\n\n')) {
    const next = cur ? `${cur}\n\n${block}` : block;
    if (next.length > 3800 && cur) { parts.push(cur); cur = block; } else cur = next;
  }
  if (cur) parts.push(cur);
  return parts;
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  let body;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }

  const token = process.env.LEGALITY_BOT_TENGAH;
  const chat = process.env.LEGALITY_BOT_CHAT || DEFAULT_CHAT;
  const thread = process.env.LEGALITY_BOT_THREAD ? Number(process.env.LEGALITY_BOT_THREAD) : undefined;
  if (!token) return json(500, { ok: false, error: 'LEGALITY_BOT_TENGAH belum ditetapkan dalam Netlify.' });

  // Only admins may use the bot: the Apps Script checks the code and refuses anyone else.
  const cawangan = String(body.cawangan || 'TENGAH').toUpperCase();
  const url = `${LEGALITY_API}?action=reminder&cawangan=${encodeURIComponent(cawangan)}&kod=${encodeURIComponent(String(body.kod || ''))}`;
  let report;
  try {
    report = await fetch(url, { redirect: 'follow' }).then((r) => r.json());
  } catch (e) {
    return json(502, { ok: false, error: 'Database Legality tidak dapat dihubungi.' });
  }
  if (report.error) return json(report.error === 'KOD_SALAH' ? 403 : 502, { ok: false, error: report.error === 'KOD_SALAH' ? 'Kod admin diperlukan.' : report.error });

  try {
    if (body.mode === 'check') {
      const me = await tg(token, 'getMe', {});
      const group = await tg(token, 'getChat', { chat_id: chat });
      const member = await tg(token, 'getChatMember', { chat_id: chat, user_id: me.id });
      return json(200, { ok: true, bot: '@' + me.username, group: group.title, status: member.status, schools: report.gaps.length });
    }
    if (!report.text) return json(200, { ok: true, sent: false, reason: 'Semua sekolah sudah lengkap.' });
    for (const part of split(report.text)) {
      await tg(token, 'sendMessage', {
        chat_id: chat, text: part, link_preview_options: { is_disabled: true },
        ...(thread ? { message_thread_id: thread } : {}),
      });
    }
    return json(200, { ok: true, sent: true, schools: report.gaps.length });
  } catch (e) {
    return json(502, { ok: false, error: 'Telegram: ' + e.message });
  }
};
