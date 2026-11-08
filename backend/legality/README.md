# Borang Checklist Legality: setup & penggunaan

Portal user di `https://tdslkd.netlify.app/` (`frontend/index.html`, tab **Database Legality**) ialah borang untuk ahli cawangan. Dashboard admin di `https://tdslkd.netlify.app/admin` (`frontend/admin.html`). Mereka pilih **cawangan → sekolah**, kemudian lihat dan kemas kini CRM (dengan KPI), Alumni, Program, Analisa, Planning, Modul dan Peluang. Data ditulis terus ke tab sekolah dalam Google Sheet cawangan masing-masing, jadi format sheet kekal sama dan tab CRM / Program dalam sheet terus update sendiri.

Backend: `backend/legality/Legality.gs`, dipasang sebagai projek Apps Script berasingan (akaun pemilik sheet), dan dipublish sebagai **Web app** (Execute as: Me, Who has access: Anyone). Pautan `/exec` diletak dalam `frontend/src/config/config.js` → `legalityApi`.

## Sheet setiap cawangan

| Cawangan | Sheet |
|---|---|
| TENGAH | https://docs.google.com/spreadsheets/d/1xrAVOswvIrRmmrmPaywzdKPEijJXYUiGkQujr9TfFUs |
| UTARA | https://docs.google.com/spreadsheets/d/1F2AjjajCZuP_WJn7pfnx8Sz_rcEvw2pZDI3jxyzN8pQ |
| PT | https://docs.google.com/spreadsheets/d/1Cskf9vo-nTtGOpM7C2C8pjKiBA_ILCt2hKT-JHgDwhE |
| INDONESIA | https://docs.google.com/spreadsheets/d/1i0koio9dQV79MlFFp0890DP0yEaiOzpCtulSSBC0-hU |
| BORNEO | https://docs.google.com/spreadsheets/d/1RVxHQzdP66Ne38i6TNfxgr-1OKsmJFOAOYcuRdjX71I |
| MEA | https://docs.google.com/spreadsheets/d/168_tRkIJCW6Pd2H_iJ9wBrRXYhiMqh7SteTh39ExBp4 |

Sheet selain TENGAH dibuat oleh `setupCawanganSheets()` sebagai salinan TENGAH tanpa sekolah. Senarai ini disimpan dalam Script Properties (`SHEETS`); jalankan `showCawanganSheets()` untuk melihatnya.

## Progress Legality & dashboard admin

- Setiap sheet cawangan ada tab **Progress**: satu baris setiap sekolah, 6 checkbox (hijau = dah buat, merah = belum):
  1. Menetapkan tarikh meeting dengan pihak sekolah
  2. Pembentangan (Program 2026 + persetujuan kolaborasi program 2027)
  3. Dapatkan surat kerjasama program dan surat kebenaran masuk
  4. Pemastian tarikh mentoring
  5. Pelaksanaan entrance survey
  6. Pelaksanaan exit survey
- Dalam borang, setiap sekolah ada bahagian **Progress** di atas sekali. Sekolah baru terus dapat baris dalam tab Progress.
- Tab **Unit Legality** dalam admin (`frontend/src/features/legality/legality-admin.js`) mengumpul semua cawangan: bilangan sekolah, orang CRM, setiap langkah progress, Phase CRM, jadual mengikut cawangan, dan jadual Progress Legality Sekolah. Data disimpan sementara 10 minit; butang **Muat semula** ambil data terkini.
- `setupProgress()` mencipta tab Progress dan mengisi TENGAH daripada jadual progress 7 Nov 2026 (sekolah "KPI" dalam jadual itu tiada tab sekolah, jadi tidak dimasukkan).

## Kod akses & log masuk

Selepas intro, setiap halaman (portal user dan admin) memaparkan skrin **Log masuk** (`frontend/src/components/gate.js`). Kod yang dimasukkan menentukan ke mana orang itu dibawa:

| Kod | Script property | Dibawa ke | Boleh |
|---|---|---|---|
| Kod user | `KOD_AKSES` | Portal user `/` | Baca & kemas kini data sekolah |
| Kod admin | `KOD_ADMIN` | Dashboard `/admin` | Semua, termasuk ringkasan semua cawangan (`summary`) |

- Kod disimpan untuk **sesi browser semasa sahaja**: bila tab atau browser ditutup dan dibuka semula, pengguna perlu log masuk lagi. Butang **Log keluar** membawa terus ke skrin log masuk.
- Tukar kod: Apps Script → **Project Settings → Script properties** → ubah `KOD_AKSES` atau `KOD_ADMIN` (atau jalankan `setKodAkses()` / `setKodAdmin()` untuk kod rawak). Pengguna akan diminta log masuk semula secara automatik.
- Kongsi kod admin hanya dengan pentadbir.

