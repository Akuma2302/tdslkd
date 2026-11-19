# Docs

## Deploy

| Bahagian | Cara |
|---|---|
| **Frontend** (`frontend/`) | `git push` ke `main`. Netlify jalankan `node tools/stamp-assets.mjs` (tambah `?v=<commit>` pada setiap fail CSS/JS) dan terbitkan `frontend/`. Siap dalam ~20–30 saat. |
| **Netlify Functions** (`backend/functions/`) | Ikut sekali dengan push yang sama. URL kekal `/.netlify/functions/<nama>` (hantar, pico, report-bot, telegram-webhook, semak-legality, mom-hantar). Kod kongsi dalam `backend/functions/lib/` (bukan function). |
| **Apps Script Legality** (`backend/apps-script/legality/Legality.gs`) | Tidak ikut push. Dalam editor projek *Legality API (NGO)*: tampal kod → **Save** → **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. URL `/exec` kekal sama. Lihat `backend/apps-script/legality/README.md`. |
| **Apps Script Murabbi** (`backend/apps-script/murabbi/Code.gs`) | Sama seperti di atas, dalam projeknya sendiri. |

Semak selepas deploy Apps Script: `…/exec?action=ping` tanpa kod mesti memulangkan `{"error":"KOD_SALAH"}` (bukan halaman kebenaran Google).

Trigger dalam projek Legality: `momReminderTick` dan `warmCache` (setiap 10 minit, dipasang dengan `installWarmTrigger`).

## Peraturan UI portal user

- Gaya aplikasi: bar atas kecil + tab bawah di telefon (`frontend/src/layout/appShell.js`), pautan yang sama di bar atas pada skrin besar.
- Rupa mesti sama di iPhone, Android dan desktop: kawalan borang (select, tarikh, masa) sentiasa diberi gaya sendiri; pilihan pendek (≤ 6) jadi cip (`window.YoshChips`).
- Fail CSS/JS dirujuk dengan laluan bermula `/` supaya versinya dicop setiap deploy.
- Uji pada lebar telefon (375px) dan desktop sebelum push; Chrome bukan Safari iOS, jadi minta screenshot iPhone bila perlu.
- Data sekolah disimpan automatik (Progress semasa, PIC, Fasa terus; bahagian lain bila selesai mengisi atau tukar tab).

## Struktur folder

Lihat `README.md` di akar projek.
