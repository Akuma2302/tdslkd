# Yosh Junior — Sistem Pasukan

Laman web statik (HTML/CSS/JavaScript biasa, tiada build) di **https://tdslkd.netlify.app**, dengan backend Google Apps Script.

| Link | Untuk | Fail |
|---|---|---|
| `/` | Portal user, **Utama**: kad setiap tab dengan penerangan ringkas | `frontend/index.html` |
| `/legality/database` | Portal user, **Legality ▾ Database Legality** (`/legality` pun dibawa ke sini) | `frontend/legality/database.html` |
| `/legality/program` | Portal user, **Legality ▾ Program Sekolah**: borang program (hantar ke Telegram + simpan ke Sheet Program) | `frontend/legality/program.html` |
| `/legality/panduan` | Portal user, **Legality ▾ Panduan Legality** (akan datang) | `frontend/legality/panduan.html` |
| `/alumni` | Portal user, tab **Alumni** (sheet Alumni Back to School) | `frontend/alumni.html` |
| `/pentajmikan` | Portal user, tab **Pentajmikan** (akan datang) | `frontend/pentajmikan.html` |
| `/pembinaan` | Portal user, tab **Pembinaan** (akan datang) | `frontend/pembinaan.html` |
| `/admin` | Dashboard admin (Overall, Murabbi, Legality…) | `frontend/admin.html` |
| `/tengah` | Halaman Cawangan Tengah (kod Tengah): **MOM** — Tarikh MOM, Tindakan, Tarikh/Masa Due, Unit, PIC, Reminder; bot SU Tengah hantar ke topik unit | `frontend/tengah.html` |
| `/borang.html` | Borang laporan Unit Murabbi | `frontend/borang.html` |

## Log masuk

Selepas intro, semua halaman minta kod. Kod user → portal (`/`), kod admin → `/admin`, kod Tengah → `/tengah`. Kod hanya disimpan untuk sesi browser semasa: tutup tab atau browser, dan kod perlu dimasukkan semula. Butang **Log keluar** ada di portal dan admin. Butiran kod: `backend/legality/README.md`.

## Struktur folder

```
tdslkd/
├── frontend/                    ← folder yang Netlify publish (lihat netlify.toml)
│   ├── index.html               portal user: Utama (kad setiap tab)
│   ├── legality/                portal user, menu Legality:
│   │   ├── database.html        /legality/database (CRM, progress, planning…)
│   │   ├── program.html         /legality/program (borang Program Sekolah, dulu laman yoshjuniorprogram)
│   │   └── panduan.html         /legality/panduan (akan datang)
│   ├── alumni.html              portal user: Alumni Back to School
│   ├── pentajmikan.html         portal user: Pentajmikan (akan datang)
│   ├── pembinaan.html           portal user: Pembinaan (akan datang)
│   ├── admin.html               dashboard admin
│   ├── tengah.html              halaman Cawangan Tengah (MOM)
│   ├── borang.html              borang Unit Murabbi
│   ├── _redirects               /admin → admin.html, /legality → /legality/database, pautan lama
│   ├── assets/
│   │   ├── css/style.css        gaya portal & admin
│   │   ├── css/chrome.css       navbar & skrin log masuk (dikongsi semua halaman)
│   │   ├── css/program.css      gaya borang Program Sekolah
│   │   └── images/logo.png
│   └── src/
│       ├── config/config.js     pautan API Apps Script
│       ├── services/            panggilan API (legalityApi.js: kod akses, get/post)
│       ├── components/          UI boleh guna semula (intro.js, gate.js: log masuk/keluar, portalNav.js: navbar portal user dengan dropdown, slides.js)
│       ├── features/            modul ikut unit (legality/, murabbi/) untuk dashboard admin
│       ├── pages/               skrip utama setiap halaman (home/, portal/, program/, alumni/, admin/, borang/)
│       │                        program/template.js dikongsi dengan fungsi Telegram di backend
│       └── data/                kandungan statik (units.js, murabbi-reports.js)
├── backend/                     Google Apps Script (tidak dipublish ke Netlify)
│   ├── legality/                Legality.gs + README (setup, kod akses, sheet cawangan, Program Sekolah)
│   ├── program/                 fungsi Netlify: hantar.mjs (borang program → Telegram), semak-legality.mjs (bot Legality Tds Tengah),
│   │                            mom-hantar.mjs + mom-reminder.mjs (bot SU Tengah: MOM selepas simpan + reminder setiap minit)
│   ├── lib/                     kod dikongsi fungsi Netlify (mom-bot.mjs)
│   └── murabbi/                 Code.gs + README + senarai-murabbi.csv
├── dev-server.mjs               pelayan ujian tempatan (halaman + fungsi Telegram)
├── tools/                       skrip pembantu (import_murabbi.py)
└── netlify.toml
```

### Tambah tab baru dalam portal user

Tambah satu entri dalam `frontend/src/components/portalNav.js` (label, link, tajuk, penerangan, sumber data, status, dan `menu` untuk dropdown navbar). Item dropdown dengan `soon: true` dipapar sebagai "Akan datang". Navbar dan kad di halaman Utama dibina dari senarai yang sama. Kemudian buat halamannya (salin `pembinaan.html`, tukar `data-tab` dan tajuk).

### Susunan skrip dalam HTML

Tiada bundler, jadi setiap halaman memuatkan skrip mengikut turutan: `config` → `services` / `components` → `data` / `features` → `pages`. Modul unit dalam admin mendaftar diri dalam `window.UNIT_VIEWS` sebelum `pages/admin/app.js` dimuatkan.

## Uji di komputer

```bash
node dev-server.mjs --dry-run
```

Buka http://localhost:4321/ (portal), http://localhost:4321/legality/database, http://localhost:4321/legality/program dan http://localhost:4321/admin. Pelayan ini meniru Netlify: pautan cantik (`/alumni`), `_redirects`, dan fungsi Telegram borang Program. Dengan `--dry-run`, mesej Telegram dibina dan disemak tetapi **tidak** dihantar. Tanpa `--dry-run`, ia betul-betul menghantar menggunakan token dalam fail `.env` (tidak masuk GitHub).

## Deploy

Push ke `main` → Netlify bina semula secara automatik dari folder `frontend/` (dan fungsi dalam `netlify/functions/`).

Fungsi Telegram untuk borang Program perlukan environment variables dalam Netlify (**Site configuration → Environment variables**):
`TELEGRAM_BOT_TOKEN`, `GROUP_TENGAH`, `GROUP_UTARA`, `GROUP_PANTAI_TIMUR`, `GROUP_BORNEO`, `GROUP_INDONESIA`, `GROUP_MEA` (pilihan; tanpanya MEA hanya dihantar ke topik MEA dalam group kompilasi) (pilihan: `DRY_RUN=1` untuk uji tanpa hantar mesej). Selepas menukarnya, buat **Deploys → Trigger deploy**.

Backend Apps Script dikemas kini berasingan: tampal fail `.gs` ke editor Apps Script, kemudian **Deploy → Manage deployments → Edit → New version**. Lihat README dalam `backend/legality/` dan `backend/murabbi/`.
