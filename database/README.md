# Database

Sistem ini tiada pangkalan data SQL. Semua data disimpan dalam **Google Sheets**, dan dibaca serta ditulis oleh
Apps Script `backend/apps-script/legality/Legality.gs` (API Legality). ID setiap sheet disimpan dalam kod atau dalam
**Script Properties** projek Apps Script, bukan dalam fail ini.

- **`schema.md`**: lajur setiap tab (ganti `schema.sql`).
- **`migrations/`**: catatan setiap perubahan susunan sheet dan fungsi yang menjalankannya.
- **`seeds/`**: data permulaan.

## Sheet dan tab

| Sheet | Tab | Isi | Ditulis oleh |
|---|---|---|---|
| **Checklist Legality** (satu sheet bagi setiap cawangan; ID dalam Script Property `SHEETS`, TENGAH dalam kod) | `Senarai Sekolah` | Senarai tab sekolah yang aktif | Portal: Tambah sekolah |
| | *satu tab bagi setiap sekolah* (salinan `Nama Sekolah *Duplicate*`) | CRM cikgu + KPI, Alumni, Program lepas, Analisa, Planning (Perkara · Tarikh), Modul, Peluang | Portal: halaman sekolah |
| | `Progress` | Sekolah · milestone · Progress semasa · Jenis / Status Legality | Portal (Progress semasa), admin (Jenis / Status) |
| | `Fasa Legality` | Sekolah · 10 fasa / 27 tindakan (tick) | Portal: Fasa |
| | `PIC Legality` | Sekolah · nama · @username Telegram | Portal: PIC |
| | `Kronologi` | ID · Sekolah · Masa · Progress semasa · Dicatat | Setiap simpan Progress semasa; admin ubah Masa |
| | `Checklist Mingguan` | Minggu · Sekolah · Item · PIC · Screenshot · Masa · Telegram | Portal: Mingguan (muat naik screenshot) |
| | `Gambar` | Senarai gambar sekolah (fail dalam Google Drive) | Portal |
| **Program** (Script Property `PROGRAM_SHEET`) | `Program` | Satu baris bagi setiap program: ID, Dihantar, Cawangan, Sekolah, Negeri, Nama program, Jenis, Tarikh mula/tamat, Masa, Guru, Pelajar, Manpower, PIC… + lajur Reporting dan Video | Borang Hantar program, bot reporting, admin |
| **Alumni Back to School** (ID dalam kod) | *satu tab bagi setiap cawangan* | Alumni yang turun ke sekolah | Portal: Alumni |
| **MOM** | `MOM` | Bil · Tarikh MOM · Tindakan · Due · Unit · PIC · Reminder | Halaman Tengah (`/tengah`) |
| **Murabbi** | lihat `backend/apps-script/murabbi/README.md` | Laporan bulanan murabbi | Borang murabbi |

## Cache

Apps Script menyimpan salinan bacaan dalam CacheService supaya halaman laju:

- halaman sekolah dan senarai sekolah: kunci mengikut cawangan + sekolah, dibina semula oleh trigger `warmCache` setiap 10 minit;
- ringkasan admin (`summary9`), Program akan datang (`upcoming`), senarai program admin (`programs`).

Bila susun atur data berubah (lajur atau tab baru), naikkan `SUMMARY_KEY` dalam `Legality.gs` supaya cache lama tidak dipakai.

## seeds/

Data permulaan untuk diimport sekali sahaja:

- `seeds/senarai-murabbi.csv` — senarai murabbi mengikut cawangan (cara import: `backend/apps-script/murabbi/README.md`).
