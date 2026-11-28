# 008 · Tarikh Lahir cikgu (lajur AH)

**Sheet:** setiap Checklist Legality cawangan · **Tab:** setiap tab sekolah dan `Nama Sekolah *Duplicate`, bahagian CRM

Satu lajur baru **dimasukkan** selepas AG (tick checklist terakhir): **AH = Tarikh Lahir** (tarikh, format
d/m/yyyy, rupa dan validation disalin dari lajur K). Lajur jarak dan bahagian "MOM Mingguan" beralih satu lajur ke
kanan (MOM Mingguan kini di AJ).

Dalam pop-up CRM, medan **Tarikh lahir** berada di bahagian Maklumat, selepas Nombor telefon. Ia hanya dipaparkan
bila server menghantar lajur itu (Apps Script v21). Ringkasan admin (`summary11`) membawa tarikh lahir sebagai
medan ke-14 setiap orang.

**Fungsi:** `crmBirthdayAdd` — tab yang sudah ada "Tarikh Lahir" di AH2, atau bukan susunan 20 tick, dilangkau.
Jalankan sebelum deploy v21.
