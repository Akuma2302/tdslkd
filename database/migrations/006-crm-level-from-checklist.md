# 006 · Level CRM dikira dari checklist

**Sheet:** setiap Checklist Legality cawangan · **Tab:** setiap tab sekolah, bahagian CRM (susunan lajur tidak berubah)

Mengikut dokumen *Checklist & Level* TDS Tengah. 17 tick checklist hubungan (N..AD) dibahagikan kepada 5 level
mengikut urutan:

| Level | Maksud | Tick |
|---|---|---|
| L1 | Cikgu kenal kita | 1–2 |
| L2 | Cikgu mula faham objektif kita | 3–5 |
| L3 | Cikgu sokong program dan selesa berinteraksi | 6–10 |
| L4 | Cikgu mula promosi program kita | 11–12 |
| L5 | Cikgu bantu buka peluang baru | 13–17 |

Seseorang di level N bila semua tick L1 hingga LN ditanda. Portal menulis level itu ke lajur **J** (ikut
pilihan dropdown sheet, cth. "L2") setiap kali tick berubah; BLACKLIST ditanda sendiri dan tidak diganti.
Dashboard admin mengira level yang sama terus dari tick, jadi ia betul walaupun lajur J lama belum
dikemas kini.

Dalam borang CRM, **Phase** (I) dan **Plan Tarikh Kelas Tambahan** (K) dibuang. Nilai lama dalam sheet
dibiarkan. Di admin, carta "Phase CRM", penapis phase, kumpulan "Masih P0 / P1" dan "Kelas tambahan 7 hari"
diganti dengan Level.

**Fungsi:** tiada. Lajur J untuk orang yang belum dibuka akan dikemas kini bila pop-up CRM mereka dibuka
dan disimpan.

Peraturan yang sama ada di dua tempat: `CRM_LEVELS` dalam `frontend/src/pages/portal/legality.js` dan
`CRM_LEVEL_COUNTS` dalam `frontend/src/features/legality/legality-admin.js`.
