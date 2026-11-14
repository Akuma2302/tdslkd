// Reporting program — shared by the Netlify functions report-bot and telegram-webhook.
// Bot: the Program bot (TELEGRAM_BOT_TOKEN). Two groups:
//   Reporting topic  t.me/c/2078197579/4523  reminders and follow-ups to the Main PIC and PIC Legality
//   Program Tengah   t.me/c/4404368342/60    approval requests ([Lulus] / [Perlu baiki])
// The state of each programme lives in the Program sheet (Legality Apps Script: reportClaim / reportUpdate).
//
// Environment variables (Netlify → Site configuration → Environment variables):
//   TELEGRAM_BOT_TOKEN   bot token (already set for the Program form)
//   KOD_TENGAH           Tengah access code — used by telegram-webhook to update the Program sheet
//   REPORT_CHAT / REPORT_THREAD, APPROVAL_CHAT / APPROVAL_THREAD   (optional overrides of the groups below)
import { createHash } from 'node:crypto';

export const LEGALITY_API = 'https://script.google.com/macros/s/AKfycbw2jxiYTQ0bu0C1c9-EvOQh7BW8SgD5fP3tjFjxu-UcWeBCuykc3pZeu4e3F1S86UH3iw/exec';
export const TEMPLATE = 'https://canva.link/m38sc8m51fkhgjq';
export const REPORT = {
  chat: process.env.REPORT_CHAT || '-1002078197579',
  thread: Number(process.env.REPORT_THREAD || 4523),
};
// Test programmes (ID "TEST-…", made with report-bot { test: true }) talk to the testing topic in Program Tengah.
export const TESTING = {
  chat: process.env.TEST_CHAT || '-1004404368342',
  thread: Number(process.env.TEST_THREAD || 62),
};
export const whereFor = (id) => (/^TEST-/.test(String(id)) ? TESTING : REPORT);
export const APPROVAL = {
  chat: process.env.APPROVAL_CHAT || '-1004404368342',
  thread: Number(process.env.APPROVAL_THREAD || 60),
};

export const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// Secret Telegram sends with every webhook call (derived from the token, so no extra setting is needed).
export function webhookSecret(token) {
  return createHash('sha256').update('tdslkd-report:' + token).digest('hex').slice(0, 48);
}

export async function api(body) {
  const res = await fetch(LEGALITY_API, {
    method: 'POST', redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(body),
  });
  const out = await res.json();
  if (out.error) throw new Error(out.error);
  return out;
}

export async function tg(token, method, payload) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  const out = await res.json().catch(() => ({}));
  if (!out.ok) throw new Error(out.description || `HTTP ${res.status}`);
  return out.result;
}

export const keyboard = (rows) => ({ inline_keyboard: rows.map((r) => r.map((b) => ({ text: b.text, callback_data: b.data }))) });

export function send(token, where, text, extra = {}) {
  return tg(token, 'sendMessage', {
    chat_id: where.chat, ...(where.thread ? { message_thread_id: where.thread } : {}),
    text, link_preview_options: { is_disabled: true }, ...extra,
  });
}

// The PIC's own Canva design: a canva.com / canva.link address that is not the template itself.
// Returns "" when fine, else why it was refused.
export function canvaProblem(url) {
  let u;
  try { u = new URL(url); } catch { return 'bukan link yang sah'; }
  const host = u.hostname.toLowerCase();
  if (!/(^|\.)canva\.(com|link)$/.test(host)) return 'bukan link Canva';
  const bare = (x) => { const v = new URL(x); return (v.hostname.replace(/^www\./, '') + v.pathname).replace(/\/+$/, '').toLowerCase(); };
  if (bare(url) === bare(TEMPLATE)) return 'ini link template, bukan link report anda';
  return '';
}

// "@main @legality" of a programme (Main PIC + PIC Legality from the Program form), or "" when none has a username
export const tags = (p) => (p.pics && p.pics.length ? p.pics.join(' ') : '');
// Closing line that pings the PICs so they take note: "\n\n@a @b sila ambil maklum."
export const notify = (p, what = 'sila ambil maklum.') => (tags(p) ? `\n\n${tags(p)} ${what}` : '');

const BULAN =['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
export function head(p) {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.tamat || '');
  return `📌 ${p.nama}\n🏫 ${p.sekolah}${d ? ` · 📅 ${+d[3]} ${BULAN[+d[2] - 1]} ${d[1]}` : ''}\n👤 ${p.pics && p.pics.length ? p.pics.join(' ') : '(PIC tiada username)'}`;
}
