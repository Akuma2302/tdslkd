# Schema (Google Sheets)

Ganti `schema.sql`: susunan setiap tab yang dibaca dan ditulis oleh `backend/apps-script/legality/Legality.gs`
(dan `backend/apps-script/murabbi/Code.gs`). Nama lajur di bawah ialah tajuk sebenar dalam sheet; tab yang
bertanda *dibuat sendiri* dicipta oleh Apps Script kali pertama ia diperlukan.

Bila susunan berubah: kemas kini fail ini, tambah satu catatan dalam `migrations/`, dan naikkan `SUMMARY_KEY`
dalam `Legality.gs` supaya cache lama tidak dipakai.

---

## Sheet Checklist Legality (satu bagi setiap cawangan)

Cawangan: `TENGAH`, `UTARA`, `PT`, `INDONESIA`, `BORNEO`, `MEA`. ID sheet dalam Script Property `SHEETS`
(TENGAH juga dalam kod).

### `Senarai Sekolah`

| Lajur | Isi |
|---|---|
| A (dari baris 2) | Nama tab sekolah. Hanya nama yang ada tabnya dikira sebagai sekolah. |

### Tab sekolah (satu bagi setiap sekolah, salinan `Nama Sekolah *Duplicate`)

Satu tab mengandungi beberapa bahagian, disusun menegak. Setiap bahagian bermula dengan tajuk dalam lajur A
(dicari ikut teks, bukan nombor baris):

| Bahagian | Tajuk dalam lajur A | Lajur yang disunting |
|---|---|---|
| CRM cikgu | baris 3 hingga sebelum "Alumni Sekolah" | B..AD (lihat di bawah) |
| Alumni | `Alumni Sekolah` | B (sel gabung B:G): senarai "1. Nama (SPM 2020)" |
| Program lepas | `Program Yang Telah Berjalan` | A Nama · B Tarikh · C Niche · D Penglibatan · G Reporting (tick) |
| Analisa | `Analisa Situasi Semasa` | A (sel gabung A:G) |
| Planning | `Planning Legality` | A Perkara (apa tindakan yang nak dibuat) · B Tarikh |
| Modul | `Modul Program Tahun Depan` | A Nama · B Tarikh · C Niche · D Short brief |
| Peluang | `Peluang Lain Tahun Depan` | A Peluang · B Tarikh · C Permanfaatan |

**CRM cikgu** (satu baris bagi setiap cikgu; tajuk KPI dan checklist dibaca dari baris 2):

| Lajur | Isi | Jenis |
|---|---|---|
| B | Entiti (jawatan: Pengetua, PK HEM…) | senarai |
| C | Ada / Tiada (CRM aktif) | tick |
| D | Nama | teks |
| E | Nombor telefon | teks |
| F | Permanfaatan | teks |
| G | PIC CRM | teks |
| H | Kategori cikgu (KPI) | senarai |
| I | Phase — tidak ditanya lagi sejak 006 (nilai lama dibiarkan) | senarai |
| J | Level CRM — **dikira dari checklist** (L1–L5, atau BLACKLIST ditanda sendiri), lihat 006 | senarai |
| K | Plan tarikh kelas tambahan — tidak ditanya lagi sejak 006 | tarikh |
| L | Nota | teks |
| M | Video | teks |
| N..AD | Checklist hubungan (17 tick, tajuk dalam baris 2). Mengikut urutan: L1 = 1–2, L2 = 3–5, L3 = 6–10, L4 = 11–12, L5 = 13–17 | tick |

### `Progress` *(dibuat sendiri)*

| Lajur | Isi |
|---|---|
| A | Sekolah |
| B..G | 6 milestone lama (tick): Set meeting, Pembentangan, Surat kerjasama, Tarikh mentoring, Entrance survey, Exit survey. Tidak dipakai lagi sejak Fasa Legality. |
| H | Dikemas kini |
| I | PROGRESS SEMASA (teks, ditulis PIC) |
| J | Catatan dikemas kini (masa) |
| K | JENIS LEGALITY: A / B / C (admin sahaja) |
| L | STATUS LEGALITY: Legal with B&W / Legal w/o B&W / Tidak Legal (admin sahaja) |

