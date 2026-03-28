/* ═══════════════════════════════════════════
   SHIELDGIG — PARAMETRIC INSURANCE ENGINE
   main.js
═══════════════════════════════════════════ */

'use strict';

// ────────────────────────────────────────────
//  STATE
// ────────────────────────────────────────────
const State = {
  sidebarCollapsed: false,
  currentPage: 'home',
  totalClaims: 0,
  totalPayout: 0,
  alertQueue: [],
  alertShowing: false,
  pricingMode: 'weekly',  // 'weekly' | 'monthly'
  selectedPlan: null,
  mapBuilt: false,
  chartsBuilt: false,

  // Live sensor readings
  sensors: {
    rain:    22,
    aqi:     210,
    traffic: 55,
    heat:    36,
    wind:    28,
  },
};

// ────────────────────────────────────────────
//  TRIGGER DEFINITIONS
// ────────────────────────────────────────────
const TRIGGERS = [
  {
    id: 'rain',
    icon: '🌧️',
    name: 'Rainfall Level',
    cond: 'Fires if > 50 mm',
    tiClass: 'ti-rain',
    unit: 'mm',
    threshold: 50,
    payout: 750,
    plan: 'Storm Shield / Air Guard',
  },
  {
    id: 'aqi',
    icon: '☁️',
    name: 'Air Quality Index',
    cond: 'Fires if > 300 AQI',
    tiClass: 'ti-aqi',
    unit: 'AQI',
    threshold: 300,
    payout: 750,
    plan: 'Air Guard',
  },
  {
    id: 'traffic',
    icon: '🚦',
    name: 'Traffic Disruption',
    cond: 'Fires if > 80 % congestion',
    tiClass: 'ti-traffic',
    unit: '%',
    threshold: 80,
    payout: 1000,
    plan: 'Road Warrior',
  },
  {
    id: 'heat',
    icon: '🌡️',
    name: 'Heat Index',
    cond: 'Fires if > 42 °C',
    tiClass: 'ti-heat',
    unit: '°C',
    threshold: 42,
    payout: 700,
    plan: 'Heat Shield',
  },
  {
    id: 'wind',
    icon: '💨',
    name: 'Wind Speed',
    cond: 'Fires if > 60 km/h',
    tiClass: 'ti-wind',
    unit: 'km/h',
    threshold: 60,
    payout: 500,
    plan: 'Storm Shield',
  },
];

// ────────────────────────────────────────────
//  SIDEBAR TOGGLE
// ────────────────────────────────────────────
function initSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main    = document.getElementById('main');
  const toggleBtn = document.getElementById('sidebarToggle');

  toggleBtn.addEventListener('click', () => {
    State.sidebarCollapsed = !State.sidebarCollapsed;
    sidebar.classList.toggle('collapsed', State.sidebarCollapsed);
    main.classList.toggle('collapsed', State.sidebarCollapsed);
    toggleBtn.textContent = State.sidebarCollapsed ? '›' : '‹';
  });

  // Nav item click
  document.querySelectorAll('.nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      const page = item.dataset.page;
      navigateTo(page);
    });
  });
}

// ────────────────────────────────────────────
//  NAVIGATION
// ────────────────────────────────────────────
function navigateTo(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target page
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');

  // Activate nav item
  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem) navItem.classList.add('active');

  State.currentPage = pageId;

  // Lazy init
  if (pageId === 'risk'      && !State.mapBuilt)    buildRiskMap();
  if (pageId === 'analytics' && !State.chartsBuilt) buildCharts();
}

// ────────────────────────────────────────────
//  LIVE CLOCK
// ────────────────────────────────────────────
function initClock() {
  const el = document.getElementById('liveTime');
  const tick = () => {
    el.textContent = new Date().toTimeString().slice(0, 8);
  };
  tick();
  setInterval(tick, 1000);
}

// ────────────────────────────────────────────
//  SENSOR SIMULATION
// ────────────────────────────────────────────
function drift(val, min, max, speed, biasDown = 0.45) {
  return Math.max(min, Math.min(max, val + (Math.random() - biasDown) * speed));
}

function simulateSensors() {
  const s = State.sensors;
  s.rain    = drift(s.rain,    0,  120, 9);
  s.aqi     = drift(s.aqi,    50,  450, 22);
  s.traffic = drift(s.traffic, 10, 100, 11);
  s.heat    = drift(s.heat,   28,   48, 1.2);
  s.wind    = drift(s.wind,    0,  100, 9);
}