## Peraturan tab sekolah (supaya borang dapat membacanya)

- Tab sekolah mesti dibuat daripada template **"Nama Sekolah \*Duplicate"** (borang "Tambah sekolah baru" buat ini secara automatik) dan namanya ada dalam tab **Senarai Sekolah**.
- Jangan tukar teks tajuk bahagian dalam lajur A: *Alumni Sekolah*, *Program Yang Telah Berjalan…*, *Analisa Situasi…*, *Planning Legality*, *Modul Program…*, *Peluang Lain…*. Borang mencari bahagian melalui teks ini.
- KPI CRM berada dalam lajur H:AD (Kategori Cikgu, Phase, Level, Plan Tarikh, Nota, Collect Video Feedback, 17 checklist).

## Alumni Back to School

Tab **Alumni** dalam portal membaca dan menulis sheet *Alumni Back to School* (`ALUMNI_SHEET_ID` dalam `Legality.gs`), satu tab bagi setiap cawangan. Baris tajuk dikenal pasti dengan **NAMA** di lajur C; lajur B (Bil) dinombor secara automatik bila alumni baru ditambah. Pilihan dropdown (Jenis Sekolah, Cawangan, Negeri, Progress, Reporting) dibaca terus dari data validation dalam sheet.

## PIC Legality

Kad **PIC Legality** di atas Progress dalam halaman sekolah menyimpan nama dan username Telegram PIC Legality sekolah itu, dalam tab **PIC Legality** sheet cawangan (Sekolah | Nama PIC | Username Telegram | Dikemas kini). Satu sekolah boleh ada lebih daripada seorang PIC; simpanan menggantikan senarai PIC sekolah itu.

## Bot semakan Legality (Legality Tds Tengah)

Bot ini menyemak setiap sekolah **TENGAH**. Jika **Planning Legality** atau **Peluang Lain Tahun Depan** masih kosong, ia menghantar satu mesej ke group dan tag PIC Legality setiap sekolah (dari tab *PIC Legality*). Planning dikira terisi bila ada tulisan (bukan teks contoh "*Tulis …") atau gambar; Peluang dikira terisi bila lajur **Peluang** ada isi.

Semakan dibuat oleh Apps Script (tindakan `reminder`, kod admin sahaja). Mesej dihantar oleh fungsi Netlify `backend/program/semak-legality.mjs`, yang memegang token bot.

Persediaan (sekali sahaja), dalam **Netlify → tdslkd → Environment variables**:
- `LEGALITY_BOT_TENGAH`: token bot Legality Tds Tengah (dari @BotFather).
- `LEGALITY_BOT_CHAT` (pilihan): id group; jika tiada, group **Program Tengah** (`-5212609665`) digunakan. `LEGALITY_BOT_THREAD` (pilihan) untuk satu topik.
- Selepas menukarnya, buat **Trigger deploy**.

Guna: **Admin → Legality → Bot semakan Legality** → *Semak sekarang* (pratonton) → *Semak sambungan bot* (pastikan bot dalam group, tiada mesej) → *Hantar ke group*.

Bahagian lain boleh ditambah dalam `BOT_CHECKS` dalam `Legality.gs`.

## Gambar Planning

Bahagian **Planning** boleh muat naik gambar. Fail disimpan dalam Google Drive (folder *Yosh Legality – Gambar* / cawangan / sekolah, id folder dalam Script Property `GAMBAR_FOLDER`) dan dikongsi "sesiapa yang ada pautan boleh lihat" supaya portal dapat memaparkannya. Senarai gambar direkod dalam tab **Gambar** sheet cawangan. Gambar yang dibuang masuk ke Bin Drive (boleh dipulihkan).

## Program Sekolah

Borang `program.html` menghantar program ke Telegram (fungsi Netlify) dan menyimpan salinan ke Google Sheet berasingan **Program Sekolah – Yosh Junior** (dicipta automatik pada simpanan pertama; id dalam Script Property `PROGRAM_SHEET`). Satu baris bagi setiap program; menghantar semula program yang sama (Cuba Lagi) mengemas kini baris itu. Dashboard admin Legality memaparkan semua program (tindakan `programs`, kod admin sahaja).

## Bila kod `Legality.gs` diubah

Dalam editor Apps Script: **Deploy → Manage deployments → Edit (pensel) → Version: New version → Deploy**. Pautan `/exec` kekal sama.

## Nota keselamatan

- Web app berjalan sebagai pemilik sheet. Sesiapa yang ada **pautan API + kod akses** boleh membaca dan mengubah data legality semua cawangan, termasuk nombor telefon cikgu.
- Setiap simpanan hanya menulis sel yang berubah. Jika orang lain telah mengubah bahagian yang sama sejak halaman dibuka, simpanan ditolak dan pengguna diminta muat semula. Data orang lain tidak ditimpa senyap-senyap.