### `Fasa Legality` *(dibuat sendiri)*

Baris 1: nama fasa (gabung merentas tindakannya). Baris 2: tindakan. Data dari baris 3.

| Lajur | Isi |
|---|---|
| A | Sekolah |
| B..AB | 27 tindakan (tick), mengikut `FASA` dalam kod: 10 fasa, Initial contact → Advocate |
| AC | Dikemas kini |

Lajur dibaca ikut **tajuk baris 2**, bukan kedudukan. Fasa sekolah = fasa tertinggi yang semua tindakannya
(dan fasa sebelumnya) ditick.

### `PIC Legality` *(dibuat sendiri)*

`Sekolah` · `Nama PIC` · `Username Telegram` (dengan @) · `Dikemas kini`. Satu baris bagi setiap PIC.

### `Kronologi` *(dibuat sendiri)*

`ID` · `Sekolah` · `Masa` (boleh diubah admin) · `Progress semasa` · `Dicatat` (masa sebenar disimpan).
Simpanan sekolah yang sama dalam 30 minit mengemas kini entri yang sama.

### `Checklist Mingguan` *(dibuat sendiri)*

`Minggu` · `Sekolah` · `Item` · `PIC` · `Screenshot` · `File ID` · `Masa` · `Telegram`. Satu baris bagi setiap
item yang ditanda (dengan screenshot dalam Drive).

### `Gambar` *(dibuat sendiri)*

`Sekolah` · `Bahagian` · `Nama fail` · `File ID` · `Pautan` · `Dimuat naik`.

### `MOM` (sheet TENGAH sahaja) *(dibuat sendiri)*

`Bil` · `ID` · `Tarikh MOM` · `Tindakan` · `Tarikh Due` · `Masa Due` · `Unit` · `PIC` · `Reminder` · `Telegram` ·
`Dikemas kini`.

---

## Sheet Program (Script Property `PROGRAM_SHEET`)

### `Program`

Satu baris bagi setiap program yang dihantar dari borang Hantar program.

| Lajur | Isi |
|---|---|
| A | ID (sama bila dihantar semula) |
| B | Dihantar (masa pertama) |
| C | Cawangan (kod: TENGAH, PT…) |
| D | Sekolah |
| E | Negeri |
| F | Nama program |
| G | Jenis |
| H | Tarikh mula |
| I | Tarikh tamat |
| J | Masa ("08:00 – 12:00") |
| K | Guru bertugas |
| L | Bil. guru |
| M | Pelajar (ikut tingkatan) |
| N | Jumlah pelajar |
| O | Manpower |
| P | Manpower tambahan |
| Q | Sheet program |
| R | Main PIC ("@username (Alumni · Kader Tengah)") |
| S | PIC Legality |
| T | PIC Virality |
| U | Telegram (status hantar) |
| V | Reporting |
| W | Link Canva |
| X | Reporting dikemas kini |
| Y | Follow-up seterusnya |
| Z | Komen reporting |
| AA | Video program |

Program akan datang (Utama) dibaca dari lajur C–J sahaja.

---

## Sheet Alumni Back to School (ID dalam kod)

Satu tab bagi setiap cawangan. Lajur yang disunting: **C..K** (B = Bil, dinomborkan sendiri). Tajuk dan jenis
setiap lajur (teks, senarai, tick) dibaca dari sheet itu sendiri, jadi lajur boleh ditukar dalam sheet tanpa
mengubah kod.

---

## Sheet Murabbi (`backend/apps-script/murabbi/Code.gs`)

| Tab | Isi |
|---|---|
| `Tetapan` | Bulan borang dibuka, dan sama ada ia dibuka |
| `Soalan` | Soalan, satu baris bagi setiap soalan bagi setiap bulan |
| `Murabbi` | Senarai murabbi (cawangan + nama). Data awal: `seeds/senarai-murabbi.csv` |
| `Jawapan` | Setiap jawapan: `Masa` · `Bulan` · `Cawangan` · `Nama` + satu lajur bagi setiap kod soalan (ditambah sendiri) |
