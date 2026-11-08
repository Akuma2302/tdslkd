// POST /.netlify/functions/mom-hantar
// Called by the /tengah page right after "Simpan MOM": bot SU Tengah posts the new MOM items to each unit's
// topic (and the list to "MOM Keseluruhan"), plus any reminder that is due. See backend/lib/mom-bot.mjs.
// Body: { kod: <Tengah or admin code> }

import { runMomBot } from '../lib/mom-bot.mjs';

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });
  let body;
  try { body = await req.json(); } catch { return json(400, { ok: false, error: 'Invalid JSON' }); }
  const r = await runMomBot(String(body.kod || ''), { dryRun: process.env.DRY_RUN === '1' });
  return json(r.status, r.body);
};
