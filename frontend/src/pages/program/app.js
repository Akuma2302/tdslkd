import { buildTemplate, CAWANGAN as CAWANGAN_INFO } from './template.js';

(function () {
  const $ = (id) => document.getElementById(id);

  // ── Intro overlay ─────────────────────────────
  const intro = $('intro');
  const hero = document.querySelector('.hero');
  let introReady = false;

  // Same rule as the rest of the portal (components/intro.js): the intro plays once per browser
  // session, and the login gate (components/gate.js) appears once it is gone.
  const SEEN = 'yosh:introSeen';
  const seen = (() => { try { return sessionStorage.getItem(SEEN) === '1'; } catch { return false; } })();
  function introGone() {
    try { sessionStorage.setItem(SEEN, '1'); } catch {}
    window.dispatchEvent(new Event('yosh:introclosed'));
  }
  const introEnter = $('introEnter');
  if (!seen) {
    setTimeout(() => intro.classList.add('on'), 300);
    setTimeout(() => intro.classList.add('sub'), 1600);
    setTimeout(() => {
      intro.classList.add('ready');
      introReady = true;
      // Focus the button so keyboard users can press Enter — only the button continues
      introEnter.tabIndex = 0;
      introEnter.focus({ preventScroll: true });
    }, 2400);
  }

  function dismissIntro() {
    if (!introReady) return;
    introReady = false;
    intro.classList.add('out');
    // The yellow curtain fully covers the screen at ~48% of its 1.15s sweep:
    // start the hero reveal then, so the title is animating as the curtain lifts.
    setTimeout(revealHero, 550);
    setTimeout(() => { intro.remove(); introGone(); }, 1200);
  }
  // Only the "Masuk" button continues; taps elsewhere on the intro do nothing.
  // (A native <button> also handles Enter/Space when focused.)
  introEnter.addEventListener('click', dismissIntro);

  // ── Cawangan branding ─────────────────────────
  // Picked from ?cawangan=..., else the last branch used on this device, else Tengah.
  const CAWANGAN = Object.keys(CAWANGAN_INFO);
  const STORAGE_KEY = 'tds-cawangan';
  const matchCawangan = (v) => CAWANGAN.find((c) => c.toLowerCase() === String(v || '').trim().toLowerCase());

  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
  const fromUrl = matchCawangan(new URLSearchParams(location.search).get('cawangan'));
  const initialBrand = fromUrl || matchCawangan(saved);
  let brand = initialBrand || 'Tengah';

  // ── Hero title ────────────────────────────────
  // Splits text into per-character spans (kept together per word) so each
  // letter can animate in. Returns the index after the last character.
  function buildLine(line, text, start) {
    line.textContent = '';
    let i = start;
    text.split(' ').forEach((word, w) => {
      if (w > 0) line.appendChild(document.createTextNode(' '));
      const wordEl = document.createElement('span');
      wordEl.className = 'word';
      for (const ch of word) {
        const span = document.createElement('span');
        span.className = 'char';
        span.textContent = ch;
        span.style.animationDelay = (i++ * 35) + 'ms';
        wordEl.appendChild(span);
      }
      line.appendChild(wordEl);
    });
    return i;
  }

  let charCount = 0;
  document.querySelectorAll('.hero-title .line').forEach((line) => {
    charCount = buildLine(line, line.dataset.text, charCount);
  });

  // The hero title and page title stay "Program Sekolah Sedunia";
  // only the smaller [data-brand] labels follow the selected cawangan.
  function applyBrand(name) {
    brand = name;
    document.querySelectorAll('[data-brand]').forEach((el) => { el.textContent = name; });
  }

  function rememberBrand(name) {
    try { localStorage.setItem(STORAGE_KEY, name); } catch {}
  }
  if (fromUrl) rememberBrand(fromUrl);
  applyBrand(brand);

  function revealHero() {
    hero.classList.add('go');
    const total = charCount * 35 + 700;
    setTimeout(() => hero.classList.add('done'), total - 200);
    setTimeout(() => document.body.classList.remove('locked'), total);
  }
  if (seen) { intro.remove(); revealHero(); introGone(); }

  // ── Cursor glow (whole page) + hero card tilt — mouse devices only ──
  const canHover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (canHover && !reduceMotion) {
    const glow = document.querySelector('.cursor-glow');
    const card = hero.querySelector('.hero-card');
    let frame = 0;
    let last = null;

    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      last = e;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        glow.style.setProperty('--cx', `${last.clientX}px`);
        glow.style.setProperty('--cy', `${last.clientY}px`);
        glow.classList.add('on');

        // Tilt the preview card only while the mouse is over the hero
        if (!card) return;
        const r = hero.getBoundingClientRect();
        const inHero = last.clientY >= r.top && last.clientY <= r.bottom;
        if (inHero) {
          const c = card.getBoundingClientRect();
          card.style.setProperty('--ry', `${(((last.clientX - (c.left + c.width / 2)) / r.width) * 14).toFixed(2)}deg`);
          card.style.setProperty('--rx', `${((-(last.clientY - (c.top + c.height / 2)) / r.height) * 10).toFixed(2)}deg`);
        } else {
          card.style.setProperty('--rx', '0deg');
          card.style.setProperty('--ry', '0deg');
        }
      });
    });
    // Hide the glow when the mouse leaves the window
    document.documentElement.addEventListener('mouseleave', () => glow.classList.remove('on'));
  }

  // ── Floating particles ────────────────────────
  const particles = $('particles');
  for (let i = 0; i < 24; i++) {
    const p = document.createElement('i');
    p.style.left = Math.random() * 100 + '%';
    p.style.animationDuration = 8 + Math.random() * 10 + 's';
    p.style.animationDelay = -Math.random() * 15 + 's';
    const size = 1 + Math.random() * 3;
    p.style.width = p.style.height = size + 'px';
    particles.appendChild(p);
  }

  $('footerYear').textContent = new Date().getFullYear();

  // ── PIC: copy @username ───────────────────────
  const copyToast = $('copyToast');
  let toastTimer;
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
  }
  document.querySelectorAll('.copy-handle').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await copyText(btn.dataset.handle);
      btn.classList.add('copied');
      copyToast.textContent = `${btn.dataset.handle} disalin`;
      copyToast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        copyToast.classList.remove('show');
        btn.classList.remove('copied');
      }, 1800);
    });
  });

  // ── PIC unit tabs ─────────────────────────────
  const unitTabs = [...document.querySelectorAll('.unit-tab')];
  function selectUnit(tab, focus) {
    unitTabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      const panel = $(t.getAttribute('aria-controls'));
      panel.hidden = !on;
      if (on) {
        // Replay a quick fade each time a unit is shown
        panel.classList.add('in-view');
        panel.classList.remove('unit-swap');
        void panel.offsetWidth;
        panel.classList.add('unit-swap');
      }
    });
    if (focus) tab.focus();
  }
  unitTabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectUnit(tab, false));
    tab.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      let next = null;
      if (step) next = unitTabs[(i + step + unitTabs.length) % unitTabs.length];
      if (e.key === 'Home') next = unitTabs[0];
      if (e.key === 'End') next = unitTabs[unitTabs.length - 1];
      if (!next) return;
      e.preventDefault();
      selectUnit(next, true);
    });
  });

  // ── Form behaviour ────────────────────────────
  const form = $('programForm');
  const tambahanField = $('tambahanJumlahField');
  const sheet = $('sheet');
  const sheetOpen = $('sheetOpen');

  form.querySelectorAll('input[name="tambahan"]').forEach((r) =>
    r.addEventListener('change', () => { tambahanField.hidden = r.value !== 'Ya' || !r.checked; })
  );

  sheet.addEventListener('input', () => {
    const url = sheet.value.trim();
    const ok = /^https?:\/\//i.test(url);
    sheetOpen.hidden = !ok;
    if (ok) sheetOpen.href = url;
  });

  // ── Guru bertugas (dynamic rows) ──────────────
  const guruList = $('guruList');
  const guruTpl = $('guruRowTpl');

  function renumberGuru() {
    const rows = guruList.querySelectorAll('.guru-row');
    rows.forEach((row, i) => {
      row.querySelector('.guru-num').textContent = i + 1;
      row.querySelector('.guru-remove').disabled = rows.length === 1;
    });
  }

  function addGuru(focus) {
    const row = guruTpl.content.firstElementChild.cloneNode(true);
    row.querySelector('.guru-remove').addEventListener('click', () => {
      row.remove();
      renumberGuru();
    });
    guruList.appendChild(row);
    renumberGuru();
    if (focus) row.querySelector('.guru-nama').focus();
  }

  $('guruAdd').addEventListener('click', () => addGuru(true));
  addGuru(false);

  function getGuru() {
    return [...guruList.querySelectorAll('.guru-row')].map((row) => ({
      nama: row.querySelector('.guru-nama').value.trim(),
      jawatan: row.querySelector('.guru-jawatan').value.trim(),
    }));
  }

  // Tarikh tamat can't be earlier than tarikh mula; default it to the start date
  const tarikhMula = $('tarikhMula');
  const tarikhTamat = $('tarikhTamat');
  tarikhMula.addEventListener('change', () => {
    tarikhTamat.min = tarikhMula.value;
    if (!tarikhTamat.value || tarikhTamat.value < tarikhMula.value) tarikhTamat.value = tarikhMula.value;
    tarikhTamat.classList.remove('error');
    $('tarikhError').classList.remove('show');
  });
  tarikhTamat.addEventListener('change', () => $('tarikhError').classList.remove('show'));
  ['masaMula', 'masaTamat'].forEach((id) =>
    $(id).addEventListener('change', () => { $('masaError').classList.remove('show'); $('masaTamat').classList.remove('error'); })
  );

  // ── Tile pickers (cawangan, jenis) ────────────
  // Each .tiles[data-for=X] writes its choice into the hidden input #X and
  // fires 'change' on it, so the rest of the code treats it like a select.
  function setTile(id, value, fire) {
    const input = $(id);
    input.value = value || '';
    document.querySelectorAll(`.tiles[data-for="${id}"] .tile`).forEach((t) => {
      t.setAttribute('aria-checked', String(t.dataset.value === value));
    });
    if (fire) input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  document.querySelectorAll('.tiles').forEach((group) => {
    const tiles = [...group.querySelectorAll('.tile')];
    tiles.forEach((tile, i) => {
      tile.addEventListener('click', () => {
        group.classList.remove('error');
        setTile(group.dataset.for, tile.dataset.value, true);
      });
      // Arrow keys move between tiles, like a native radio group
      tile.addEventListener('keydown', (e) => {
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        const next = tiles[(i + step + tiles.length) % tiles.length];
        next.focus();
        next.click();
      });
    });
  });

  // Branding follows the selected cawangan
  const cawanganInput = $('cawangan');
  if (initialBrand) setTile('cawangan', initialBrand, false);
  cawanganInput.addEventListener('change', () => {
    if (!cawanganInput.value) return;
    applyBrand(cawanganInput.value);
    rememberBrand(cawanganInput.value);
  });

  // ── Nama Sekolah: schools from the Legality database ──
  // Lists the schools of the chosen cawangan (Checklist Legality sheet, via the Legality API).
  // Typing filters the list; a school that is not listed can still be typed in full.
  const LEGALITY_CODE = { 'Tengah': 'TENGAH', 'Utara': 'UTARA', 'Pantai Timur': 'PT', 'Borneo': 'BORNEO', 'Indonesia': 'INDONESIA', 'MEA': 'MEA' };
  const sekolahInput = $('sekolah');
  const sekolahList = $('sekolahList');
  const sekolahHint = $('sekolahHint');
  const schoolCache = {};
  let schools = [];
  let shown = [];
  let active = -1;

  function loadSchools() {
    const cw = cawanganInput.value;
    const code = LEGALITY_CODE[cw];
    const Api = window.LegalityApi;
    schools = [];
    if (!code || !Api || !Api.configured) {
      sekolahHint.textContent = code ? 'Senarai sekolah tidak tersedia. Taip nama sekolah.' : 'Pilih cawangan dahulu untuk melihat senarai sekolah.';
      return;
    }
    if (schoolCache[code]) { showHint(cw); return; }
    sekolahHint.textContent = 'Memuatkan sekolah ' + cw + '…';
    Api.get({ action: 'schools', cawangan: code })
      .then((d) => {
        schoolCache[code] = (d.schools || []).map((x) => x.name).filter(Boolean).sort((x, y) => x.localeCompare(y));
        if (cawanganInput.value === cw) showHint(cw);
      })
      .catch(() => { if (cawanganInput.value === cw) sekolahHint.textContent = 'Senarai sekolah tidak dapat dimuatkan. Taip nama sekolah.'; });
  }
  function showHint(cw) {
    schools = schoolCache[LEGALITY_CODE[cw]] || [];
    sekolahHint.textContent = schools.length
      ? schools.length + ' sekolah dalam database Legality ' + cw + '. Tiada dalam senarai? Taip nama penuh sekolah.'
      : 'Belum ada sekolah ' + cw + ' dalam database Legality. Taip nama sekolah.';
    if (document.activeElement === sekolahInput) openList();
  }

  function openList() {
    const q = sekolahInput.value.trim().toLowerCase();
    shown = schools.filter((n) => !q || n.toLowerCase().includes(q));
    sekolahList.textContent = '';
    active = -1;
    if (!schools.length) { closeList(); return; }
    shown.forEach((name, i) => {
      const li = document.createElement('li');
      li.id = 'sekolahOpt' + i;
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', String(name === sekolahInput.value.trim()));
      li.textContent = name;
      // mousedown, so it runs before the input loses focus
      li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(name); });
      sekolahList.appendChild(li);
    });
    if (!shown.length) {
      const li = document.createElement('li');
      li.className = 'combo-empty';
      li.textContent = 'Tiada padanan — nama yang ditaip akan digunakan.';
      sekolahList.appendChild(li);
    }
    sekolahList.hidden = false;
    sekolahInput.setAttribute('aria-expanded', 'true');
  }
  function closeList() {
    sekolahList.hidden = true;
    sekolahInput.setAttribute('aria-expanded', 'false');
    sekolahInput.removeAttribute('aria-activedescendant');
    active = -1;
  }
  function pick(name) {
    sekolahInput.value = name;
    sekolahInput.classList.remove('error');
    picking = true;
    sekolahInput.dispatchEvent(new Event('input', { bubbles: true }));
    picking = false;
    closeList();
  }
  let picking = false;
  function move(step) {
    if (sekolahList.hidden) openList();
    if (!shown.length) return;
    active = (active + step + shown.length) % shown.length;
    [...sekolahList.children].forEach((li, i) => li.classList.toggle('is-active', i === active));
    const li = sekolahList.children[active];
    sekolahInput.setAttribute('aria-activedescendant', li.id);
    li.scrollIntoView({ block: 'nearest' });
  }

  sekolahInput.addEventListener('focus', openList);
  sekolahInput.addEventListener('click', openList);
  sekolahInput.addEventListener('input', () => { if (!picking && document.activeElement === sekolahInput) openList(); });
  sekolahInput.addEventListener('blur', () => setTimeout(closeList, 120));
  sekolahInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter' && !sekolahList.hidden && active > -1) { e.preventDefault(); pick(shown[active]); }
    else if (e.key === 'Escape' && !sekolahList.hidden) { e.preventDefault(); e.stopPropagation(); closeList(); }
  });
  cawanganInput.addEventListener('change', () => {
    // A school picked from another cawangan's list no longer fits.
    if (Object.values(schoolCache).some((list) => list.includes(sekolahInput.value.trim()))) sekolahInput.value = '';
    loadSchools();
  });
  if (window.YoshGate) window.YoshGate.ready(loadSchools); else loadSchools();

  // ── − / + steppers ────────────────────────────
  // Delegated so rows added later (per-tingkatan counts) work too.
  // A button targets data-target's id, or else the input in its own .stepper.
  form.addEventListener('click', (e) => {
    const btn = e.target.closest('.step-btn');
    if (!btn) return;
    const input = btn.dataset.target ? $(btn.dataset.target) : btn.closest('.stepper').querySelector('input');
    const min = Number(input.min || 0);
    const next = Math.max(min, (Number(input.value) || 0) + Number(btn.dataset.delta));
    input.value = next;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // ── Tingkatan: select all + count ─────────────
  const levelBoxes = [...form.querySelectorAll('input[name="pelajar"]')];
  const pelajarAll = $('pelajarAll');
  const pelajarCount = $('pelajarCount');
  const levelCounts = $('levelCounts');
  const levelCountList = $('levelCountList');
  const levelCountTpl = $('levelCountTpl');
  const levelMemory = {}; // keeps a count if a level is unticked then ticked again

  function countRow(level) {
    return levelCountList.querySelector(`.level-count-row[data-level="${level}"]`);
  }

  function updateLevels() {
    const selected = levelBoxes.filter((c) => c.checked).map((c) => c.value);
    const n = selected.length;
    pelajarCount.textContent = n ? `${n} dipilih` : 'boleh pilih lebih dari satu';
    pelajarAll.textContent = n === levelBoxes.length ? 'Nyahpilih semua' : 'Pilih semua';

    // Remove rows for unticked levels (remembering their value)
    levelCountList.querySelectorAll('.level-count-row').forEach((row) => {
      if (!selected.includes(row.dataset.level)) {
        levelMemory[row.dataset.level] = row.querySelector('input').value;
        row.remove();
      }
    });
    // Add rows for newly ticked levels, kept in T1→T5 order
    selected.forEach((level) => {
      if (countRow(level)) return;
      const row = levelCountTpl.content.firstElementChild.cloneNode(true);
      const input = row.querySelector('input');
      row.dataset.level = level;
      input.id = `bil-${level}`;
      input.value = levelMemory[level] || '';
      const name = row.querySelector('.level-count-name');
      name.htmlFor = input.id;
      name.textContent = `Tingkatan ${level.slice(1)}`;
      const after = [...levelCountList.children].find((r) => r.dataset.level > level);
      levelCountList.insertBefore(row, after || null);
    });
    levelCounts.hidden = n === 0;
    updateLevelTotal();
  }

  function getBilangan() {
    const out = {};
    levelCountList.querySelectorAll('.level-count-row').forEach((row) => {
      out[row.dataset.level] = row.querySelector('input').value.trim();
    });
    return out;
  }

  function updateLevelTotal() {
    const total = Object.values(getBilangan()).reduce((sum, v) => sum + (Number(v) || 0), 0);
    $('levelTotal').textContent = total;
  }
  levelCountList.addEventListener('input', updateLevelTotal);
  pelajarAll.addEventListener('click', () => {
    const all = levelBoxes.every((c) => c.checked);
    levelBoxes.forEach((c) => { c.checked = !all; });
    levelBoxes[0].dispatchEvent(new Event('change', { bubbles: true }));
  });
  levelBoxes.forEach((c) => c.addEventListener('change', updateLevels));

  // ── Duration chip ─────────────────────────────
  const durationEl = $('duration');
  function updateDuration() {
    const m = tarikhMula.value, t = tarikhTamat.value, a = $('masaMula').value, b = $('masaTamat').value;
    if (!isValidDate(m) || !isValidDate(t) || t < m) { durationEl.hidden = true; return; }
    const days = Math.round((new Date(t + 'T00:00:00') - new Date(m + 'T00:00:00')) / 86400000) + 1;
    let text = `${days} hari`;
    if (a && b && days === 1 && b > a) {
      const mins = (Number(b.slice(0, 2)) * 60 + Number(b.slice(3))) - (Number(a.slice(0, 2)) * 60 + Number(a.slice(3)));
      const h = Math.floor(mins / 60), mm = mins % 60;
      text += ` · ${h ? h + ' jam' : ''}${h && mm ? ' ' : ''}${mm ? mm + ' minit' : ''}`;
    } else if (a && b) {
      text += ` · ${a} – ${b}`;
    }
    durationEl.textContent = text;
    durationEl.hidden = false;
  }
  ['tarikhMula', 'tarikhTamat', 'masaMula', 'masaTamat'].forEach((id) => $(id).addEventListener('change', updateDuration));

  // ── Progress: which of the 5 steps are filled in ──
  const filled = (id) => $(id).value.trim() !== '';
  const STEP_CHECKS = {
    1: () => filled('cawangan') && hasText($('sekolah').value) && hasText($('namaProgram').value) && filled('jenis'),
    2: () => isValidDate(tarikhMula.value) && isValidDate(tarikhTamat.value) && filled('masaMula') && filled('masaTamat'),
    3: () => getGuru().every((g) => hasText(g.nama) && hasText(g.jawatan)) &&
      !!form.querySelector('input[name="pelajar"]:checked') &&
      Object.values(getBilangan()).every((v) => Number(v) >= 1),
    4: () => {
      const t = form.querySelector('input[name="tambahan"]:checked');
      return filled('manpower') && !!t && (t.value !== 'Ya' || filled('tambahanJumlah'));
    },
    5: () => ['mainPic', 'legality', 'virality'].every((id) => hasText($(id).value)) &&
      ['mainPicAlumni', 'legalityAlumni', 'viralityAlumni'].every((n) => !!form.querySelector(`input[name="${n}"]:checked`)),
  };
  function updateProgress() {
    let done = 0;
    form.querySelectorAll('.form-step').forEach((stepEl) => {
      const ok = STEP_CHECKS[stepEl.dataset.step]();
      stepEl.classList.toggle('complete', ok);
      if (ok) done++;
    });
    $('progressCount').textContent = `${done}/5`;
    $('progressFill').style.width = `${done * 20}%`;
    form.classList.toggle('all-done', done === 5);
  }
  ['input', 'change', 'click'].forEach((ev) => form.addEventListener(ev, () => setTimeout(updateProgress)));

  // Strip a leading @ if the user types one
  ['mainPic', 'legality', 'virality'].forEach((id) =>
    $(id).addEventListener('input', (e) => { e.target.value = e.target.value.replace(/^@+/, ''); })
  );

  // Clear error styling as fields are corrected
  form.addEventListener('input', (e) => e.target.closest('.error, .field')?.classList.remove('error'));
  form.addEventListener('change', (e) => {
    if (e.target.value) e.target.classList.remove('error');
    e.target.closest('.seg')?.classList.remove('error');
    e.target.closest('fieldset')?.classList.remove('error');
  });
  // ── Ketetapan: progress + completion banner ───
  const amanahBoxes = [...document.querySelectorAll('.amanah')];
  function updateAmanah() {
    const n = amanahBoxes.filter((c) => c.checked).length;
    $('amanahCount').textContent = `${n}/${amanahBoxes.length}`;
    $('amanahFill').style.width = `${(n / amanahBoxes.length) * 100}%`;
    const done = n === amanahBoxes.length;
    $('amanahDone').hidden = !done;
    $('ketetapan').classList.toggle('all-done', done);
    if (n) $('amanahError').classList.remove('show');
  }
  amanahBoxes.forEach((c) => c.addEventListener('change', updateAmanah));
  updateAmanah(); // browsers may restore ticks on reload

  const hasText = (v) => /[\p{L}\p{N}]/u.test(v);
  const isValidDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= '2024-01-01' && v <= '2099-12-31' && !isNaN(new Date(v + 'T00:00:00'));

  // Server field keys → labels shown to the user
  const FIELD_LABEL = {
    cawangan: 'Cawangan', sekolah: 'Nama Sekolah', namaProgram: 'Nama Program', jenis: 'Jenis Program', tarikh: 'Tarikh Program',
    masa: 'Masa', guru: 'Guru Bertugas', pelajar: 'Pelajar Terlibat', manpower: 'Jumlah Manpower',
    tambahan: 'Manpower Tambahan', tambahanJumlah: 'Jumlah Manpower Tambahan', sheet: 'Sheet Program',
    pic: 'PIC Program', mainPicAlumni: 'Status Alumni Main PIC', legalityAlumni: 'Status Alumni PIC Legality', viralityAlumni: 'Status Alumni PIC Virality', amanah: 'Ketetapan Virality',
  };

  function validate() {
    const bad = [];
    const flag = (el) => { el.classList.add('error'); bad.push(el); };

    ['cawangan', 'sekolah', 'namaProgram', 'jenis', 'tarikhMula', 'tarikhTamat', 'masaMula', 'masaTamat', 'manpower', 'mainPic', 'legality', 'virality']
      .forEach((id) => {
        const el = $(id);
        if (el.value.trim()) return;
        if (el.type === 'hidden') flag(document.querySelector(`.tiles[data-for="${id}"]`));
        else flag(id === 'mainPic' || id === 'legality' || id === 'virality' ? el.parentElement : el);
      });

    // Text must contain a letter or digit — "-" or "." alone isn't an answer
    ['sekolah', 'namaProgram', 'mainPic', 'legality', 'virality'].forEach((id) => {
      const el = $(id);
      if (el.value.trim() && !hasText(el.value)) flag(id === 'sekolah' || id === 'namaProgram' ? el : el.parentElement);
    });

    // Browsers accept 5–6 digit years in date inputs; keep it to a sane range
    const mula = $('tarikhMula').value, tamat = $('tarikhTamat').value;
    const tarikhError = $('tarikhError');
    const badDate = [mula, tamat].some((d) => d && !isValidDate(d));
    if (badDate) {
      [$('tarikhMula'), $('tarikhTamat')].forEach((el) => { if (el.value && !isValidDate(el.value)) flag(el); });
      tarikhError.textContent = 'Tarikh tidak sah. Sila semak tahun (contoh: 2026).';
      tarikhError.classList.add('show');
    } else if (mula && tamat && tamat < mula) {
      flag($('tarikhTamat'));
      tarikhError.textContent = 'Tarikh tamat tidak boleh sebelum tarikh mula.';
      tarikhError.classList.add('show');
    }

    // Same-day programme: end time must be after start time
    const masaMula = $('masaMula').value, masaTamat = $('masaTamat').value;
    if (masaMula && masaTamat && mula && mula === tamat && masaTamat <= masaMula) {
      flag($('masaTamat'));
      $('masaError').classList.add('show');
    }

    guruList.querySelectorAll('.guru-nama, .guru-jawatan').forEach((el) => {
      if (!hasText(el.value)) flag(el);
    });

    if (!form.querySelector('input[name="pelajar"]:checked')) flag($('pelajarGroup'));
    levelCountList.querySelectorAll('.level-count').forEach((el) => {
      if (!/^\d+$/.test(el.value.trim()) || Number(el.value) < 1) flag(el.closest('.stepper'));
    });
    const tambahan = form.querySelector('input[name="tambahan"]:checked');
    if (!tambahan) flag($('tambahanGroup'));
    else if (tambahan.value === 'Ya' && !$('tambahanJumlah').value) flag($('tambahanJumlah'));

    // Alumni status is required for each of the three PICs
    ['mainPicAlumni', 'legalityAlumni', 'viralityAlumni'].forEach((n) => {
      if (!form.querySelector(`input[name="${n}"]:checked`)) flag($(`${n}Group`));
    });

    const amanahOk = [...document.querySelectorAll('.amanah')].every((c) => c.checked);
    if (!amanahOk) {
      $('amanahError').classList.add('show');
      bad.unshift($('ketetapan'));
    }
    return bad;
  }

  updateProgress();

  function collectData() {
    const checked = (name) => [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((c) => c.value);
    return {
      cawangan: $('cawangan').value,
      sekolah: $('sekolah').value.trim(),
      namaProgram: $('namaProgram').value.trim(),
      jenis: $('jenis').value,
      tarikhMula: $('tarikhMula').value,
      tarikhTamat: $('tarikhTamat').value,
      masaMula: $('masaMula').value,
      masaTamat: $('masaTamat').value,
      guru: getGuru(),
      pelajar: checked('pelajar'),
      pelajarBilangan: getBilangan(),
      manpower: $('manpower').value,
      tambahan: checked('tambahan')[0] || '',
      tambahanJumlah: $('tambahanJumlah').value,
      sheet: $('sheet').value.trim(),
      mainPic: $('mainPic').value.trim(),
      mainPicAlumni: checked('mainPicAlumni')[0] || '',
      legalityAlumni: checked('legalityAlumni')[0] || '',
      viralityAlumni: checked('viralityAlumni')[0] || '',
      legality: $('legality').value.trim(),
      virality: $('virality').value.trim(),
      amanah: [...document.querySelectorAll('.amanah')].every((c) => c.checked),
      website: $('website').value, // honeypot
    };
  }

  // ── Submit → preview modal → send via bot ─────
  const modal = $('modal');
  const sendBtn = $('sendBtn');
  const copyBtn = $('copyBtn');
  const sendStatus = $('sendStatus');
  const joinBox = $('joinBox');
  const formError = $('formError');
  let templateText = '';
  let pending = null;
  let sent = false;

  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
  }

  // Keeps a copy of every programme in the Program Sekolah Google Sheet (through the Legality
  // Apps Script), so admin can track them. Resolves to '' when saved, or the reason it was not.
  async function saveToSheet(telegram) {
    const Api = window.LegalityApi;
    if (!Api || !Api.configured) return 'database belum disambungkan';
    try {
      await Api.post({ action: 'saveProgram', id: pending.id, program: pending, telegram });
      return '';
    } catch (e) {
      if (e && e.kod && window.YoshGate) window.YoshGate.show('Kod akses telah ditukar. Masukkan kod baru.');
      return (e && e.message) || String(e);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.querySelectorAll('.error').forEach((el) => el.classList.remove('error'));
    const bad = validate();
    if (bad.length) {
      formError.textContent = '⚠️ Sila lengkapkan borang program sebelum jana template!';
      formError.classList.add('show');
      const top = bad[0].getBoundingClientRect().top + window.scrollY - 80;
      window.scrollTo({ top, behavior: 'smooth' });
      return;
    }
    formError.classList.remove('show');
    pending = collectData();
    pending.id = newId();          // the same programme keeps this id if it is sent again (Cuba Lagi)
    templateText = buildTemplate(pending);
    sent = false;
    $('templateBox').textContent = templateText;
    $('modalCawangan').textContent = pending.cawangan;
    sendBtn.hidden = false;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Hantar ke Telegram';
    sendStatus.className = 'send-status';
    sendStatus.textContent = '';
    joinBox.hidden = true;
    copyBtn.textContent = 'Copy';
    copyBtn.classList.remove('copied');
    modal.hidden = false;
    sendBtn.focus();
  });

  sendBtn.addEventListener('click', async () => {
    if (!pending || sent) return;
    sendBtn.disabled = true;
    sendBtn.textContent = 'Menghantar…';
    sendStatus.className = 'send-status';
    sendStatus.textContent = '';

    let body = null;
    try {
      const res = await fetch('/.netlify/functions/hantar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending),
      });
      body = await res.json().catch(() => null);
    } catch {}

    const results = body?.results || [];
    const lines = results.map((r) => `${r.ok ? '✓' : '✕'} ${r.name}${r.ok ? '' : ' — ' + r.error}`);

    const telegram = body?.ok ? (body.dryRun ? 'Ujian (tiada mesej dihantar)' : 'Berjaya')
      : 'Gagal: ' + ((body?.error && !results.length ? body.error : results.filter((r) => !r.ok).map((r) => r.name + ' — ' + r.error).join('; ')) || 'tiada sambungan');
    sendBtn.textContent = 'Merekod…';
    const saveError = await saveToSheet(telegram);
    lines.push(saveError ? `✕ Database program — ${saveError}` : '✓ Direkod dalam database program');

    if (body?.ok) {
      sent = true;
      sendBtn.hidden = true;
      sendStatus.className = 'send-status ok';
      sendStatus.textContent = (body.dryRun ? '(Ujian — tiada mesej sebenar dihantar)\n' : '✅ Berjaya dihantar!\n') + lines.join('\n');
      const link = CAWANGAN_INFO[pending.cawangan]?.joinLink;
      if (link) {
        $('joinLink').href = link;
        $('joinName').textContent = CAWANGAN_INFO[pending.cawangan].joinLabel || `Cawangan ${pending.cawangan}`;
        joinBox.hidden = false;
      }
    } else {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Cuba Lagi';
      sendStatus.className = 'send-status fail';
      const fields = (body?.fields || []).map((f) => '• ' + (FIELD_LABEL[f] || f));
      sendStatus.textContent = '⚠️ ' + (body?.error && !results.length ? body.error : 'Gagal dihantar sepenuhnya.') +
        (fields.length ? '. Sila semak:\n' + fields.join('\n') : '') +
        (lines.length ? '\n' + lines.join('\n') : '') +
        '\nAnda boleh Copy template dan hantar secara manual.';
    }
  });

  const closeModal = () => { modal.hidden = true; };
  $('modalClose').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) closeModal(); });

  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(templateText);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = templateText;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copyBtn.textContent = '✓ Copied!';
    copyBtn.classList.add('copied');
  });

  // ── Scroll animations ─────────────────────────
  // Elements are only hidden once JS marks them, so content stays visible if this fails.
  // Items that share a container get a staggered delay (--d), counted per container
  // so something far down the page never waits on items above it.
  const REVEAL = [
    '.section-title', '.section-lead', '.amanah-bar',
    '.units > .unit',
    '.phase-label', '.amanah-card', '.phase-divider',
    '.cta-band', '.form-step',
    '.footer-brand', '.footer-col', '.footer-mark', '.footer-bottom',
  ].join(',');
  const STAGGER_BY = '.units, .timeline, .footer-grid, .footer-inner, form, section, main';
  const revealTargets = [];
  const staggerCount = new Map();
  document.querySelectorAll(REVEAL).forEach((el) => {
    if (el.closest('.hero')) return;
    const group = el.parentElement.closest(STAGGER_BY) || document.body;
    const i = staggerCount.get(group) || 0;
    staggerCount.set(group, i + 1);
    el.dataset.reveal = '';
    el.style.setProperty('--d', `${Math.min(i, 5) * 90}ms`);
    revealTargets.push(el);
  });

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        io.unobserve(entry.target); // animate once
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add('in-view'));
  }

  // Thin progress line at the top showing how far down the page you are
  const scrollBar = document.querySelector('.scroll-progress');
  let scrollTick = 0;
  function updateScrollBar() {
    scrollTick = 0;
    const max = document.documentElement.scrollHeight - innerHeight;
    scrollBar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    // Items in the page's last strip (e.g. the footer's bottom bar) can never reach the
    // observer's trigger line, so reveal whatever is still waiting once we hit the bottom.
    if (max > 0 && scrollY >= max - 2) {
      revealTargets.forEach((el) => { if (!el.closest('[hidden]')) el.classList.add('in-view'); });
    }
  }
  addEventListener('scroll', () => { if (!scrollTick) scrollTick = requestAnimationFrame(updateScrollBar); }, { passive: true });
  addEventListener('resize', updateScrollBar);
  updateScrollBar();
})();
