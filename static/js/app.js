/* ================================================================
   Placement Prep Tracker — client
   ================================================================ */

let RANKS = [];
let XP_MAP = {};
let DIFFS = [];
// Calendar dates use IST even when the browser or hosting server is elsewhere.
function indiaDateKey(instant = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(instant);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
function indiaToday() { return new Date(indiaDateKey() + 'T00:00:00'); }

const STATUS_CYCLE = ['solved', 'revisit', 'todo'];

const LC_SVG = `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l.257.258a1.381 1.381 0 0 0 1.95-.003c.54-.54.54-1.414-.003-1.955L15.507.97A1.383 1.383 0 0 0 14.545.5 1.374 1.374 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H18.35a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z" fill="#FFA116"/></svg>`;

const GFG_SVG = `<svg width="18" height="18" viewBox="0 0 24 24"><path d="M21.45 14.315c-.143.28-.334.532-.565.745a3.691 3.691 0 0 1-1.104.695 4.51 4.51 0 0 1-3.116-.016 3.79 3.79 0 0 1-2.135-2.078 3.571 3.571 0 0 1-.16-.476h3.085a.474.474 0 0 0 .345-.142.475.475 0 0 0 .137-.349v-.715a.47.47 0 0 0-.137-.348.473.473 0 0 0-.345-.142h-3.262a1.5 1.5 0 0 1 .009-.145c0-.048 0-.097-.009-.145h3.262a.473.473 0 0 0 .345-.142.47.47 0 0 0 .137-.348v-.715a.475.475 0 0 0-.137-.349.474.474 0 0 0-.345-.142h-3.085c.073-.164.16-.322.258-.469a3.768 3.768 0 0 1 2.037-1.607 4.51 4.51 0 0 1 3.116-.016c.42.14.8.362 1.104.695.231.213.422.465.565.745a.477.477 0 0 0 .639.206l.647-.326a.478.478 0 0 0 .207-.655 4.515 4.515 0 0 0-.85-1.108 4.7 4.7 0 0 0-1.635-1.053 5.77 5.77 0 0 0-4.033.027 4.74 4.74 0 0 0-3.108 3.313H13.1V8.5a.474.474 0 0 0-.137-.349.473.473 0 0 0-.345-.142h-.715a.474.474 0 0 0-.345.142.474.474 0 0 0-.137.349v1.737H9.852a4.74 4.74 0 0 0-3.108-3.313 5.77 5.77 0 0 0-4.033-.027 4.7 4.7 0 0 0-1.635 1.053 4.51 4.51 0 0 0-.85 1.108.478.478 0 0 0 .207.655l.647.326a.477.477 0 0 0 .639-.206c.143-.28.334-.532.565-.745a3.691 3.691 0 0 1 1.104-.695 4.51 4.51 0 0 1 3.116.016 3.79 3.79 0 0 1 2.037 1.607c.098.147.185.305.258.469H5.714a.474.474 0 0 0-.345.142.475.475 0 0 0-.137.349v.715a.47.47 0 0 0 .137.348.473.473 0 0 0 .345.142h3.262a1.5 1.5 0 0 1-.009.145c0 .048 0 .097.009.145H5.714a.473.473 0 0 0-.345.142.47.47 0 0 0-.137.348v.715a.475.475 0 0 0 .137.349.474.474 0 0 0 .345.142h3.085a3.571 3.571 0 0 1-.16.476 3.79 3.79 0 0 1-2.135 2.078 4.51 4.51 0 0 1-3.116.016 3.691 3.691 0 0 1-1.104-.695 2.836 2.836 0 0 1-.565-.745.477.477 0 0 0-.639-.206l-.647.326a.478.478 0 0 0-.207.655c.216.427.501.819.85 1.108a4.7 4.7 0 0 0 1.635 1.053 5.77 5.77 0 0 0 4.033-.027 4.74 4.74 0 0 0 3.108-3.313h1.569v1.737a.474.474 0 0 0 .137.349.473.473 0 0 0 .345.142h.715a.474.474 0 0 0 .345-.142.474.474 0 0 0 .137-.349v-1.737h1.569a4.74 4.74 0 0 0 3.108 3.313 5.77 5.77 0 0 0 4.033.027 4.7 4.7 0 0 0 1.635-1.053c.349-.289.634-.681.85-1.108a.478.478 0 0 0-.207-.655l-.647-.326a.477.477 0 0 0-.639.206z" fill="#2F8D46"/></svg>`;

/* ── State ──────────────────────────────────────────────────────── */
let currentPage = 'dashboard';
let currentSubject = null;
let subjectQuestions = [];
let subjectTopics = [];
let editingId = null;

/* ── Elements ──────────────────────────────────────────────────── */
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const navTabs       = $('#navTabs');
const pageDashboard = $('#page-dashboard');
const pageSubject   = $('#page-subject');
const dashHeatmap   = $('#dashHeatmap');
const subjectTitle  = $('#subjectTitle');
const treeContainer = $('#treeContainer');
const searchInput   = $('#searchInput');
const filterDiff    = $('#filterDiff');
const modalBackdrop = $('#modalBackdrop');
const toastEl       = $('#toast');
const xpPopup       = $('#xpPopup');

/* ── Custom Select ─────────────────────────────────────────────── */
function initCustomSelect(el, onChange) {
  const trigger = el.querySelector('.cs-trigger');
  const dropdown = el.querySelector('.cs-dropdown');
  const label = el.querySelector('.cs-label');

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.custom-select.open').forEach(s => { if (s !== el) s.classList.remove('open'); });
    if (dpPicker) dpPicker.classList.remove('open');
    el.classList.toggle('open');
  });

  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.cs-option');
    if (!opt) return;
    dropdown.querySelectorAll('.cs-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    el.dataset.value = opt.dataset.value;
    label.textContent = opt.textContent.trim();
    el.classList.remove('open');
    if (onChange) onChange();
  });

  document.addEventListener('click', (e) => {
    if (!el.contains(e.target)) el.classList.remove('open');
  });
}

/* ── Custom Date Picker ────────────────────────────────────────── */
const dpPicker   = $('#datePicker');
const dpTrigger  = $('#dpTrigger');
const dpDropdown = $('#dpDropdown');
const dpLabel    = $('#dpLabel');
const dpGrid     = $('#dpGrid');
const dpMonthLbl = $('#dpMonthLabel');
let dpViewYear, dpViewMonth;

const MONTH_NAMES = ['January','February','March','April','May','June',
  'July','August','September','October','November','December'];
const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec'];

function dpSetValue(dateStr) {
  $('#fDate').value = dateStr;
  if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    dpLabel.textContent = `${MONTH_SHORT[m - 1]} ${d}, ${y}`;
  } else {
    dpLabel.textContent = 'Select date';
  }
}

