# Borang Checklist Legality: setup & penggunaan

Portal user di `https://tdslkd.netlify.app/` (`frontend/index.html`, tab **Database Legality**) ialah borang untuk ahli cawangan. Dashboard admin di `https://tdslkd.netlify.app/admin` (`frontend/admin.html`). Mereka pilih **cawangan → sekolah**, kemudian lihat dan kemas kini CRM (dengan KPI), Alumni, Program, Analisa, Planning, Modul dan Peluang. Data ditulis terus ke tab sekolah dalam Google Sheet cawangan masing-masing, jadi format sheet kekal sama dan tab CRM / Program dalam sheet terus update sendiri.

Backend: `backend/legality/Legality.gs`, dipasang sebagai projek Apps Script berasingan (akaun pemilik sheet), dan dipublish sebagai **Web app** (Execute as: Me, Who has access: Anyone). Pautan `/exec` diletak dalam `frontend/src/config/config.js` → `legalityApi`.

## Sheet setiap cawangan

| Cawangan | Sheet |
|---|---|
| TENGAH | https://docs.google.com/spreadsheets/d/1xrAVOswvIrRmmrmPaywzdKPEijJXYUiGkQujr9TfFUs |
| UTARA | https://docs.google.com/spreadsheets/d/14mHT2GwPpOlyBV8NYbahXrLOSIKB_InqD3M4dRvyRaE |
| PT | https://docs.google.com/spreadsheets/d/1Q0EKt6vyCbasyeut2EA0JsEPa7veEpWQ8apPEVNXgBg |
| INDONESIA | https://docs.google.com/spreadsheets/d/1l7pW05yDTXCnxwaO6IIFW_eln0wuPglpvCvK-aLA69I |
| BORNEO | https://docs.google.com/spreadsheets/d/1cv-fnk08JV4Eo4AJ0hfTr1aQyyEH0vNkKo2x2QBdLgE |
| MEA | https://docs.google.com/spreadsheets/d/1rl9w-8HA0ZoCpm8PxEcdIx5b3wyo6KiPZd8CXb6WawQ |

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
| Kod Tengah | `KOD_TENGAH` | Halaman `/tengah` | MOM Cawangan Tengah sahaja (`mom`, `saveMomItem`, `deleteMomItem`, `momClaim`, `momRelease`). Admin juga boleh. |

### MOM Tengah (`/tengah`)

- Data dalam tab **MOM** sheet TENGAH: Bil, ID, Tarikh MOM, Tindakan, Tarikh Due, Masa Due, Unit, PIC, Reminder, Telegram, Dikemas kini. Lajur **Telegram** diisi oleh bot (`all`, `info`, dan id reminder seperti `15m`, `2h`, `1d` = apa yang sudah dihantar); jangan ubah dengan tangan.
- **Reminder** bebas: nombor + minit (1–60) / jam (1–24) / hari (1–365) / minggu (1–52) / bulan (1–12, = 30 hari) sebelum due, sehingga 10 reminder setiap item. Disimpan dalam sheet sebagai teks, cth. `15 minit sebelum, 1 hari sebelum`.
- Senarai unit (dan topik Telegram setiap unit), PIC (username Telegram) dan had reminder ada dalam `MOM_UNITS`, `MOM_PICS`, `MOM_REM_UNITS` dalam `Legality.gs`. Tambah PIC baru di `MOM_PICS`, kemudian deploy versi baru.
- Bot **SU Tengah** (group t.me/c/1790355836):
  - setiap item ada butang **Simpan MOM** sendiri (simpan item itu sahaja). Bila item **baru** disimpan, fungsi Netlify `mom-hantar` menghantarnya sekali ke topik unitnya dan ke topik **MOM Keseluruhan**. Item yang diedit tidak dihantar semula;
  - trigger Apps Script `momReminderTick` (setiap minit) meminta fungsi yang sama menghantar reminder (masa yang dipilih sebelum due) ke topik unit, tag PIC. Ia hanya memanggil Netlify bila ada mesej menunggu, dan menggunakan `KOD_TENGAH` daripada Script Properties.
  - Trigger dipasang sekali: Apps Script → **Triggers** → **Add Trigger** → `momReminderTick` → Time-driven → Minutes timer → Every minute.
  - Reminder yang masanya sudah lepas semasa item mula disimpan tidak dihantar (maklumat pertama sudah menunjukkan due). Tukar Tarikh/Masa Due → reminder bermula semula. Tukar unit → tiada mesej baru; reminder seterusnya pergi ke topik unit baru.
