# 001 · Lajur Reporting dalam tab `Program`

**Sheet:** Program · **Tab:** `Program`

Enam lajur ditambah selepas `Telegram` (U) untuk bot reporting program:

| Lajur | Tajuk |
|---|---|
| V | Reporting |
| W | Link Canva |
| X | Reporting dikemas kini |
| Y | Follow-up seterusnya |
| Z | Komen reporting |
| AA | Video program |

Tajuk ditambah sendiri oleh `ensureReportHeader` bila diperlukan.

**Data lama:** program yang sudah tamat sebelum bot reporting wujud dimulakan reportingnya dengan
`reportBackfillPreview` (log sahaja) kemudian `reportBackfillRun` (satu minit selang setiap program).