function dpRender() {
  dpMonthLbl.textContent = `${MONTH_NAMES[dpViewMonth]} ${dpViewYear}`;
  const firstDay = new Date(dpViewYear, dpViewMonth, 1).getDay();
  const daysInMonth = new Date(dpViewYear, dpViewMonth + 1, 0).getDate();
  const prevDays = new Date(dpViewYear, dpViewMonth, 0).getDate();

  const selected = $('#fDate').value;
  const today = indiaToday();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  let html = '';
  for (let i = 0; i < firstDay; i++) {
    const d = prevDays - firstDay + 1 + i;
    html += `<button type="button" class="dp-day other-month" data-date="">${d}</button>`;
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${dpViewYear}-${String(dpViewMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const cls = ['dp-day'];
    if (dateStr === selected) cls.push('selected');
    if (dateStr === todayStr) cls.push('today');
    html += `<button type="button" class="${cls.join(' ')}" data-date="${dateStr}">${d}</button>`;
  }
  const remaining = (7 - (firstDay + daysInMonth) % 7) % 7;
  for (let i = 1; i <= remaining; i++) {
    html += `<button type="button" class="dp-day other-month" data-date="">${i}</button>`;
  }
  dpGrid.innerHTML = html;
}

dpTrigger.addEventListener('click', (e) => {
  e.stopPropagation();
  document.querySelectorAll('.custom-select.open').forEach(s => s.classList.remove('open'));
  const isOpen = dpPicker.classList.toggle('open');
  if (isOpen) {
    const cur = $('#fDate').value;
    if (cur) {
      const [y, m] = cur.split('-').map(Number);
      dpViewYear = y;
      dpViewMonth = m - 1;
    } else {
      const now = indiaToday();
      dpViewYear = now.getFullYear();
      dpViewMonth = now.getMonth();
    }
    dpRender();
  }
});

$('#dpPrev').addEventListener('click', (e) => {
  e.stopPropagation();
  dpViewMonth--;
  if (dpViewMonth < 0) { dpViewMonth = 11; dpViewYear--; }
  dpRender();
});

$('#dpNext').addEventListener('click', (e) => {
  e.stopPropagation();
  dpViewMonth++;
  if (dpViewMonth > 11) { dpViewMonth = 0; dpViewYear++; }
  dpRender();
});

dpGrid.addEventListener('click', (e) => {
  const btn = e.target.closest('.dp-day');
  if (!btn || !btn.dataset.date) return;
  dpSetValue(btn.dataset.date);
  dpPicker.classList.remove('open');
});

document.addEventListener('click', (e) => {
  if (!dpPicker.contains(e.target)) dpPicker.classList.remove('open');
});

/* ── Init ──────────────────────────────────────────────────────── */
(async function init() {
  const cfg = await api('/api/config');
  RANKS = cfg.ranks;
  DIFFS = cfg.difficulties;
  XP_MAP = {};
  DIFFS.forEach(d => XP_MAP[d.key] = d.xp);
  buildFilterDropdown();
  buildDiffSegment();
  setupModal();
  setupSegmented();
  setupNewFolder();
  await loadNavTabs();
  showPage('dashboard');
})();

function buildFilterDropdown() {
  const dd = $('#filterDiffDropdown');
  dd.innerHTML = '<div class="filter-help">Select levels to filter</div>' + DIFFS.map(d =>
    `<button type="button" class="cs-option" aria-pressed="false" data-value="${d.key}"><span class="cs-check" aria-hidden="true">&#10003;</span><span class="cs-dot" style="background:${d.color}"></span>${esc(d.label)}</button>`
  ).join('') + '<button type="button" class="filter-clear" disabled>Clear selection</button>';
  updateFilterLabel();
}

function buildDiffSegment() {
  const seg = $('#segDifficulty');
  seg.innerHTML = DIFFS.map((d, i) =>
    `<button type="button" class="seg-btn${i === 1 ? ' active' : ''}" data-val="${d.key}" style="--seg-color:${d.color}">${d.label}</button>`
  ).join('') + '<div class="seg-indicator"></div>';
}

/* ── Navigation ────────────────────────────────────────────────── */
async function loadNavTabs() {
  const subs = await api('/api/subjects');
  const existing = navTabs.querySelectorAll('.nav-tab[data-subject]');
  existing.forEach(el => el.remove());

  subs.forEach(s => {
    const btn = document.createElement('button');
    btn.className = 'nav-tab';
    btn.dataset.subject = s.id;
    btn.dataset.page = 'subject';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M2 4l6-2 6 2v8l-6 2-6-2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 6v8M2 4l6 2 6-2" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>
      ${s.label}
      <span class="tab-count">${s.solved}/${s.total}</span>
    `;
    navTabs.appendChild(btn);
  });

  navTabs.addEventListener('click', e => {
    const tab = e.target.closest('.nav-tab');
    if (!tab) return;
    navTabs.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    if (tab.dataset.page === 'subject') {
      currentSubject = tab.dataset.subject;
      showPage('subject');
    } else {
      showPage('dashboard');
    }
  });
}

function showPage(page) {
  currentPage = page;
  pageDashboard.classList.toggle('hidden', page !== 'dashboard');
  pageSubject.classList.toggle('hidden', page !== 'subject');
  if (page === 'dashboard') loadDashboard();
  else if (page === 'subject' && currentSubject) loadSubject(currentSubject);
}

/* ── Dashboard ─────────────────────────────────────────────────── */
async function loadDashboard() {
  const s = await api('/api/dashboard');
  renderDonutCard(s);
  renderRankCard(s);
  renderHmHeader(s);
  renderHeatmap(s.heatmap, dashHeatmap);
}

function renderDonutCard(s) {
  const slices = DIFFS.map(d => ({
    count: s[d.key] || 0, color: d.color, diff: d.key, label: d.label
  }));
  const total = slices.reduce((a, sl) => a + sl.count, 0);
  const r = 54, cx = 64, cy = 64, stroke = 8;
  const circ = 2 * Math.PI * r;
  const bg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="${stroke}"/>`;
  let offset = 0;
  let arcs = '';
  slices.forEach(sl => {
    const pct = total ? sl.count / total : 0;
    const dash = pct * circ;
    arcs += `<circle class="donut-arc" data-diff="${sl.diff}" cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${sl.color}" stroke-width="${stroke}" stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="${-offset}" stroke-linecap="round" opacity="${sl.count ? 1 : 0.08}"/>`;
    offset += dash;
  });

  const donut = $('#dashDonut');
  donut.innerHTML = `
    <div class="donut-wrap">
      <svg class="donut-ring" viewBox="0 0 128 128">
        <g transform="rotate(-90 64 64)">${bg}${arcs}</g>
        <text x="64" y="58" text-anchor="middle" fill="var(--text-1)" font-size="28" font-weight="700" letter-spacing="-1">${total}</text>
        <text x="64" y="74" text-anchor="middle" fill="var(--text-3)" font-size="9" letter-spacing="0.5">SOLVED</text>
      </svg>
    </div>
    <div class="diff-cards">
      ${slices.map(sl => `
        <div class="diff-card" data-diff="${sl.diff}">
          <div class="diff-card-label" style="color:${sl.color}">${sl.label}</div>
          <div class="diff-card-val">${sl.count}</div>
        </div>
      `).join('')}
    </div>
  `;

  donut.querySelectorAll('.donut-arc').forEach(arc => {
    arc.addEventListener('pointerenter', () => {
      donut.querySelectorAll('.donut-arc').forEach(a => a.classList.add('dimmed'));
      arc.classList.remove('dimmed');
      arc.classList.add('hovered');
      donut.querySelector(`.diff-card[data-diff="${arc.dataset.diff}"]`)?.classList.add('highlight');
    });
    arc.addEventListener('pointerleave', () => {
      donut.querySelectorAll('.donut-arc').forEach(a => a.classList.remove('dimmed', 'hovered'));
      donut.querySelectorAll('.diff-card').forEach(c => c.classList.remove('highlight'));
    });
  });

  donut.querySelectorAll('.diff-card').forEach(card => {
    card.addEventListener('pointerenter', () => {
      donut.querySelectorAll('.donut-arc').forEach(a => a.classList.add('dimmed'));
      const arc = donut.querySelector(`.donut-arc[data-diff="${card.dataset.diff}"]`);
      if (arc) { arc.classList.remove('dimmed'); arc.classList.add('hovered'); }
      card.classList.add('highlight');
    });
    card.addEventListener('pointerleave', () => {
      donut.querySelectorAll('.donut-arc').forEach(a => a.classList.remove('dimmed', 'hovered'));
      donut.querySelectorAll('.diff-card').forEach(c => c.classList.remove('highlight'));
    });
  });
}

function renderRankCard(s) {
  const pct = Math.round(s.rank_progress * 100);
  const currentIdx = RANKS.findIndex(r => r.name === s.rank);

  const chipsHtml = RANKS.map((r, i) => {
    let state = 'future';
    if (i < currentIdx) state = 'past';
    if (i === currentIdx) state = 'current';
    const nameStyle = state !== 'future' ? ` style="color:${r.color}"` : '';
    const badge = i === currentIdx ? '<div class="rank-chip-badge">YOU</div>' : '';
    return `
      <div class="rank-chip ${state}" data-idx="${i}">
        ${badge}
        <div class="rank-chip-name"${nameStyle}>${r.name}</div>
        <div class="rank-chip-xp">${r.xp.toLocaleString()} XP</div>
      </div>`;
  }).join('');

  $('#dashRank').innerHTML = `
    <div class="rank-strip-wrap">
      <div class="rank-strip" id="rankStrip">${chipsHtml}</div>
    </div>
    <div class="xp-section">
      <div class="xp-track"><div class="xp-fill" style="width:${pct}%"></div></div>
      <div class="xp-labels">
        <span>${s.total_xp.toLocaleString()} XP</span>
        <span>${s.next_threshold ? s.next_threshold.toLocaleString() + ' XP' : 'Max Rank!'}</span>
      </div>
    </div>
    <div class="rank-stats">
      <div class="rank-stat">
        <span class="rank-stat-val">${s.current_streak}</span>
        <span class="rank-stat-label">Current Streak</span>
      </div>
      <div class="rank-stat">
        <span class="rank-stat-val">${s.best_streak}</span>
        <span class="rank-stat-label">Best Streak</span>
      </div>
      <div class="rank-stat">
        <span class="rank-stat-val">${s.avg_per_day || 0}</span>
        <span class="rank-stat-label">Average questions per day</span>
      </div>
    </div>
  `;

  const strip = document.getElementById('rankStrip');
  if (!strip) return;
  const chips = [...strip.querySelectorAll('.rank-chip')];

  function updateFocus() {
    const center = strip.scrollLeft + strip.offsetWidth / 2;
    let best = 0, bestDist = Infinity;
    chips.forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    chips.forEach((c, i) => c.classList.toggle('focused', i === best));
  }

  const target = chips[currentIdx];
  if (target) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        strip.scrollTo({ left: target.offsetLeft - strip.offsetWidth / 2 + target.offsetWidth / 2, behavior: 'instant' });
        updateFocus();
      });
    });
  }

  strip.addEventListener('scroll', () => requestAnimationFrame(updateFocus));

  let wheelLock = false;
  strip.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (wheelLock) return;
    wheelLock = true;
    setTimeout(() => { wheelLock = false; }, 300);
    const focused = strip.querySelector('.rank-chip.focused');
    if (!focused) return;
    const idx = parseInt(focused.dataset.idx);
    const dir = (e.deltaY > 0 || e.deltaX > 0) ? 1 : -1;
    const next = Math.max(0, Math.min(chips.length - 1, idx + dir));
    if (next === idx) return;
    const nc = chips[next];
    strip.scrollTo({ left: nc.offsetLeft - strip.offsetWidth / 2 + nc.offsetWidth / 2, behavior: 'smooth' });
  }, { passive: false });
}

