# Migrations

Ganti fail migration SQL: satu catatan bagi setiap perubahan susunan Google Sheet, dengan fungsi Apps Script yang
menjalankannya (jika ada). Fungsi ini dijalankan sekali dari editor Apps Script (pilih fungsi → **Run**), dan
kebanyakannya ada versi `…Preview` yang hanya menulis log tanpa mengubah sheet.

| # | Tarikh | Perubahan | Fungsi | Status |
|---|---|---|---|---|
| [001](001-report-columns.md) | sebelum 2026-11-15 | Lajur Reporting (V..AA) dalam tab `Program` | `reportBackfillPreview` / `reportBackfillRun` | Dijalankan |
| [002](002-planning-perkara-tarikh.md) | 2026-11 (v6) | Planning jadi dua lajur: Perkara · Tarikh | `migratePlanningPreview` / `migratePlanningRun` | Dijalankan |
| [003](003-kronologi-tab.md) | 2026-11 (v7) | Tab `Kronologi` baru | `kronologiBackfill` | Dijalankan |
| [004](004-fasa-legality.md) | 2026-11-18 (v9–v12) | Tab `Fasa Legality`: 10 fasa / 27 tindakan, ganti 6 milestone | `fasaSheetCurrent` (automatik) | Automatik |
| [005](005-kronologi-merge.md) | 2026-11-23 (v18) | Simpanan Kronologi dalam 30 minit digabungkan | `kronologiTidy` | **Belum dijalankan** |
| [006](006-crm-level-from-checklist.md) | 2026-11-28 | Level CRM dikira dari checklist; Phase dan Plan Tarikh Kelas Tambahan dibuang dari borang | tiada (portal) | Automatik |
| [007](007-crm-checklist-20.md) | 2026-11-28 (v20) | Checklist CRM 17 → 20 tick (N..AD → N..AG), ikut template SEKOLAH_PIC | `crm20Check` / `crm20Migrate` | Dijalankan 2026-11-28 (46 tab) |
| [008](008-crm-tarikh-lahir.md) | 2026-11-28 (v21) | Lajur AH = Tarikh Lahir cikgu dalam CRM | `crmBirthdayAdd` | **Belum dijalankan** |

Tambah perubahan baru di hujung jadual, dengan nombor seterusnya.