// ────────────────────────────────────────────
//  TRIGGER ENGINE — render list
// ────────────────────────────────────────────
function renderTriggers() {
  const list = document.getElementById('triggerList');
  if (!list) return;

  list.innerHTML = '';

  TRIGGERS.forEach(t => {
    const val    = State.sensors[t.id];
    const fired  = val >= t.threshold;
    const near   = !fired && val >= t.threshold * 0.85;

    let statusClass = 'ts-safe', statusText = '● Safe';
    if (fired) { statusClass = 'ts-fire'; statusText = '⚡ TRIGGERED'; }
    else if (near) { statusClass = 'ts-warn'; statusText = '⚠ Near Limit'; }

    const el = document.createElement('div');
    el.className = `trigger-item${fired ? ' firing' : ''}${near ? ' warning' : ''}`;
    el.innerHTML = `
      <div class="trigger-left">
        <div class="trigger-icon ${t.tiClass}">${t.icon}</div>
        <div>
          <div class="trigger-name">${t.name}</div>
          <div class="trigger-cond">${t.cond} · ${t.plan}</div>
        </div>
      </div>
      <div class="trigger-right">
        <div class="trigger-value">${Math.round(val)}<span class="unit">${t.unit}</span></div>
        <div class="trigger-status ${statusClass}">
          <div class="ts-dot"></div>${statusText}
        </div>
      </div>`;
    list.appendChild(el);
  });
}

// ────────────────────────────────────────────
//  AUTO-CLAIM GENERATION
// ────────────────────────────────────────────
function checkAndFire() {
  TRIGGERS.forEach(t => {
    const val = State.sensors[t.id];
    if (val >= t.threshold && Math.random() < 0.14) {
      fireAutoClaim(t, val);
    }
  });
}

function fireAutoClaim(trigger, val) {
  State.totalClaims++;
  State.totalPayout += trigger.payout;

  updateMetrics();
  addClaimToFeed(trigger, val);
  animateAutoFlow();
  enqueueAlert(trigger, val);
  triggerPayoutFlash();
}

function updateMetrics() {
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('m-claims',  State.totalClaims);
  set('m-payout',  '₹' + State.totalPayout.toLocaleString('en-IN'));
  set('home-claims', State.totalClaims);
}

function addClaimToFeed(trigger, val) {
  const feed = document.getElementById('claimFeed');
  if (!feed) return;

  // Clear placeholder
  const placeholder = feed.querySelector('.feed-placeholder');
  if (placeholder) placeholder.remove();

  const now = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const secs = Math.floor(Math.random() * 42) + 12;

  const el = document.createElement('div');
  el.className = 'claim-item auto';
  el.innerHTML = `
    <div class="claim-top">
      <div class="claim-title">${trigger.icon} ${trigger.name} <span class="badge badge-auto">AUTO</span></div>
      <div class="claim-amount">₹${trigger.payout.toLocaleString('en-IN')}</div>
    </div>
    <div class="claim-meta">
      <span>${now}</span>
      <span>Detected: ${Math.round(val)} ${trigger.unit}</span>
      <span class="claim-paid">✓ Paid in ${secs}s</span>
    </div>`;
  feed.prepend(el);
  if (feed.children.length > 25) feed.lastElementChild.remove();
}

// ────────────────────────────────────────────
//  AUTO-FLOW ANIMATION
// ────────────────────────────────────────────
function animateAutoFlow() {
  const ids = ['af1', 'af2', 'af3', 'af4', 'af5'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('done');
  });
  ids.forEach((id, i) => {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.classList.add('done');
    }, i * 280);
  });
}

// ────────────────────────────────────────────
//  AI RISK BARS
// ────────────────────────────────────────────
function updateRiskBars() {
  const s = State.sensors;
  const set = (labelId, barId, val) => {
    const lEl = document.getElementById(labelId);
    const bEl = document.getElementById(barId);
    if (lEl) lEl.textContent = val + '%';
    if (bEl) bEl.style.width = val + '%';
  };

  set('riskRainLabel',    'riskRainBar',    Math.round((s.rain / 120) * 100));
  set('riskAqiLabel',     'riskAqiBar',     Math.round((s.aqi  / 450) * 100));
  set('riskTrafficLabel', 'riskTrafficBar', Math.round(s.traffic));
  set('riskPlatformLabel','riskPlatformBar',Math.round(12 + Math.random() * 8));
}

// ────────────────────────────────────────────
//  ALERT TOAST
// ────────────────────────────────────────────
function enqueueAlert(trigger, val) {
  State.alertQueue.push({ trigger, val });
  if (!State.alertShowing) showNextAlert();
}

function showNextAlert() {
  if (State.alertQueue.length === 0) { State.alertShowing = false; return; }
  State.alertShowing = true;
  const { trigger, val } = State.alertQueue.shift();

  const toast = document.getElementById('liveAlert');
  document.getElementById('alertIcon').textContent   = trigger.icon;
  document.getElementById('alertTitle').textContent  = '⚡ Parametric Trigger Fired!';
  document.getElementById('alertBody').textContent   =
    `${trigger.name} reached ${Math.round(val)} ${trigger.unit} (threshold: ${trigger.threshold}). Auto-claim generated — no action needed.`;
  document.getElementById('alertPayout').textContent = `₹${trigger.payout.toLocaleString('en-IN')} → Credited instantly`;

  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(showNextAlert, 400);
  }, 4200);
}