let hmYear = String(indiaToday().getFullYear());
let hmData = {};
let hmStats = {};

let hmWheelBound = false;

function renderHmHeader(s) {
  hmData = s.heatmap;
  hmStats = s;

  const filtered = filterHeatmap(s.heatmap, hmYear);
  const total = Object.values(filtered).reduce((a, b) => a + b, 0);
  const activeDays = Object.values(filtered).filter(v => v > 0).length;

  $('#hmHeader').innerHTML = `
    <div class="hm-header-row">
      <div class="hm-title"><span class="hm-count">${total}</span> submissions in <span class="hm-year-label" id="hmYearLabel">${hmYear}</span></div>
      <div class="hm-header-right">
        <span class="hm-meta">Active days: <strong>${activeDays}</strong></span>
      </div>
    </div>
  `;

  if (!hmWheelBound) {
    hmWheelBound = true;
    const card = document.querySelector('.dash-heatmap-card');
    let hovering = false;
    let cooldown = false;

    card.addEventListener('click', (e) => {
      if (e.target.closest('#hmYearLabel')) openYearDial();
    });

    card.addEventListener('pointerenter', (e) => {
      const label = $('#hmYearLabel');
      if (label) {
        const r = label.getBoundingClientRect();
        const pad = 30;
        hovering = e.clientX >= r.left - pad && e.clientX <= r.right + pad
                && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
      }
    });
    card.addEventListener('pointermove', (e) => {
      const label = $('#hmYearLabel');
      if (!label) { hovering = false; return; }
      const r = label.getBoundingClientRect();
      const pad = 30;
      hovering = e.clientX >= r.left - pad && e.clientX <= r.right + pad
              && e.clientY >= r.top - pad && e.clientY <= r.bottom + pad;
    });
    card.addEventListener('pointerleave', () => { hovering = false; });

    card.addEventListener('wheel', (e) => {
      if (!hovering) return;
      e.preventDefault();
      if (cooldown) return;
      cooldown = true;
      setTimeout(() => { cooldown = false; }, 250);
      const cur = parseInt(hmYear);
      const next = cur + (e.deltaY > 0 ? 1 : -1);
      if (next < 2020 || next > indiaToday().getFullYear()) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      const label = $('#hmYearLabel');
      if (label) {
        label.classList.add(dir > 0 ? 'hm-year-out-up' : 'hm-year-out-down');
      }
      setTimeout(() => {
        hmYear = String(next);
        renderHmHeader(hmStats);
        renderHeatmap(hmData, dashHeatmap);
        const newLabel = $('#hmYearLabel');
        if (newLabel) {
          newLabel.classList.add(dir > 0 ? 'hm-year-in-down' : 'hm-year-in-up');
          requestAnimationFrame(() => {
            requestAnimationFrame(() => newLabel.classList.remove('hm-year-in-down', 'hm-year-in-up'));
          });
        }
      }, 120);
    }, { passive: false });
  }
}

function filterHeatmap(heatmap, year) {
  const out = {};
  for (const [k, v] of Object.entries(heatmap)) {
    if (k.startsWith(year + '-')) out[k] = v;
  }
  return out;
}