- Netlify environment variables: `SU_BOT_TENGAH` (token bot), `SU_BOT_CHAT` (pilihan; lalai -1001790355836). Bot perlu ahli group itu dan boleh menulis dalam topik.

- Kod disimpan untuk **sesi browser semasa sahaja**: bila tab atau browser ditutup dan dibuka semula, pengguna perlu log masuk lagi. Butang **Log keluar** membawa terus ke skrin log masuk.
- Tukar kod: Apps Script → **Project Settings → Script properties** → ubah `KOD_AKSES`, `KOD_ADMIN` atau `KOD_TENGAH` (atau jalankan `setKodAkses()` / `setKodAdmin()` untuk kod rawak). Pengguna akan diminta log masuk semula secara automatik.
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
- `LEGALITY_BOT_CHAT` (pilihan): id group; untuk PICO, jika tiada, group **Mas'ulah & PIC Legality TDS Tengah** (`-1002078197579`) topik 3348 digunakan (`LEGALITY_BOT_THREAD` untuk topik lain).
- Selepas menukarnya, buat **Trigger deploy**.

Guna: **Admin → Legality → Bot semakan Legality** → *Semak sekarang* (pratonton) → *Semak sambungan bot* (pastikan bot dalam group, tiada mesej) → *Hantar ke group*.

Bahagian lain boleh ditambah dalam `BOT_CHECKS` dalam `Legality.gs`.

## Checklist Mingguan + bot PICO

- Halaman sekolah (cawangan dalam `WEEKLY_CAWANGAN`, buat masa ini TENGAH) ada section **Checklist Mingguan** di atas Checklist Progress. Minggu = Isnin–Ahad (waktu Malaysia); kosong semula setiap Isnin.
- Item dalam `WEEKLY_ITEMS` (sekarang: **PM cikgu**). PIC tanda dengan memuat naik **screenshot** sebagai bukti — satu setiap sekolah seminggu. Rekod dalam tab **Checklist Mingguan** sheet cawangan (Minggu, Sekolah, Item, PIC, Screenshot, File ID, Masa, Telegram); gambar dalam folder Drive Gambar.
- Bot **PICO** = bot `LEGALITY_BOT_TENGAH` (token dalam Netlify), group **Mas'ulah & PIC Legality TDS Tengah**, topik t.me/c/2078197579/3348, melalui fungsi Netlify `pico`:
  - screenshot baru dihantar ke group sebaik dimuat naik;
  - **Isnin–Jumaat 8 pagi**: tag PIC sekolah yang belum selesai (tiada mesej jika semua sudah);
  - **Sabtu 8 pagi**: ringkasan minggu itu — selesai / gagal (gagal = belum ditanda sebelum Jumaat 23:59).
- Dijalankan oleh trigger sedia ada `momReminderTick` (setiap minit). Jika trigger terlepas pukul 8, mesej masih dihantar sehingga 12 tengah hari. Script Properties `PICO_DAILY` / `PICO_SUMMARY` mencatat tarikh terakhir dihantar.
- PIC yang ditag datang daripada tab **PIC Legality**; sekolah tanpa PIC ditulis "(PIC belum ditetapkan)".
- **Reminder Progress Semasa** (mesej berasingan, 8 pagi): **setiap Isnin** — reminder mingguan menyenaraikan **semua sekolah** dengan PIC dan tempoh kemas kini terakhir (⚠️ jika 7 hari atau lebih); **setiap hari lain (termasuk Sabtu & Ahad)** — ⚠️ **amaran** untuk sekolah yang tidak dikemas kini **7 hari atau lebih** (`PROGRESS_STALE_DAYS`) atau belum pernah, sehingga ia dikemas kini. Script Property `PICO_PROGRESS` mencatat tarikh terakhir dihantar.
- Admin dan halaman sekolah memaparkan tempoh sejak kemas kini terakhir (cth. "Dikemas kini 1 hari lepas"); 7 hari atau lebih ditanda ⚠️.

## Progress dan Status Legality Semasa

