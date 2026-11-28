# 007 · Checklist CRM jadi 20 tick (N..AG)

**Sheet:** setiap Checklist Legality cawangan · **Tab:** setiap tab sekolah dan `Nama Sekolah *Duplicate`, bahagian CRM

Mengikut *25/26 Legality & CRM TDS Tengah – [TEMPLATE] SEKOLAH_PIC*. Checklist hubungan bertukar daripada
17 tick (N..AD) kepada 20 tick (N..AG):

| Level | Maksud | Tick |
|---|---|---|
| L1 | Cikgu kenal kita | 1–4 |
| L2 | Cikgu mula faham objektif yang kita bawakan | 5–7 |
| L3 | Cikgu sokong program & selesa berinteraksi dengan kita | 8–12 |
| L4 | Cikgu mula promosi program kita | 13–16 |
| L5 | Cikgu bantu membuka peluang-peluang baru untuk kita | 17–20 |

Tick lama dibawa ke item baru yang sama maksud (`CRM_NEW` dalam `Legality.gs`, lajur kedua = nombor item lama).
Item baru (wajihah amal, add Facebook, poster, video testimoni, cerita guru lain, galakan guru, PIBG,
jemputan rasmi) bermula kosong. Lima item lama dibuang: dihubungi luar waktu pejabat, angkat call, ziarah
silaturahim, projek kampus, pertemuan bulanan.

**Fungsi:** `crm20Check` (log sahaja: susunan setiap tab, sama ada AE..AG kosong, formula tab lain yang baca
lajur AD) → `crm20Migrate`. Sebelum menulis, tick lama disalin ke tab tersembunyi `_crm17_backup`
(Tab · Baris · 17 tick sebagai "1/0" · masa). Tab yang bukan susunan 17 lama, atau ada isi di AE..AG, dilangkau
dan disenaraikan dalam log.

Portal memaparkan "Cara capai Ln" (tindakan PIC dari template yang sama) di bawah setiap level dalam pop-up CRM
(`CRM_HOW` dalam `frontend/src/pages/portal/legality.js`). Sheet yang belum dipindah masih dikira dengan susunan
17 lama.
