// POST /.netlify/functions/report-bot
// Reporting program: posts the reminders / follow-ups that are due to the Reporting topic (see backend/lib/report-bot.mjs).
// Called every minute by the Legality Apps Script trigger (only when something is due).
// Body: { kod }                      send what is due (any Tengah / admin code)
//       { kod: <admin>, setup: true } point the bot's webhook at telegram-webhook (run once)
//       { kod: <admin>, test: true }  make a test programme (testing topic 62) and send its first reminder now
//       { kod: <admin>, testClear: true } remove the test programmes
import { api, tg, json, keyboard, send, webhookSecret, whereFor, LEGALITY_API } from '../lib/report-bot.mjs';

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  let body;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
  const kod = String(body.kod || '');
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const dryRun = process.env.DRY_RUN === '1';
  if (!token && !dryRun) return json(500, { ok: false, error: 'TELEGRAM_BOT_TOKEN belum ditetapkan.' });

  if (body.setup) {
    // Admin only: the Apps Script "ping" tells which code this is.
    const ping = await fetch(`${LEGALITY_API}?action=ping&kod=${encodeURIComponent(kod)}`).then((r) => r.json()).catch(() => ({}));
    if (ping.role !== 'admin') return json(403, { ok: false, error: 'Kod admin diperlukan.' });
    const url = new URL('/.netlify/functions/telegram-webhook', req.url).toString();
    await tg(token, 'setWebhook', { url, secret_token: webhookSecret(token), allowed_updates: ['message', 'callback_query'] });
    const info = await tg(token, 'getWebhookInfo', {});
    const me = await tg(token, 'getMe', {});
    return json(200, { ok: true, bot: '@' + me.username, webhook: info.url, pending: info.pending_update_count,
                       lastError: info.last_error_message || '', kodTengah: !!process.env.KOD_TENGAH });
  }
  if (body.test || body.testClear) {
    try {
      const r = await api({ action: body.test ? 'reportTest' : 'reportTestClear', kod, pics: body.pics });
      if (body.testClear) return json(200, r);
    } catch (e) { return json(403, { ok: false, error: e.message }); }
  }

  let claim;
  try { claim = await api({ action: 'reportClaim', kod, peek: dryRun }); }
  catch (e) { return json(/KOD_SALAH/.test(e.message) ? 403 : 502, { ok: false, error: e.message }); }
  const jobs = claim.jobs || [];
  if (dryRun) return json(200, { ok: true, dryRun: true, preview: jobs });

  let sent = 0;
  const failed = [];
  for (const job of jobs) {
    try { await send(token, whereFor(job.id), job.text, { reply_markup: keyboard(job.buttons) }); sent++; }
    catch (e) { failed.push({ id: job.id, error: e.message }); }
  }
  if (failed.length) await api({ action: 'reportRelease', kod, ids: failed.map((f) => f.id) }).catch(() => {});
  return json(failed.length && !sent ? 502 : 200, { ok: !failed.length, sent, failed: failed.length, error: failed[0]?.error });
};
