# Yosh Junior — Sistem Pasukan

Laman web statik (HTML/CSS/JavaScript biasa, tiada build) di **https://tdslkd.netlify.app**, dengan backend Google Apps Script.

| Link | Untuk | Fail |
|---|---|---|
| `/` | Portal user, tab **Database Legality** | `frontend/index.html` |
| `/pentajmikan` | Portal user, tab **Pentajmikan** (akan datang) | `frontend/pentajmikan.html` |
| `/pembinaan` | Portal user, tab **Pembinaan** (akan datang) | `frontend/pembinaan.html` |
| `/admin` | Dashboard admin (Overall, Murabbi, Legality…) | `frontend/admin.html` |
| `/borang.html` | Borang laporan Unit Murabbi | `frontend/borang.html` |

## Struktur folder

```
tdslkd/
├── frontend/                    ← folder yang Netlify publish (lihat netlify.toml)
│   ├── index.html               portal user: Database Legality
│   ├── pentajmikan.html         portal user: Pentajmikan (akan datang)
│   ├── pembinaan.html           portal user: Pembinaan (akan datang)
│   ├── admin.html               dashboard admin
│   ├── borang.html              borang Unit Murabbi
│   ├── _redirects               /admin → admin.html, /legality.html → /
│   ├── assets/
│   │   ├── css/style.css        semua gaya
│   │   └── images/logo.png
│   └── src/
│       ├── config/config.js     pautan API Apps Script
│       ├── services/            panggilan API (legalityApi.js: kod akses, get/post)
│       ├── components/          UI boleh guna semula (portalNav.js: tab portal user, slides.js: eksport slaid)
│       ├── features/            modul ikut unit (legality/, murabbi/) untuk dashboard admin
│       ├── pages/               skrip utama setiap halaman (portal/, admin/, borang/)
│       └── data/                kandungan statik (units.js, murabbi-reports.js)
├── backend/                     Google Apps Script (tidak dipublish ke Netlify)
│   ├── legality/                Legality.gs + README (setup, kod akses, sheet cawangan)
│   └── murabbi/                 Code.gs + README + senarai-murabbi.csv
├── tools/                       skrip pembantu (import_murabbi.py)
└── netlify.toml
```

### Tambah tab baru dalam portal user

Tambah satu baris dalam `frontend/src/components/portalNav.js`, kemudian buat halamannya (salin `pembinaan.html`, tukar `data-tab` dan tajuk).

### Susunan skrip dalam HTML

Tiada bundler, jadi setiap halaman memuatkan skrip mengikut turutan: `config` → `services` / `components` → `data` / `features` → `pages`. Modul unit dalam admin mendaftar diri dalam `window.UNIT_VIEWS` sebelum `pages/admin/app.js` dimuatkan.

## Uji di komputer

```bash
python -m http.server 4320 --directory frontend
```

Buka http://localhost:4320/ (portal) dan http://localhost:4320/admin.html (admin; `/admin` hanya berfungsi di Netlify).

## Deploy

Push ke `main` → Netlify bina semula secara automatik dari folder `frontend/`.

Backend Apps Script dikemas kini berasingan: tampal fail `.gs` ke editor Apps Script, kemudian **Deploy → Manage deployments → Edit → New version**. Lihat README dalam `backend/legality/` dan `backend/murabbi/`.