function openYearDial() {
  if (document.querySelector('.year-dial-backdrop')) {
    document.querySelector('.year-dial-backdrop').remove();
    return;
  }

  const currentYear = indiaToday().getFullYear();
  const minYear = 2020;
  const years = [];
  for (let y = minYear; y <= currentYear; y++) years.push(y);

  const itemH = 44;
  const visible = 5;
  const listH = visible * itemH;
  const padH = Math.floor(visible / 2) * itemH;

  const backdrop = document.createElement('div');
  backdrop.className = 'year-dial-backdrop';

  const dial = document.createElement('div');
  dial.className = 'year-dial';

  const titleEl = document.createElement('div');
  titleEl.className = 'year-dial-title';
  titleEl.textContent = 'Year';

  const win = document.createElement('div');
  win.className = 'year-dial-window';

  const highlight = document.createElement('div');
  highlight.className = 'year-dial-highlight';
  highlight.style.height = itemH + 'px';

  const list = document.createElement('div');
  list.className = 'year-dial-list';
  list.style.height = listH + 'px';

  const topPad = document.createElement('div');
  topPad.className = 'year-dial-pad';
  topPad.style.height = padH + 'px';
  list.appendChild(topPad);

  years.forEach(y => {
    const item = document.createElement('div');
    item.className = 'year-dial-item';
    item.dataset.year = y;
    item.textContent = y;
    item.style.height = itemH + 'px';
    list.appendChild(item);
  });

  const botPad = document.createElement('div');
  botPad.className = 'year-dial-pad';
  botPad.style.height = padH + 'px';
  list.appendChild(botPad);

  win.appendChild(highlight);
  win.appendChild(list);
  dial.appendChild(titleEl);
  dial.appendChild(win);
  backdrop.appendChild(dial);
  document.body.appendChild(backdrop);

  const selectedIdx = years.indexOf(parseInt(hmYear));

  function updateDial() {
    const center = list.scrollTop + listH / 2;
    list.querySelectorAll('.year-dial-item').forEach(item => {
      const itemCenter = item.offsetTop + itemH / 2;
      const offset = (itemCenter - center) / itemH;
      const absOff = Math.abs(offset);
      const rotX = offset * -22;
      const opa = Math.max(0.12, 1 - absOff * 0.4);
      const sc = Math.max(0.7, 1 - absOff * 0.12);
      item.style.transform = `perspective(200px) rotateX(${rotX}deg) scale(${sc})`;
      item.style.opacity = opa;
      item.classList.toggle('active', absOff < 0.5);
    });
  }

  list.addEventListener('scroll', () => requestAnimationFrame(updateDial));

  requestAnimationFrame(() => {
    if (selectedIdx >= 0) list.scrollTop = selectedIdx * itemH;
    updateDial();
    requestAnimationFrame(() => backdrop.classList.add('open'));
  });

  function closeDial() {
    backdrop.remove();
    document.removeEventListener('keydown', escHandler);
  }

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.year-dial-item');
    if (!item) return;
    hmYear = item.dataset.year;
    closeDial();
    renderHmHeader(hmStats);
    renderHeatmap(hmData, dashHeatmap);
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeDial();
  });

  const escHandler = (e) => {
    if (e.key === 'Escape') closeDial();
  };
  document.addEventListener('keydown', escHandler);
}

/* ── Heatmap ───────────────────────────────────────────────────── */
function renderHeatmap(heatmap, container) {
  const yr = parseInt(hmYear);
  const today = indiaToday();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(yr, 0, 1);
  const endDate = new Date(yr, 11, 31);

  const allDays = [];
  const d = new Date(startDate);
  while (d <= endDate) {
    const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const isFuture = d > today;
    const count = isFuture ? 0 : (heatmap[iso] || 0);
    let lvl = 0;
    if (!isFuture) {
      if (count >= 5) lvl = 4;
      else if (count >= 3) lvl = 3;
      else if (count >= 2) lvl = 2;
      else if (count >= 1) lvl = 1;
    }
    allDays.push({ iso, count, lvl, dow: d.getDay(), month: d.getMonth(), year: d.getFullYear(), day: d.getDate(), isFuture });
    d.setDate(d.getDate() + 1);
  }

  const monthGroups = [];
  let cur = null;
  for (const day of allDays) {
    const key = `${day.year}-${day.month}`;
    if (!cur || cur.key !== key) {
      cur = { key, month: day.month, year: day.year, days: [] };
      monthGroups.push(cur);
    }
    cur.days.push(day);
  }

  const cellSize = 15;
  const gapSize = 3;
  const step = cellSize + gapSize;
  const monthGap = Math.round(step * 1.2);
  const pad = 2;
  const bottomPad = 24;
  const leftPad = 30;
  const gridH = 7 * step - gapSize;
  const monthLong = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

  const rects = [];
  const labels = [];
  let curX = pad + leftPad;

  for (let mi = 0; mi < monthGroups.length; mi++) {
    const m = monthGroups[mi];
    const blockStartX = curX;
    let col = 0;

    for (let i = 0; i < m.days.length; i++) {
      const day = m.days[i];
      if (i > 0 && day.dow === 0) col++;
      const x = curX + col * step;
      const y = pad + day.dow * step;
      rects.push({ x, y, lvl: day.lvl, count: day.count, month: day.month, day: day.day, year: day.year, isFuture: day.isFuture });
    }

    const blockEndX = curX + col * step + cellSize;
    labels.push({ x: (blockStartX + blockEndX) / 2, month: m.month });
    curX = curX + (col + 1) * step + monthGap;
  }

  const totalW = 1440;
  const h = pad + gridH + bottomPad;

  let svg = `<svg class="hm-svg" viewBox="0 0 ${totalW} ${h}" preserveAspectRatio="xMidYMid meet">`;

  for (let dow = 0; dow < 7; dow++) {
    if (dayLabels[dow]) {
      const y = pad + dow * step + cellSize * 0.75;
      svg += `<text x="${pad}" y="${y}" class="hm-day-label">${dayLabels[dow]}</text>`;
    }
  }

  const labelY = pad + gridH + 18;
  for (const r of rects) {
    const cls = r.isFuture ? 'hm-future' : `hm-l${r.lvl}`;
    const tip = r.isFuture ? '' : ` data-tip="${r.count} submission${r.count !== 1 ? 's' : ''} on ${monthLong[r.month]} ${r.day}, ${r.year}"`;
    svg += `<rect x="${r.x}" y="${r.y}" width="${cellSize}" height="${cellSize}" rx="3" class="${cls}"${tip}/>`;
  }
  for (const l of labels) {
    svg += `<text x="${l.x}" y="${labelY}" text-anchor="middle" class="hm-month-label">${monthNames[l.month]}</text>`;
  }

  svg += `</svg>`;
  container.innerHTML = svg;
  setupHmTooltip(container);
}

function setupHmTooltip(container) {
  const tip = $('#hmTooltip');
  const svg = container.querySelector('.hm-svg');
  if (!svg || !tip) return;

  svg.addEventListener('pointermove', (e) => {
    const rect = e.target.closest('rect[data-tip]');
    if (!rect) { tip.classList.remove('visible'); return; }
    tip.textContent = rect.getAttribute('data-tip');
    tip.classList.add('visible');
    const card = container.closest('.dash-heatmap-card');
    const cardRect = card.getBoundingClientRect();
    let x = e.clientX - cardRect.left + 12;
    let y = e.clientY - cardRect.top - 36;
    if (x + 180 > cardRect.width) x = e.clientX - cardRect.left - 180;
    if (y < 0) y = e.clientY - cardRect.top + 20;
    tip.style.transform = `translate(${x}px, ${y}px)`;
  });

  svg.addEventListener('pointerleave', () => tip.classList.remove('visible'));
}

