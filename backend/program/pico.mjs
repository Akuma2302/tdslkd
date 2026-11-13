// POST /.netlify/functions/pico
// Bot PICO (the "Legality Tds Tengah" bot, token LEGALITY_BOT_TENGAH) for the Checklist Mingguan, posting to the
// Program Tengah group:
//   - each new screenshot ("✅ PM cikgu · SMAPK"), right after a PIC uploads it on the school page;
//   - Isnin–Jumaat 8 pagi: tags the PIC of schools that have not done the week's checklist;
//   - Sabtu 8 pagi: summary of the week (who did it, who failed).
// The Legality Apps Script decides what is due and writes the messages (action picoClaim, which marks them as sent
// so nothing goes out twice); this function only sends them. What Telegram refuses goes back (picoRelease) and is
// tried again by the every-minute Apps Script trigger momReminderTick.
// Body: { kod: <any valid access code> }, or { kod: <admin code>, demo: true } to post a DEMO of the reminder and summary
//
// Environment variables (Netlify → Site configuration → Environment variables):
//   LEGALITY_BOT_TENGAH   bot token                                       (required)
//   LEGALITY_BOT_CHAT     group chat id (optional; default: Program Tengah)
//   LEGALITY_BOT_THREAD   topic id inside that group (optional)
//   DRY_RUN=1             show the messages, send and mark nothing

const LEGALITY_API = 'https://script.google.com/macros/s/AKfycbwSbdXQNM_xci-P1L_9ivhKzxOEf_aHhBiTvQLQ6YrpwcqDI730b7LXTEZiiJDQlIvh/exec';
const DEFAULT_CHAT = '-1004404368342'; // "Program Tengah"

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

async function api(body) {
  const res = await fetch(LEGALITY_API, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function telegram(token, method, body, isForm) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, isForm
    ? { method: 'POST', body }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!out.ok) throw new Error(out.description || `HTTP ${res.status}`);
  return out.result;
}

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

async function send(token, chat, thread, job) {
  if (job.type === 'photo') {
    const form = new FormData();
    form.append('chat_id', chat);
    if (thread) form.append('message_thread_id', String(thread));
    form.append('caption', job.caption);
    form.append('photo', new Blob([Buffer.from(job.data, 'base64')], { type: job.mime || 'image/jpeg' }), job.name || 'screenshot.jpg');
    return telegram(token, 'sendPhoto', form, true);
  }
  for (const part of split(job.text)) {
    await telegram(token, 'sendMessage', {
      chat_id: chat, text: part, link_preview_options: { is_disabled: true },
      ...(thread ? { message_thread_id: thread } : {}),
    });
  }
}

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  let body;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
  const kod = String(body.kod || '');
  const dryRun = process.env.DRY_RUN === '1';
  const token = process.env.LEGALITY_BOT_TENGAH;
  const chat = process.env.LEGALITY_BOT_CHAT || DEFAULT_CHAT;
  const thread = process.env.LEGALITY_BOT_THREAD ? Number(process.env.LEGALITY_BOT_THREAD) : undefined;
  if (!token && !dryRun) return json(500, { ok: false, error: 'LEGALITY_BOT_TENGAH belum ditetapkan dalam Netlify.' });

  let claim;
  try {
    claim = await api({ action: 'picoClaim', kod, preview: dryRun, demo: !!body.demo });   // demo: admin code only
  } catch {
    return json(502, { ok: false, error: 'Database Legality tidak dapat dihubungi.' });
  }
  if (claim.error) {
    const bad = claim.error === 'KOD_SALAH';
    return json(bad ? 403 : 502, { ok: false, error: bad ? 'Kod akses tidak sah.' : claim.error });
  }
  const jobs = claim.jobs || [];
  if (dryRun) return json(200, { ok: true, dryRun: true, sent: 0, preview: jobs });

  let sent = 0;
  const failed = [];
  for (const job of jobs) {
    try { await send(token, chat, thread, job); sent++; }
    catch (e) { failed.push({ refs: job.refs, error: e.message }); }
  }
  if (failed.length) await api({ action: 'picoRelease', kod, refs: failed.flatMap((f) => f.refs) }).catch(() => {});
  return json(failed.length && !sent ? 502 : 200, {
    ok: !failed.length, sent, failed: failed.length, error: failed[0] ? 'Telegram: ' + failed[0].error : undefined,
  });
};
