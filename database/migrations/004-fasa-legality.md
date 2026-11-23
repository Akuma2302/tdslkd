# 004 · Tab `Fasa Legality` (10 fasa, 27 tindakan)

**Sheet:** setiap Checklist Legality cawangan · **Tab baru:** `Fasa Legality`

Menggantikan 6 milestone lama dalam tab `Progress` (lajur B..G, kini tidak dipakai). Bermula kosong pada
2026-11-18.

- Baris 1: nama fasa (gabung merentas tindakannya). Baris 2: tindakan. Data dari baris 3.
- A = Sekolah · B..AB = 27 tindakan (tick) · AC = Dikemas kini.
- Senarai fasa dan tindakan: `FASA` dalam `Legality.gs`.

**Perubahan dalam hari yang sama:**

1. *BnW dipecah:* "Persetujuan melalui draf BnW" jadi dua tindakan, **…: Program** dan **…: Mingguan**.
   Tick pada tajuk lama dikira untuk kedua-duanya (`FASA_ALIAS`).
2. *Fasa 6:* "CRM cikgu biasa (Level CRM 1)" dibuang. Fasa 6 kini satu tindakan.

**Fungsi:** tiada untuk dijalankan. Lajur dibaca ikut tajuk baris 2 (`fasaRead`). Bila susunan dalam kod
berubah, `fasaSheetCurrent` membina semula tab pada simpanan seterusnya dan memindahkan tick yang sepadan.
`SUMMARY_KEY` dinaikkan ke `summary9`.