/* ── Subject page ──────────────────────────────────────────────── */
async function loadSubject(subject) {
  subjectTitle.textContent = subject.toUpperCase();
  const [questions, topics] = await Promise.all([
    api(`/api/${subject}/questions`),
    api(`/api/${subject}/topics`),
  ]);
  subjectQuestions = questions;
  subjectTopics = topics;
  populateTopicList(topics);
  renderTree();
}

function populateTopicList(topics) {
  const dl = $('#topicList');
  dl.innerHTML = '';
  topics.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    dl.appendChild(opt);
  });
}

function getFilteredQuestions() {
  let qs = [...subjectQuestions];
  const search = searchInput.value.trim().toLowerCase();
  if (search) qs = qs.filter(q => q.title.toLowerCase().includes(search) || (q.notes || '').toLowerCase().includes(search));
  const selected = [...filterDiff.querySelectorAll('.cs-option.selected')].map(o => o.dataset.value);
  if (selected.length > 0 && selected.length < DIFFS.length) {
    qs = qs.filter(q => selected.includes(q.difficulty));
  }
  return qs;
}

function updateFilterLabel() {
  const selected = [...filterDiff.querySelectorAll('.cs-option.selected')];
  const label = filterDiff.querySelector('.cs-label');
  label.textContent = selected.length === 0 ? 'All Levels' : selected.length === 1
    ? DIFFS.find(d => d.key === selected[0].dataset.value).label : `${selected.length} Levels`;
  filterDiff.classList.toggle('filter-active', selected.length > 0);
  filterDiff.querySelectorAll('.cs-option').forEach(o => o.setAttribute('aria-pressed', o.classList.contains('selected')));
  const clear = filterDiff.querySelector('.filter-clear');
  if (clear) clear.disabled = selected.length === 0;
}

searchInput.addEventListener('input', renderTree);
initMultiSelect(filterDiff, () => { updateFilterLabel(); renderTree(); });

function initMultiSelect(el, onChange) {
  const trigger = el.querySelector('.cs-trigger');
  const dropdown = el.querySelector('.cs-dropdown');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.setAttribute('aria-controls', dropdown.id);
  const close = () => { el.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); };
  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.custom-select.open').forEach(s => { if (s !== el) s.classList.remove('open'); });
    if (dpPicker) dpPicker.classList.remove('open');
    const opened = el.classList.toggle('open');
    trigger.setAttribute('aria-expanded', opened);
  });
  dropdown.addEventListener('click', (e) => {
    const opt = e.target.closest('.cs-option');
    if (!opt && !e.target.closest('.filter-clear')) return;
    e.stopPropagation();
    if (opt) opt.classList.toggle('selected');
    // Every level selected is equivalent to no filter; display that consistently.
    if (!opt || dropdown.querySelectorAll('.cs-option.selected').length === DIFFS.length) {
      dropdown.querySelectorAll('.cs-option').forEach(o => o.classList.remove('selected'));
    }
    if (onChange) onChange();
  });
  el.addEventListener('keydown', e => {
    if (e.key === 'Escape') { close(); trigger.focus(); }
  });
  document.addEventListener('click', e => { if (!el.contains(e.target)) close(); });
  el.addEventListener('focusout', e => { if (!el.contains(e.relatedTarget)) close(); });
}

let openFolders = new Set();

function toggleFolder(el) {
  const folder = el.closest('.tree-folder');
  const topic = folder.dataset.topic;
  folder.classList.toggle('open');
  el.setAttribute('aria-expanded', folder.classList.contains('open'));
  folder.querySelector('.folder-body').inert = !folder.classList.contains('open');
  if (folder.classList.contains('open')) {
    openFolders.add(topic);
  } else {
    openFolders.delete(topic);
  }
}
window.toggleFolder = toggleFolder;

function renderTree() {
  const questions = getFilteredQuestions();


  const grouped = Object.create(null);
  subjectTopics.forEach(t => { if (!grouped[t]) grouped[t] = []; });
  questions.forEach(q => {
    const topic = q.topic || 'Other';
    if (!grouped[topic]) grouped[topic] = [];
    grouped[topic].push(q);
  });

  const orderedTopics = Object.keys(grouped);

  if (!orderedTopics.length) {
    treeContainer.innerHTML = '<div class="tree-empty">No topics yet. Create one to get started!</div>';
    return;
  }

  let html = '';
  orderedTopics.forEach(topic => {
    const qs = grouped[topic];
    const solvedCount = qs.filter(q => q.status === 'solved' || q.status === 'revisit').length;
    const isEmpty = qs.length === 0;
    html += `
      <div class="tree-folder${openFolders.has(topic) ? ' open' : ''}" data-topic="${esc(topic)}">
        <div class="folder-header">
          <button type="button" class="folder-left" data-topic-action="toggle" aria-expanded="${openFolders.has(topic)}">
            <svg class="folder-chevron" width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4.5 2.5l3.5 3.5-3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            <svg class="folder-icon" width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h3.586a1 1 0 0 1 .707.293L9.5 5H14.5A1.5 1.5 0 0 1 16 6.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 2 13.5z" stroke="currentColor" stroke-width="1.3"/></svg>
            <span class="folder-name">${esc(topic)}</span>
            <span class="folder-count">${solvedCount}/${qs.length}</span>
          </button>
          <div class="folder-right">
            <button class="btn-icon btn-folder-add" type="button" data-topic-action="add" aria-label="Add question to ${esc(topic)}" title="Add question">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 3v8M3 7h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            </button>
            <button type="button" class="btn-icon btn-topic-manage" data-topic-action="manage" title="Manage topic" aria-label="Manage ${esc(topic)}">
              <svg width="14" height="14" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true"><circle cx="4" cy="9" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="14" cy="9" r="1.5"/></svg>
            </button>
          </div>
        </div>
        <div class="folder-body-wrap">
          <div class="folder-body" ${openFolders.has(topic) ? '' : 'inert'}>
            ${qs.map(q => renderFileRow(q)).join('')}
            ${isEmpty ? `<div class="folder-empty">${subjectQuestions.some(q => q.topic === topic) ? 'No questions match your filters' : 'No questions yet'}</div>` : ''}
          </div>
        </div>
      </div>`;
  });

  treeContainer.innerHTML = html;
  initDragReorder();
}

function detectPlatform(url) {
  if (!url) return '';
  try {
    const host = new URL(url).hostname.replace('www.', '');
    if (host.includes('leetcode')) return 'leetcode';
    if (host.includes('geeksforgeeks') || host.includes('gfg')) return 'gfg';
    return host;
  } catch { return ''; }
}

function faviconImg(url) {
  try {
    const domain = new URL(url).hostname;
    return `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=32" width="18" height="18" style="border-radius:3px" alt="">`;
  } catch { return null; }
}

function platformIcon(q) {
  if (q.platform === 'leetcode') return LC_SVG;
  if (q.platform === 'gfg') return GFG_SVG;
  if (q.link) return faviconImg(q.link) || '';
  return `<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.2" opacity="0.3"/></svg>`;
}

