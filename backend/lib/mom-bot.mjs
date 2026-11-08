// Used by the Netlify function mom-hantar, called right after "Simpan MOM" and every minute by the Apps Script
// trigger momReminderTick (only when something is waiting).
// Bot "SU Tengah" posts the MOM of cawangan Tengah to the SU Tengah group (t.me/c/1790355836/...):
//   - each new item to its unit's topic, plus one list of new items to "MOM Keseluruhan";
//   - the reminders each item asked for (any number of minit / jam / hari / minggu / bulan before due).
// The Legality Apps Script decides what is due and writes the messages (action momClaim, which also marks them
// as sent so nothing is posted twice); this module only sends them. Messages Telegram refuses go back to the
// queue (action momRelease) and are tried again on the next run.
//
// Environment variables (Netlify → Site configuration → Environment variables):
//   SU_BOT_TENGAH   token of the SU Tengah bot                         (required)
//   SU_BOT_CHAT     group chat id (optional; default: SU Tengah group)

const LEGALITY_API = 'https://script.google.com/macros/s/AKfycbwSbdXQNM_xci-P1L_9ivhKzxOEf_aHhBiTvQLQ6YrpwcqDI730b7LXTEZiiJDQlIvh/exec';
const DEFAULT_CHAT = '-1001790355836'; // SU Tengah group (t.me/c/1790355836)

async function api(body) {
  const res = await fetch(LEGALITY_API, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function tg(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  if (body.ok) return body.result;
  const newId = body.parameters?.migrate_to_chat_id;   // group upgraded to a supergroup: follow once
  if (newId && String(newId) !== String(payload.chat_id)) {
    console.warn(`Chat ${payload.chat_id} moved to ${newId}; update SU_BOT_CHAT.`);
    return tg(token, method, { ...payload, chat_id: newId });
  }
  throw new Error(body.description || `HTTP ${res.status}`);
}

// Telegram allows 4096 characters per message; long lists are split between items.
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

/** Sends everything that is due now. dryRun: only shows the messages (nothing sent, nothing marked). */
export async function runMomBot(kod, { dryRun = false } = {}) {
  const token = process.env.SU_BOT_TENGAH;
  const chat = process.env.SU_BOT_CHAT || DEFAULT_CHAT;
  if (!token && !dryRun) return { status: 500, body: { ok: false, error: 'SU_BOT_TENGAH belum ditetapkan dalam Netlify.' } };

  let claim;
  try {
    claim = await api({ action: 'momClaim', kod, peek: dryRun });
  } catch {
    return { status: 502, body: { ok: false, error: 'Database Legality tidak dapat dihubungi.' } };
  }
  if (claim.error) {
    const bad = claim.error === 'KOD_SALAH';
    return { status: bad ? 403 : 502, body: { ok: false, error: bad ? 'Kod akses tidak sah.' : claim.error } };
  }

  const jobs = claim.jobs || [];
  if (dryRun) return { status: 200, body: { ok: true, dryRun: true, sent: 0, preview: jobs } };

  let sent = 0;
  const failed = [];
  for (const job of jobs) {
    try {
      for (const part of split(job.text)) {
        await tg(token, 'sendMessage', {
          chat_id: chat, message_thread_id: job.thread, text: part, link_preview_options: { is_disabled: true },
        });
      }
      sent++;
    } catch (e) {
      failed.push({ refs: job.refs, error: e.message });
    }
  }
  if (failed.length) {
    await api({ action: 'momRelease', kod, refs: failed.flatMap((f) => f.refs) }).catch(() => {});
  }
  return {
    status: failed.length && !sent ? 502 : 200,
    body: { ok: !failed.length, sent, failed: failed.length, error: failed[0] ? 'Telegram: ' + failed[0].error : undefined },
  };
}