function closeAlert() {
  document.getElementById('liveAlert').classList.remove('show');
  State.alertShowing = false;
  setTimeout(showNextAlert, 400);
}

// ────────────────────────────────────────────
//  PAYOUT FLASH
// ────────────────────────────────────────────
function triggerPayoutFlash() {
  const f = document.getElementById('payoutFlash');
  if (!f) return;
  f.style.display = 'block';
  f.style.animation = 'none';
  // Force reflow
  void f.offsetWidth;
  f.style.animation = 'flashFade 0.9s ease forwards';
  setTimeout(() => { f.style.display = 'none'; }, 950);
}

// ────────────────────────────────────────────
//  RISK MAP
// ────────────────────────────────────────────
function buildRiskMap() {
  const map = document.getElementById('riskMap');
  if (!map) return;
  map.innerHTML = '';

  const levels = ['low', 'low', 'low', 'medium', 'medium', 'high', 'critical'];
  const counts  = { low: 0, medium: 0, high: 0, critical: 0 };

  for (let i = 0; i < 128; i++) {
    const lvl  = levels[Math.floor(Math.random() * levels.length)];
    const cell = document.createElement('div');
    cell.className = `map-cell ${lvl}`;
    cell.title     = lvl.toUpperCase() + ' RISK';
    counts[lvl]++;
    map.appendChild(cell);
  }

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('zLow',  counts.low);
  set('zMed',  counts.medium);
  set('zHigh', counts.high);
  set('zCrit', counts.critical);

  State.mapBuilt = true;
}

// ────────────────────────────────────────────
//  CHARTS
// ────────────────────────────────────────────
function buildCharts() {
  buildBarChart('claimsChart',  [8,12,42,19,6,23,31,14,9,28,35,11,17,22],  'bar-accent');
  buildBarChart('payoutChart',  [4,6,21,9,3,11,15,7,4,14,17,5,8,11],       'bar-purple', 'bar-orange');
  buildBarChart('triggerChart', [12,27,8,15,34,22,9,16,30,19,12,25,18,10], 'bar-blue');
  State.chartsBuilt = true;
}

function buildBarChart(containerId, data, ...colorClasses) {
  const el = document.getElementById(containerId);
  if (!el || el.children.length > 0) return;
  const max = Math.max(...data);
  data.forEach((v, i) => {
    const bar = document.createElement('div');
    bar.className = 'chart-bar ' + colorClasses[i % colorClasses.length];
    bar.style.height = ((v / max) * 100) + '%';
    el.appendChild(bar);
  });
}

// ────────────────────────────────────────────
//  PLAN SELECTION
// ────────────────────────────────────────────
function selectPlan(cardEl, planName) {
  // Reset all
  document.querySelectorAll('.plan-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.btn-plan').forEach(b => {
    b.classList.remove('chosen');
    b.textContent = 'Activate Coverage';
  });

  // Select this
  cardEl.classList.add('selected');
  const btn = cardEl.querySelector('.btn-plan');
  if (btn) { btn.classList.add('chosen'); btn.textContent = '✓ Active — Coverage Running'; }

  State.selectedPlan = planName;

  // Navigate to dashboard after short delay
  setTimeout(() => navigateTo('dashboard'), 700);
}

// ────────────────────────────────────────────
//  PRICING TOGGLE
// ────────────────────────────────────────────
const WEEKLY_PRICES = [20, 35, 45, 25, 30, 75];

function setPricing(mode) {
  State.pricingMode = mode;

  document.querySelectorAll('.pt-opt').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`.pt-opt[data-mode="${mode}"]`).forEach(b => b.classList.add('active'));

  const amounts = document.querySelectorAll('.plan-price .amount');
  const freqs   = document.querySelectorAll('.plan-price .freq strong');

  amounts.forEach((el, i) => {
    const weekly = WEEKLY_PRICES[i] || WEEKLY_PRICES[0];
    el.textContent = '₹' + (mode === 'monthly' ? Math.round(weekly * 4 * 0.8) : weekly);
  });

  freqs.forEach(el => {
    el.textContent = mode === 'monthly' ? 'month' : 'week';
  });
}

// ────────────────────────────────────────────
//  MAIN LOOP
// ────────────────────────────────────────────
function mainLoop() {
  simulateSensors();
  renderTriggers();
  checkAndFire();
  updateRiskBars();
}

// ────────────────────────────────────────────
//  BOOT
// ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initClock();
  renderTriggers();

  // Prime demo triggers after short delay
  setTimeout(() => {
    State.sensors.rain = 73;
    State.sensors.aqi  = 325;
    mainLoop();
  }, 1800);

  setTimeout(() => {
    State.sensors.wind = 68;
    mainLoop();
  }, 5000);

  // Recurring loop every 3.2s
  setInterval(mainLoop, 3200);

  // Expose globally (for inline onclick in HTML)
  window.navigateTo  = navigateTo;
  window.closeAlert  = closeAlert;
  window.selectPlan  = selectPlan;
  window.setPricing  = setPricing;
});