function refIcon(url) {
  if (!url) return null;
  return faviconImg(url);
}

function renderFileRow(q) {
  const platIcon = platformIcon(q);
  const statusCls = q.status || 'solved';

  const platLink = q.link
    ? `<a href="${esc(q.link)}" target="_blank" rel="noopener" class="file-platform-link" title="Open problem">${platIcon}</a>`
    : `<div class="file-platform">${platIcon}</div>`;

  const refIcn = q.video_link ? refIcon(q.video_link) : null;
  const refLink = q.video_link && refIcn
    ? `<a href="${esc(q.video_link)}" target="_blank" rel="noopener" class="file-platform-link" title="Reference material">${refIcn}</a>`
    : '';

  const hasNotes = q.notes && q.notes.trim();
  const hasCode = q.code && q.code.trim();
  const hasContent = hasNotes || hasCode;
  const notesBtn = `<button class="btn-icon btn-notes ${hasContent ? '' : 'btn-notes-empty'}" onclick="showNotes('${q.id}')" title="${hasContent ? 'View summary' : 'No notes'}">
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 2.5h10a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1z" stroke="currentColor" stroke-width="1.2"/><path d="M5 5.5h6M5 8h6M5 10.5h3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/></svg>
  </button>`;

  return `
    <div class="file-row" data-id="${q.id}">
      <div class="drag-handle" aria-label="Reorder">
        <svg width="10" height="16" viewBox="0 0 10 16" fill="none">
          <circle cx="3" cy="2.5" r="1.2" fill="currentColor"/>
          <circle cx="7" cy="2.5" r="1.2" fill="currentColor"/>
          <circle cx="3" cy="8" r="1.2" fill="currentColor"/>
          <circle cx="7" cy="8" r="1.2" fill="currentColor"/>
          <circle cx="3" cy="13.5" r="1.2" fill="currentColor"/>
          <circle cx="7" cy="13.5" r="1.2" fill="currentColor"/>
        </svg>
      </div>
      <button class="status-dot ${statusCls}" onclick="cycleStatus('${q.id}')" title="${cap(statusCls)} — click to change">
        ${statusIcon(statusCls)}
      </button>
      <div class="file-main">
        <div class="file-title">${esc(q.title)}</div>
      </div>
      <span class="file-diff" style="color:${diffColor(q.difficulty)};background:${diffBg(q.difficulty)}">${cap(q.difficulty)}</span>
      ${refLink}
      ${platLink}
      ${notesBtn}
      <div class="file-actions">
        <button class="btn-icon" onclick="editQuestion('${q.id}')" title="Edit">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M10 2l2 2-7 7H3v-2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>
        </button>
        <button class="btn-icon" onclick="deleteQuestion('${q.id}')" title="Delete">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 4h8M5.5 4V3a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M4.5 4l.5 8h4l.5-8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      </div>
    </div>`;
}

function statusIcon(status) {
  if (status === 'solved') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--green)" opacity="0.15"/><path d="M5 8l2 2 4-4" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  if (status === 'revisit') return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" fill="var(--orange)" opacity="0.15"/><path d="M8 5v3.5l2.5 1.5" stroke="var(--orange)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="var(--text-3)" stroke-width="1.2"/></svg>';
}

async function cycleStatus(id) {
  const q = subjectQuestions.find(q => q.id === id);
  if (!q) return;
  const cur = STATUS_CYCLE.indexOf(q.status);
  const next = STATUS_CYCLE[(cur + 1) % STATUS_CYCLE.length];
  await api(`/api/${currentSubject}/questions/${id}`, 'PUT', { status: next });
  q.status = next;
  renderTree();
  await refreshNavCounts();
}
window.cycleStatus = cycleStatus;

function showNotes(id) {
  const q = subjectQuestions.find(q => q.id === id);
  if (!q) return;
  const popover = $('#notesPopover');
  const content = $('#notesPopoverContent');
  const hasNotes = q.notes && q.notes.trim();
  const hasCode = q.code && q.code.trim();

  if (!hasNotes && !hasCode) {
    content.innerHTML = `<div class="notes-empty">No notes for this question</div>`;
  } else {
    let html = `<div class="notes-title">${esc(q.title)}</div>`;
    if (hasNotes) html += `<div class="notes-body">${esc(q.notes)}</div>`;
    if (hasCode) {
      html += `<div class="code-section">
        <div class="code-header">
          <span class="code-lang">C++</span>
          <button class="code-copy-btn" onclick="copyCode(this)" type="button">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.2"/></svg>
            Copy
          </button>
        </div>
        <div class="code-block-wrap"><pre class="code-block"><code class="language-cpp">${esc(q.code)}</code></pre></div>
      </div>`;
    }
    content.innerHTML = html;
    if (hasCode) {
      content.querySelectorAll('pre code').forEach(el => hljs.highlightElement(el));
    }
  }
  popover.classList.add('open');
  const closePopover = () => {
    popover.classList.remove('open');
    document.removeEventListener('pointerdown', clickClose);
    document.removeEventListener('keydown', escClose);
  };
  const clickClose = (e) => {
    if (!content.contains(e.target)) closePopover();
  };
  const escClose = (e) => {
    if (e.key === 'Escape') closePopover();
  };
  setTimeout(() => {
    document.addEventListener('pointerdown', clickClose);
    document.addEventListener('keydown', escClose);
  }, 10);
}

function copyCode(btn) {
  const code = btn.closest('.code-section').querySelector('code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M4 8l3 3 5-5" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> Copied`;
    setTimeout(() => {
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.2"/></svg> Copy`;
    }, 1500);
  });
}
window.copyCode = copyCode;
window.showNotes = showNotes;

/* ── Drag reorder ─────────────────────────────────────────────── */
function initDragReorder() {
  treeContainer.querySelectorAll('.drag-handle').forEach(handle => {
    handle.addEventListener('pointerdown', onDragStart);
  });
}

let dragState = null;

function onDragStart(e) {
  const row = e.currentTarget.closest('.file-row');
  const body = row.closest('.folder-body');
  if (!body) return;

  const rows = [...body.querySelectorAll('.file-row')];
  if (rows.length < 2) return;

  e.preventDefault();
  row.setPointerCapture(e.pointerId);

  const rect = row.getBoundingClientRect();
  const bodyRect = body.getBoundingClientRect();
  const rowHeight = rect.height;
  const startIdx = rows.indexOf(row);
  const grabY = e.clientY - rect.top;

  row.classList.add('dragging');
  body.classList.add('drag-active');
  body.style.height = bodyRect.height + 'px';

  rows.forEach((r, i) => {
    r.style.transition = 'none';
    if (r !== row) {
      r.style.transform = '';
      r.dataset.dragIdx = i;
    }
  });

  row.style.zIndex = '10';
  row.style.position = 'relative';

  dragState = { row, body, rows, startIdx, currentIdx: startIdx, grabY, rowHeight };

  row.addEventListener('pointermove', onDragMove);
  row.addEventListener('pointerup', onDragEnd);
  row.addEventListener('pointercancel', onDragEnd);
}

