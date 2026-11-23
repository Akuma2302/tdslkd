# 005 · Kronologi: gabung simpanan dalam 30 minit

**Sheet:** setiap Checklist Legality cawangan · **Tab:** `Kronologi` (susunan lajur tidak berubah)

Progress semasa disimpan automatik beberapa saat selepas PIC berhenti menaip, jadi satu kemas kini pernah
menghasilkan beberapa entri (termasuk draf separuh siap). Sejak v18, simpanan sekolah yang sama dalam
30 minit (`KRONOLOGI_MERGE`) mengemas kini entri terakhir sekolah itu: teks dan `Dicatat` dikemas kini, dan
`Masa` juga kecuali admin pernah mengubahnya.

**Data lama:** `kronologiTidy` menggabungkan entri berganda yang sudah ada (sekolah sama, kurang 30 minit
antara satu sama lain) menjadi satu entri dengan teks terakhir, dan memadam baris lebihan.

**Status:** belum dijalankan. Pemilik memilih untuk membiarkan entri lama buat masa ini (2026-11-23).
