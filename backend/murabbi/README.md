# Borang Unit Murabbi: setup

The form page (`frontend/borang.html`) and the Unit Murabbi dashboard read and write one Google Sheet through the Apps Script in `Code.gs`. You set this up once, about 10 minutes.

## 1. Create the Sheet and the script

1. Create a new Google Sheet, e.g. **"Yosh Junior · Borang Murabbi"**.
2. In the Sheet: **Extensions → Apps Script**.
3. Delete everything in `Code.gs` there and paste the whole of `backend/murabbi/Code.gs` from this project. Save.
4. In the function list at the top choose **`setup`** and press **Run**. Allow the permissions it asks for (it only uses this Sheet).

The Sheet now has four tabs: **Tetapan**, **Soalan**, **Murabbi**, **Jawapan**.

## 2. Fill in the murabbi list

Open `backend/murabbi/senarai-murabbi.csv` (the murabbi list by cawangan), copy all the rows **except the header** and paste them into the **Murabbi** tab starting at cell A2.

- **Cawangan**: as you want it shown (TENGAH, UTARA, PT, INDONESIA, BORNEO…)
- **Nama**: exactly as it should appear in the form
- **Aktif**: `Ya`, or `Tidak` to hide someone without deleting them

Add new murabbi as new rows at any time.

## 3. Publish the script as a web app

1. In Apps Script: **Deploy → New deployment → type: Web app**.
2. **Execute as:** Me. **Who has access:** Anyone.
3. Press **Deploy** and copy the **Web app URL** (ends in `/exec`).
4. Paste it into `frontend/src/config/config.js` in this project:
   ```js
   window.YOSH_CONFIG = { murabbiApi: "https://script.google.com/macros/s/…/exec" };
   ```

Whenever you change `Code.gs` later, use **Deploy → Manage deployments → Edit → New version** so the same URL keeps working.

## 4. Each month

In the **Tetapan** tab:

| Tetapan | Nilai |
|---|---|
| Bulan dibuka | the report month, e.g. `2026-11` |
| Borang dibuka | `Ya` to accept answers, `Tidak` to close the form |

In the **Soalan** tab, add the rows for that month. The easiest way is to copy last month's rows, change **Bulan**, then edit, add or delete questions.

| Column | What to put |
|---|---|
| Bulan | `YYYY-MM`, the month this question belongs to |
| Kod | short unique code, no spaces (e.g. `kumpul`). **Keep the same code** for the same question across months so they can be compared |
| Soalan | the full question the murabbi sees |
| Label pendek | short name used on the dashboard and slides |
| Jenis | `Ya/Tidak`, `Nombor`, `Pilihan`, `Teks`, `Teks panjang` |
| Pilihan | for `Pilihan` only: the choices, separated by commas |
| Paparan | where it shows on the dashboard (see below) |
| Wajib | `Ya` if it must be answered |

**Paparan** options:

- **Tindakan**: Ya/Tidak questions counted in the *Tindakan* bars
- **Progress**: number questions forming *Progress Pengumpulan*, in row order (the first one is 100%)
- **Jumlah**: numbers totalled under the progress bars (for `Pilihan`, a count per choice)
- **Kekerapan**: average plus how many murabbi gave each answer (like turun sekolah 1×, 2×…)
- **Purata**: average per murabbi, with the total
- **Analisa**: written answers, grouped by theme
- **Butiran**: only shown in each murabbi's full answers

The dashboard follows whatever questions each month has. Old months keep their own questions.

## Notes

- Each murabbi's **latest** submission for a month is used; earlier ones stay in the Jawapan tab but are not counted.
- Answers are saved in the **Jawapan** tab, one column per question code. Don't rename the codes in that header row.
- The published web app and the dashboard can be opened by anyone with the link, so all names and answers are visible to them.