function onDragMove(e) {
  if (!dragState) return;
  const { row, rows, startIdx, rowHeight, grabY, body } = dragState;
  const bodyRect = body.getBoundingClientRect();
  const offsetY = e.clientY - bodyRect.top - grabY - (startIdx * rowHeight);

  row.style.transform = `translateY(${offsetY}px)`;

  const rawIdx = (e.clientY - bodyRect.top - grabY) / rowHeight;
  const hoverIdx = Math.max(0, Math.min(rows.length - 1, Math.round(rawIdx)));

  if (hoverIdx !== dragState.currentIdx) {
    dragState.currentIdx = hoverIdx;
    rows.forEach((r, i) => {
      if (r === row) return;
      r.style.transition = 'transform 0.25s cubic-bezier(0.2, 1, 0.3, 1)';
      let shift = 0;
      if (startIdx < hoverIdx && i > startIdx && i <= hoverIdx) shift = -rowHeight;
      else if (startIdx > hoverIdx && i < startIdx && i >= hoverIdx) shift = rowHeight;
      r.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  }
}

async function onDragEnd(e) {
  if (!dragState) return;
  const { row, body, rows, startIdx, currentIdx, rowHeight } = dragState;

  row.removeEventListener('pointermove', onDragMove);
  row.removeEventListener('pointerup', onDragEnd);
  row.removeEventListener('pointercancel', onDragEnd);

  const finalOffset = (currentIdx - startIdx) * rowHeight;
  row.style.transition = 'transform 0.3s cubic-bezier(0.2, 1, 0.3, 1)';
  row.style.transform = `translateY(${finalOffset}px)`;

  await new Promise(r => setTimeout(r, 300));

  row.classList.remove('dragging');
  body.classList.remove('drag-active');
  body.style.height = '';
  rows.forEach(r => {
    r.style.transform = '';
    r.style.transition = '';
    r.style.zIndex = '';
    r.style.position = '';
    delete r.dataset.dragIdx;
  });

  if (startIdx !== currentIdx) {
    const ids = rows.map(r => r.dataset.id);
    const [moved] = ids.splice(startIdx, 1);
    ids.splice(currentIdx, 0, moved);

    const topic = row.closest('.tree-folder')?.dataset.topic;
    const topicIds = ids;
    const allIds = [];
    subjectQuestions.forEach(q => {
      if (q.topic === topic) return;
      allIds.push(q.id);
    });
    const finalIds = [];
    let topicInserted = false;
    subjectQuestions.forEach(q => {
      if (q.topic === topic && !topicInserted) {
        finalIds.push(...topicIds);
        topicInserted = true;
      } else if (q.topic !== topic) {
        finalIds.push(q.id);
      }
    });
    if (!topicInserted) finalIds.push(...topicIds);

    await api(`/api/${currentSubject}/reorder`, 'PUT', { ids: finalIds });
    await loadSubject(currentSubject);
  }

  dragState = null;
}

/* ── Topic management ──────────────────────────────────────────── */
function setupNewFolder() {
  $('#btnFolder').addEventListener('click', () => openTopicDialog());
  treeContainer.addEventListener('click', e => {
    const button = e.target.closest('[data-topic-action]');
    if (!button) return;
    const topic = button.closest('.tree-folder').dataset.topic;
    if (button.dataset.topicAction === 'toggle') toggleFolder(button);
    if (button.dataset.topicAction === 'add') addToFolder(topic);
    if (button.dataset.topicAction === 'manage') openTopicDialog(topic);
  });
}

function addToFolder(topic) { openModal(null, topic); }
window.addToFolder = addToFolder;

function openTopicDialog(topic = null) {
  const subject = currentSubject;
  const opener = document.activeElement;
  const count = subjectQuestions.filter(q => q.topic === topic).length;
  const dialog = document.createElement('dialog');
  dialog.className = 'topic-dialog';
  dialog.setAttribute('aria-labelledby', 'topicDialogTitle');
  dialog.innerHTML = `
    <form class="topic-form">
      <div class="topic-dialog-heading"><h2 id="topicDialogTitle">${topic === null ? 'New topic' : 'Manage topic'}</h2>
        <button type="button" class="btn-icon topic-close" aria-label="Close">✕</button></div>
      <p class="topic-description">${topic === null ? 'Give your questions a place to belong.' : `${count} question${count === 1 ? '' : 's'} · Renaming keeps your progress and notes.`}</p>
      <label for="topicName">Topic name</label>
      <input id="topicName" class="topic-name-input" required maxlength="100" autocomplete="off" value="${esc(topic || '')}">
      <p class="topic-error" role="alert"></p>
      <div class="topic-dialog-actions">
        ${topic !== null ? '<button type="button" class="topic-delete-link">Delete topic…</button>' : ''}
        <button type="submit" class="btn btn-primary">${topic === null ? 'Create topic' : 'Save name'}</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);
  let saving = false;
  dialog.addEventListener('cancel', e => { if (saving) e.preventDefault(); });
  dialog.addEventListener('close', () => {
    dialog.remove();
    if (opener?.isConnected) opener.focus();
    else $('#btnFolder').focus();
  });
  dialog.addEventListener('click', e => {
    const rect = dialog.getBoundingClientRect();
    const outside = e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
    if (!saving && (e.target.closest('.topic-close') || (e.target === dialog && outside))) dialog.close();
  });
  const perform = async (method, data, message) => {
    if (saving) return;
    saving = true;
    dialog.querySelectorAll('button').forEach(b => b.disabled = true);
    try {
      await api(`/api/${subject}/topics`, method, data);
      if (topic !== null) {
        const wasOpen = openFolders.delete(topic);
        if (method === 'PUT' && wasOpen) openFolders.add(data.new_name);
        // Remove old DOM state before rebuilding renamed folders.
        treeContainer.querySelectorAll('.tree-folder').forEach(f => {
          if (f.dataset.topic === topic) f.classList.remove('open');
        });
      }
      dialog.close();
      await loadSubject(subject);
      await refreshNavCounts();
      showToast(message);
    } catch (error) {
      const messageEl = dialog.querySelector('.topic-error');
      if (messageEl) messageEl.textContent = error.message;
    } finally {
      saving = false;
      dialog.querySelectorAll('button').forEach(b => b.disabled = false);
    }
  };
  dialog.querySelector('form').addEventListener('submit', e => {
    e.preventDefault();
    const name = dialog.querySelector('#topicName').value.trim();
    if (!name) { dialog.querySelector('.topic-error').textContent = 'Enter a topic name.'; return; }
    perform(topic === null ? 'POST' : 'PUT', topic === null ? {name} : {name: topic, new_name: name}, topic === null ? 'Topic created' : 'Topic renamed');
  });
  dialog.querySelector('.topic-delete-link')?.addEventListener('click', () => {
    const target = topic === 'Uncategorized' ? 'Other' : 'Uncategorized';
    dialog.querySelector('form').innerHTML = `
      <h2 id="topicDialogTitle">Delete “${esc(topic)}”?</h2>
      <p class="topic-description">${count ? 'Choose what happens to the questions in this topic.' : 'This topic is empty.'}</p>
      ${count ? `<label class="topic-delete-choice"><input type="checkbox" id="deleteTopicQuestions"><span>Also delete all ${count} question${count === 1 ? '' : 's'}<small>Includes saved notes, code, and progress.</small></span></label>
      <p class="topic-delete-detail">Questions will move to “${esc(target)}”.</p>` : ''}
      <p class="topic-error" role="alert"></p>
      <div class="topic-dialog-actions"><button type="button" class="btn topic-close">Cancel</button><button type="button" class="btn topic-confirm-delete">Delete topic</button></div>`;
    const checkbox = dialog.querySelector('#deleteTopicQuestions');
    checkbox?.addEventListener('change', () => {
      dialog.querySelector('.topic-delete-detail').textContent = checkbox.checked
        ? 'These questions and their progress will be permanently deleted.' : `Questions will move to “${target}”.`;
      dialog.querySelector('.topic-confirm-delete').textContent = checkbox.checked ? 'Delete topic and questions' : 'Delete topic';
    });
    dialog.querySelector('.topic-confirm-delete').addEventListener('click', () => {
      perform('DELETE', {name: topic, question_action: checkbox?.checked ? 'delete' : 'keep'}, 'Topic deleted');
    });
    dialog.querySelector('.topic-close').focus();
  });
  dialog.showModal();
  dialog.querySelector('#topicName').focus();
  if (topic) dialog.querySelector('#topicName').select();
}

/* ── Modal ──────────────────────────────────────────────────────── */
function setupModal() {
  modalBackdrop.addEventListener('click', e => {
    if (e.target === modalBackdrop) closeModal();
  });
  $('#qForm').addEventListener('submit', e => { e.preventDefault(); saveQuestion(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  const statusColors = { solved: 'var(--green)', revisit: 'var(--orange)', todo: 'var(--text-3)' };
  initCustomSelect($('#fStatusSelect'), () => {
    const val = $('#fStatusSelect').dataset.value;
    $('#fStatus').value = val;
    const dot = $('#fStatusSelect').querySelector('.cs-trigger .cs-dot');
    if (dot) dot.style.background = statusColors[val];
  });
}

function openModal(q, presetTopic) {
  editingId = q ? q.id : null;
  $('#modalTitle').textContent = q ? 'Edit Question' : 'Add Question';
  $('#fTitle').value = q ? q.title : '';
  $('#fLink').value = q ? q.link : '';
  $('#fDifficulty').value = q ? q.difficulty : 'medium';
  $('#fTopic').value = q ? q.topic : (presetTopic || '');
  dpSetValue(q ? q.date_solved : indiaDateKey());
  const statusVal = q ? q.status : 'solved';
  $('#fStatus').value = statusVal;
  const statusColors = { solved: 'var(--green)', revisit: 'var(--orange)', todo: 'var(--text-3)' };
  const statusLabels = { solved: 'Solved', revisit: 'Revisit', todo: 'Todo' };
  const statusSel = $('#fStatusSelect');
  statusSel.dataset.value = statusVal;
  statusSel.querySelectorAll('.cs-option').forEach(o => o.classList.toggle('selected', o.dataset.value === statusVal));
  statusSel.querySelector('.cs-label').textContent = statusLabels[statusVal];
  statusSel.querySelector('.cs-trigger .cs-dot').style.background = statusColors[statusVal];
  $('#fNotes').value = q ? q.notes : '';
  $('#fVideoLink').value = q ? (q.video_link || '') : '';
  $('#fCode').value = q ? (q.code || '') : '';

  $$('#segDifficulty .seg-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.val === (q ? q.difficulty : 'medium'));
  });
  updateSegIndicator($('#segDifficulty'));

  modalBackdrop.classList.add('open');
  setTimeout(() => $('#fTitle').focus(), 100);
}

function closeModal() {
  modalBackdrop.classList.remove('open');
  dpPicker.classList.remove('open');
  editingId = null;
}
window.closeModal = closeModal;

async function saveQuestion() {
  const data = {
    title: $('#fTitle').value.trim(),
    link: $('#fLink').value.trim(),
    platform: detectPlatform($('#fLink').value.trim()),
    difficulty: $('#fDifficulty').value,
    topic: $('#fTopic').value.trim(),
    date_solved: $('#fDate').value,
    status: $('#fStatus').value,
    notes: $('#fNotes').value.trim(),
    video_link: $('#fVideoLink').value.trim(),
    code: $('#fCode').value,
  };
  if (!data.title) return;
  if (!data.topic) { showToast('Please enter a topic'); return; }

  if (editingId) {
    await api(`/api/${currentSubject}/questions/${editingId}`, 'PUT', data);
    showToast('Question updated');
  } else {
    await api(`/api/${currentSubject}/questions`, 'POST', data);
    if (data.status === 'solved' || data.status === 'revisit') {
      const xp = XP_MAP[data.difficulty] || 0;
      showXpPopup(xp);
    }
    showToast('Question added');
  }

  closeModal();
  await loadSubject(currentSubject);
  await refreshNavCounts();
}

async function refreshNavCounts() {
  const subs = await api('/api/subjects');
  subs.forEach(s => {
    const tab = navTabs.querySelector(`.nav-tab[data-subject="${s.id}"]`);
    if (tab) {
      const countEl = tab.querySelector('.tab-count');
      if (countEl) countEl.textContent = `${s.solved}/${s.total}`;
    }
  });
}

function editQuestion(id) {
  const q = subjectQuestions.find(q => q.id === id);
  if (q) openModal(q);
}
window.editQuestion = editQuestion;

async function deleteQuestion(id) {
  if (!confirm('Delete this question?')) return;
  await api(`/api/${currentSubject}/questions/${id}`, 'DELETE');
  showToast('Question deleted');
  await loadSubject(currentSubject);
  await refreshNavCounts();
}
window.deleteQuestion = deleteQuestion;

/* ── Segmented control ─────────────────────────────────────────── */
function setupSegmented() {
  const seg = $('#segDifficulty');
  seg.querySelectorAll('.seg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      seg.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      $('#fDifficulty').value = btn.dataset.val;
      updateSegIndicator(seg);
    });
  });
  requestAnimationFrame(() => updateSegIndicator(seg));
  new ResizeObserver(() => updateSegIndicator(seg)).observe(seg);
}

function updateSegIndicator(seg) {
  const active = seg.querySelector('.seg-btn.active');
  const indicator = seg.querySelector('.seg-indicator');
  if (!active || !indicator) return;
  indicator.style.left = active.offsetLeft + 'px';
  indicator.style.width = active.offsetWidth + 'px';
}

/* ── Toast ─────────────────────────────────────────────────────── */
let toastTimer;
function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

/* ── XP popup ──────────────────────────────────────────────────── */
function showXpPopup(xp) {
  if (!xp) return;
  xpPopup.textContent = `+${xp} XP`;
  xpPopup.className = 'xp-popup show';
  setTimeout(() => { xpPopup.className = 'xp-popup fade'; }, 800);
  setTimeout(() => { xpPopup.className = 'xp-popup'; }, 1400);
}

/* ── Helpers ────────────────────────────────────────────────────── */
async function api(url, method = 'GET', body) {
  const opts = { method, headers: {} };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

function esc(s) {
  if (!s) return '';
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function cap(s) {
  if (!s) return '';
  const d = DIFFS.find(d => d.key === s);
  if (d) return d.label;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function diffColor(key) {
  const d = DIFFS.find(d => d.key === key);
  return d ? d.color : 'var(--text-3)';
}

function diffBg(key) {
  const d = DIFFS.find(d => d.key === key);
  return d ? d.bg : 'transparent';
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
