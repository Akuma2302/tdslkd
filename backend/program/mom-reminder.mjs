// Scheduled function (every minute, on the published site only): bot SU Tengah posts the MOM reminders that
// are due (e.g. 15 minit / 2 jam / 1 hari / 1 minggu sebelum), and any new item that was not announced yet.
// Needs SU_BOT_TENGAH and KOD_TENGAH in Netlify. See backend/lib/mom-bot.mjs.

import { runMomBot } from '../lib/mom-bot.mjs';

export default async () => {
  const kod = process.env.KOD_TENGAH;
  if (!kod || !process.env.SU_BOT_TENGAH) {
    console.warn('mom-reminder: KOD_TENGAH atau SU_BOT_TENGAH belum ditetapkan dalam Netlify.');
    return;
  }
  const r = await runMomBot(kod);
  if (r.body.sent || !r.body.ok) console.log('mom-reminder', JSON.stringify(r.body));
};

export const config = { schedule: '* * * * *' };