- **Jenis Legality** (A / B / C) dan **Status Legality** (Legal with B&W / Legal w/o B&W / Tidak Legal) **hanya boleh ditukar oleh admin**, melalui dropdown dalam jadual dashboard admin (action `saveLegalityStatus`, kod admin sahaja; tidak mengubah tarikh Progress semasa). Halaman sekolah hanya memaparkannya; PIC mengemas kini catatan **Progress semasa** sahaja.
- Disimpan dalam tab **Progress** sheet cawangan: PROGRESS SEMASA | Catatan dikemas kini | JENIS LEGALITY | STATUS LEGALITY (dua lajur terakhir dibuat automatik, dengan dropdown). Pilihan ada dalam `LEGALITY_JENIS` dan `LEGALITY_STATUS`.
- Dashboard admin **Progress dan Status Legality Sekolah**: Sekolah · Jenis · Status (dropdown, disimpan terus; hijau / kuning / merah) · PIC · Progress semasa.

## Reporting program (bot Program, `TELEGRAM_BOT_TOKEN`)

- Untuk **program baru cawangan Tengah** (`REPORT_CAWANGAN`) yang berjaya dihantar dari borang Program. Lajur tambahan dalam sheet Program: Reporting · Link Canva · Reporting dikemas kini · Follow-up seterusnya · Komen reporting · Video program.
- **2 jam selepas program tamat** → mesej dalam topik Reporting (t.me/c/2078197579/4523), tag Main PIC + PIC Legality (borang program). Soalan 1: *Adakah program berjalan?* [Ya, berjalan] [Tidak berjalan]. *Tidak* → Reporting = **Dibatalkan**, tiada tindakan lanjut. *Ya* → soalan 2: duplicate template Canva, tekan *Siap duplicate*, balas dengan link Canva. Link mesti link Canva (canva.com / canva.link) dan bukan link template; jika tidak, bot tolak dan minta PIC hantar semula.
- Semua mesej (peringatan, follow-up, belum, dihantar, lulus, perlu baiki) tag Main PIC + PIC Legality supaya mereka ambil maklum.
- **Setiap 2 hari, 9 pagi** → "Report sudah siap?" [Sudah siap] [Belum].
- *Sudah siap* → permohonan kelulusan ke group Program Tengah, topik 60 (t.me/c/4404368342/60): [Lulus] [Perlu baiki] (semua ahli boleh tekan). *Lulus* → status Lulus (selesai). *Perlu baiki* → admin balas komen → bot hantar ke topik Reporting, follow-up diteruskan.
- Fungsi Netlify: `report-bot` (dipanggil oleh trigger `momReminderTick` bila ada mesej perlu dihantar) dan `telegram-webhook` (butang & balasan). Apps Script actions: `reportClaim`, `reportRelease`, `reportUpdate`.
- **Persediaan sekali:** (1) Netlify env `KOD_TENGAH` = kod Tengah; (2) masukkan bot Program ke group Program Tengah dan group topik Reporting; (3) pasang webhook: POST `/.netlify/functions/report-bot` dengan `{ "kod": "<kod admin>", "setup": true }`.
- Dashboard admin: lajur **Reporting** (status + pautan Canva + komen) dan **Video program** (belum digunakan).

## Gambar Planning

Bahagian **Planning** boleh muat naik gambar. Fail disimpan dalam Google Drive (folder *Yosh Legality – Gambar* / cawangan / sekolah, id folder dalam Script Property `GAMBAR_FOLDER`) dan dikongsi "sesiapa yang ada pautan boleh lihat" supaya portal dapat memaparkannya. Senarai gambar direkod dalam tab **Gambar** sheet cawangan. Gambar yang dibuang masuk ke Bin Drive (boleh dipulihkan).

## Program Sekolah

Borang `program.html` menghantar program ke Telegram (fungsi Netlify) dan menyimpan salinan ke Google Sheet berasingan **Program Sekolah – Yosh Junior** (dicipta automatik pada simpanan pertama; id dalam Script Property `PROGRAM_SHEET`). Satu baris bagi setiap program; menghantar semula program yang sama (Cuba Lagi) mengemas kini baris itu. Dashboard admin Legality memaparkan semua program (tindakan `programs`, kod admin sahaja).

## Bila kod `Legality.gs` diubah

Dalam editor Apps Script: **Deploy → Manage deployments → Edit (pensel) → Version: New version → Deploy**. Pautan `/exec` kekal sama.

## Nota keselamatan

- Web app berjalan sebagai pemilik sheet. Sesiapa yang ada **pautan API + kod akses** boleh membaca dan mengubah data legality semua cawangan, termasuk nombor telefon cikgu.
- Setiap simpanan hanya menulis sel yang berubah. Jika orang lain telah mengubah bahagian yang sama sejak halaman dibuka, simpanan ditolak dan pengguna diminta muat semula. Data orang lain tidak ditimpa senyap-senyap.
