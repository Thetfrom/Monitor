// TAMEYO Monitor — App Logic
// Vanilla JS SPA: postMessage auth bridge, routing, all screen renderers

(function () {
  'use strict';

  // ── STATE ────────────────────────────────────────────────────────────
  let state = {
    auth: null,       // { subscriberId, plan, status, businessName }
    data: null,       // { masterRecord, snapshots }
    route: 'overview',
    upgradeContext: null,
    trendRange: '3',
    benchmarkOn: false,
    charts: {},       // Chart.js instances keyed by id
  };

  const ALLOWED_ORIGIN = 'https://www.tameyogroup.com';

  // Set this to your Make.com Full Data Read webhook URL once configured.
  // See wix/backend/subscriberLookup.jsw and VELO_BRIDGE setup guide.
  const MAKE_READ_ENDPOINT = '';

  // ── BOOT ─────────────────────────────────────────────────────────────
  function boot() {
    setLogos();

    const mock = getMockConfig();
    if (mock) {
      state.auth = {
        subscriberId: mock.masterRecord.subscriber_id,
        plan: mock.masterRecord.plan,
        status: mock.masterRecord.status,
        businessName: mock.masterRecord.business_name,
      };
      state.data = mock;
      onDataReady();
      return;
    }

    // Real postMessage flow — signal readiness to Wix Velo bridge
    window.parent.postMessage({ type: 'ready' }, ALLOWED_ORIGIN);

    // Timeout after 10s with no auth payload → show no-account screen
    const timeout = setTimeout(() => showScreen('screen-no-account'), 10000);

    window.addEventListener('message', function handler(e) {
      if (e.origin !== ALLOWED_ORIGIN) return;
      const msg = e.data;
      if (!msg) return;

      // auth_error from Velo bridge (subscriber not found or session expired)
      if (msg.type === 'auth_error') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        if (msg.reason === 'session_expired') {
          showScreen('screen-session-expired');
        } else {
          showScreen('screen-no-account');
        }
        return;
      }

      if (msg.type !== 'auth') return;
      clearTimeout(timeout);
      window.removeEventListener('message', handler);

      state.auth = {
        subscriberId: msg.subscriberId,
        plan: msg.plan,
        status: msg.status,
        businessName: msg.businessName,
      };
      fetchSubscriberData(msg.subscriberId);
    });
  }

  function setLogos() {
    document.getElementById('loading-logo-img').src = LOGO_WHITE_B64;
    document.getElementById('no-account-logo').src = LOGO_WHITE_B64;
    document.getElementById('expired-logo').src = LOGO_WHITE_B64;
    document.getElementById('nav-logo-img').src = LOGO_WHITE_B64;
  }

  function fetchSubscriberData(subscriberId) {
    showScreen('screen-loading');

    if (!MAKE_READ_ENDPOINT) {
      console.warn('MAKE_READ_ENDPOINT not set in app.js — cannot load subscriber data.');
      showScreen('screen-no-account');
      return;
    }

    fetch(MAKE_READ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriber_id: subscriberId }),
    })
      .then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(json => {
        if (!json || !json.masterRecord) throw new Error('Invalid payload');
        state.data = json;
        onDataReady();
      })
      .catch(err => {
        console.error('Failed to load subscriber data:', err);
        showScreen('screen-no-account');
      });
  }

  function onDataReady() {
    const { masterRecord, snapshots } = state.data;
    const plan = masterRecord.plan;
    const status = masterRecord.status;

    // Reactivation wall for cancelled
    if (status === 'cancelled') {
      buildNav();
      showScreen('app-shell');
      navigateTo('reactivation');
      return;
    }

    // Show onboarding if first visit and no session flag
    const onboardingSeen = sessionStorage.getItem('onboarding_seen_' + masterRecord.subscriber_id);
    if (!onboardingSeen && snapshots.length === 0) {
      buildNav();
      showScreen('app-shell');
      renderOnboarding();
      showPage('onboarding');
      return;
    }

    buildNav();
    showScreen('app-shell');

    // Check for first visit (report #1, no onboarding seen yet)
    if (!onboardingSeen && snapshots.length === 1) {
      renderOnboarding();
      showPage('onboarding');
      return;
    }

    navigateTo('overview');
  }

  // ── SCREEN VISIBILITY ────────────────────────────────────────────────
  // name should be the full element id, e.g. 'screen-loading', 'app-shell'
  function showScreen(name) {
    ['screen-loading', 'screen-no-account', 'screen-session-expired', 'app-shell'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(name);
    if (target) target.classList.remove('hidden');
  }

  function showPage(name) {
    const pages = ['overview','signals','trends','compare','reports','actions',
                   'competitors','ai','social','upgrade','settings','onboarding','reactivation'];
    pages.forEach(p => {
      const el = document.getElementById('screen-' + p);
      if (el) el.classList.add('hidden');
    });
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.remove('hidden');
    state.route = name;
    updateNavActive();
  }

  // ── NAVIGATION ───────────────────────────────────────────────────────
  const NAV_ITEMS = [
    { id: 'overview',     label: 'Overview',     icon: 'ti-home',          tiers: ['lite','pro','agency'] },
    { id: 'signals',      label: 'Signals',      icon: 'ti-antenna',       tiers: ['lite','pro','agency'] },
    { id: 'trends',       label: 'Trends',       icon: 'ti-trending-up',   tiers: ['pro','agency'],  lockFor: ['lite'] },
    { id: 'compare',      label: 'Compare',      icon: 'ti-arrows-diff',   tiers: ['pro','agency'],  lockFor: ['lite'] },
    { id: 'reports',      label: 'Reports',      icon: 'ti-file-text',     tiers: ['lite','pro','agency'] },
    { id: 'actions',      label: 'Actions',      icon: 'ti-checklist',     tiers: ['pro','agency'],  lockFor: ['lite'] },
    { id: 'competitors',  label: 'Competitors',  icon: 'ti-swords',        tiers: ['agency'],        lockFor: ['lite','pro'] },
    { id: 'ai',           label: 'AI Visibility',icon: 'ti-brain',         tiers: ['agency'],        lockFor: ['lite','pro'] },
    { id: 'social',       label: 'Social',       icon: 'ti-heart',         tiers: ['agency'],        lockFor: ['lite','pro'] },
    { id: 'settings',     label: 'Settings',     icon: 'ti-settings',      tiers: ['lite','pro','agency'] },
  ];

  function buildNav() {
    const plan = state.data.masterRecord.plan;
    const status = state.data.masterRecord.status;
    const snapshots = state.data.snapshots;

    // Business name
    document.getElementById('nav-business-name').textContent = state.data.masterRecord.business_name;

    // Streak
    document.getElementById('streak-label').textContent = 'Month ' + snapshots.length;

    // Plan badge
    const badge = document.getElementById('plan-badge');
    badge.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
    badge.className = 'plan-badge ' + plan;

    // Upgrade button
    const upgradeBtn = document.getElementById('nav-upgrade-btn');
    if (plan !== 'agency' && status === 'active') {
      upgradeBtn.classList.remove('hidden');
      upgradeBtn.addEventListener('click', () => navigateTo('upgrade', { context: 'nav' }));
    }

    // Build tabs
    const container = document.getElementById('nav-tabs');
    container.innerHTML = '';
    NAV_ITEMS.forEach(item => {
      const isLocked = item.lockFor && item.lockFor.includes(plan);
      const btn = document.createElement('button');
      btn.className = 'nav-tab' + (isLocked ? ' locked' : '');
      btn.dataset.route = item.id;
      btn.innerHTML = `<i class="ti ${item.icon}"></i>${item.label}${isLocked ? ' <i class="ti ti-lock" style="font-size:11px;opacity:0.55"></i>' : ''}`;
      btn.addEventListener('click', () => {
        if (isLocked) {
          navigateTo('upgrade', { context: item.label });
        } else {
          navigateTo(item.id);
        }
      });
      container.appendChild(btn);
    });
  }

  function updateNavActive() {
    document.querySelectorAll('.nav-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.route === state.route);
    });
  }

  function navigateTo(route, opts) {
    state.route = route;
    destroyCharts();

    if (route === 'upgrade') {
      state.upgradeContext = opts && opts.context ? opts.context : 'feature';
      renderUpgrade();
      showPage('upgrade');
      return;
    }
    if (route === 'reactivation') {
      renderReactivation();
      showPage('reactivation');
      return;
    }

    showPage(route);

    switch (route) {
      case 'overview':     renderOverview();     break;
      case 'signals':      renderSignals();      break;
      case 'trends':       renderTrends();       break;
      case 'compare':      renderCompare();      break;
      case 'reports':      renderReports();      break;
      case 'actions':      renderActions();      break;
      case 'competitors':  renderCompetitors();  break;
      case 'ai':           renderAI();           break;
      case 'social':       renderSocial();       break;
      case 'settings':     renderSettings();     break;
    }
  }

  function destroyCharts() {
    Object.values(state.charts).forEach(c => { try { c.destroy(); } catch(e) {} });
    state.charts = {};
  }

  // ── DATA HELPERS ─────────────────────────────────────────────────────
  function latest() {
    const s = state.data.snapshots;
    return s[s.length - 1];
  }

  function prev() {
    const s = state.data.snapshots;
    return s.length >= 2 ? s[s.length - 2] : null;
  }

  function fmtVal(v, suffix) {
    if (v === null || v === undefined) return '<span class="null-value">—</span>';
    return (suffix ? v + suffix : v);
  }

  function deltaClass(d, lowerIsBetter) {
    if (d === null || d === undefined || d === 0) return 'same';
    if (lowerIsBetter) return d < 0 ? 'up' : 'down';
    return d > 0 ? 'up' : 'down';
  }

  function deltaArrow(d, lowerIsBetter) {
    if (d === null || d === undefined || d === 0) return '→ 0';
    if (lowerIsBetter) {
      return d < 0 ? `↑ ${Math.abs(d)}` : `↓ ${Math.abs(d)}`;
    }
    return d > 0 ? `↑ ${d}` : `↓ ${Math.abs(d)}`;
  }

  function calcDelta(curr, prevSnap, field) {
    if (!prevSnap) return null;
    const a = prevSnap[field], b = curr[field];
    if (a === null || a === undefined || b === null || b === undefined) return null;
    const d = b - a;
    return Math.round(d * 10) / 10;
  }

  function ragStatus(field, value) {
    if (value === null || value === undefined) return 'gray';
    const thresholds = {
      maps_rank_kw1: [3, 10, 20],
      maps_rank_kw2: [3, 10, 20],
      maps_rank_kw3: [3, 10, 20],
      mobile_pagespeed: [90, 70, 50],
      desktop_pagespeed: [90, 70, 50],
      gbp_completeness_pct: [95, 75, 50],
      google_star_rating: [4.7, 4.3, 3.8],
      domain_authority: [50, 30, 15],
      onpage_seo_score: [85, 70, 50],
      trustpilot_rating: [4.7, 4.3, 3.8],
      instagram_engagement_rate: [5, 2, 1],
      facebook_page_score: [80, 60, 40],
      organic_rank_kw1: [3, 10, 20],
    };
    const lowerBetter = ['maps_rank_kw1','maps_rank_kw2','maps_rank_kw3','organic_rank_kw1','organic_rank_kw2','organic_rank_kw3'];
    if (lowerBetter.includes(field)) {
      const [g, a] = thresholds[field] || [3, 10, 20];
      if (value <= g) return 'green';
      if (value <= a) return 'amber';
      return 'red';
    }
    const t = thresholds[field];
    if (!t) return 'amber';
    const [g, a] = t;
    if (value >= g) return 'green';
    if (value >= a) return 'amber';
    return 'red';
  }

  // Presence score calculation
  function calcPresenceScore(snapshot, plan) {
    const fields = getSignalFields(plan, snapshot);
    let total = 0, count = 0;
    fields.forEach(f => {
      const v = snapshot[f.field];
      if (v === null || v === undefined) return;
      const score = scoreSignal(f.field, v);
      total += score;
      count++;
    });
    return count > 0 ? Math.round(total / count) : 0;
  }

  function scoreSignal(field, value) {
    const lowerBetter = ['maps_rank_kw1','maps_rank_kw2','maps_rank_kw3','organic_rank_kw1','organic_rank_kw2','organic_rank_kw3'];
    const maxes = {
      maps_rank_kw1: 25, maps_rank_kw2: 25, maps_rank_kw3: 25,
      mobile_pagespeed: 100, desktop_pagespeed: 100,
      gbp_completeness_pct: 100, google_star_rating: 5,
      google_review_count: 500, domain_authority: 100,
      onpage_seo_score: 100, trustpilot_rating: 5,
      instagram_engagement_rate: 10, facebook_page_score: 100,
      organic_rank_kw1: 25, organic_rank_kw2: 25, organic_rank_kw3: 25,
    };
    if (lowerBetter.includes(field)) {
      const max = maxes[field] || 25;
      return Math.max(0, Math.min(100, ((max - value) / (max - 1)) * 100));
    }
    const max = maxes[field] || 100;
    return Math.min(100, (value / max) * 100);
  }

  function getSignalFields(plan, snapshot) {
    const base = [
      { field: 'maps_rank_kw1',      label: 'Maps Rank KW1',       lowerBetter: true },
      { field: 'gbp_completeness_pct',label: 'GBP Completeness',   suffix: '%' },
      { field: 'google_star_rating',  label: 'Google Rating',       suffix: '★' },
      { field: 'mobile_pagespeed',    label: 'Mobile PageSpeed',    suffix: '' },
    ];
    const pro = [
      { field: 'maps_rank_kw2',       label: 'Maps Rank KW2',       lowerBetter: true },
      { field: 'maps_rank_kw3',       label: 'Maps Rank KW3',       lowerBetter: true },
      { field: 'desktop_pagespeed',   label: 'Desktop PageSpeed',   suffix: '' },
      { field: 'trustpilot_rating',   label: 'Trustpilot Rating',   suffix: '★' },
      { field: 'domain_authority',    label: 'Domain Authority',    suffix: '' },
      { field: 'onpage_seo_score',    label: 'On-Page SEO',         suffix: '' },
      { field: 'google_review_count', label: 'Google Reviews',      suffix: '' },
    ];
    const agency = [
      { field: 'backlinks_total',          label: 'Backlinks',            suffix: '' },
      { field: 'organic_rank_kw1',         label: 'Organic Rank KW1',     lowerBetter: true },
      { field: 'organic_rank_kw2',         label: 'Organic Rank KW2',     lowerBetter: true },
      { field: 'organic_rank_kw3',         label: 'Organic Rank KW3',     lowerBetter: true },
      { field: 'instagram_engagement_rate',label: 'Instagram Engagement', suffix: '%' },
      { field: 'facebook_page_score',      label: 'Facebook Score',       suffix: '' },
    ];
    if (plan === 'lite') return base;
    if (plan === 'pro') return [...base, ...pro];
    return [...base, ...pro, ...agency];
  }

  function isNewReport(snapshot) {
    if (!snapshot) return false;
    const d = new Date(snapshot.snapshot_date);
    const now = new Date();
    return (now - d) < 48 * 60 * 60 * 1000;
  }

  function monthLabel(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  function daysUntilNext(runDay) {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), runDay);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    const diff = Math.ceil((next - now) / (1000 * 60 * 60 * 24));
    return diff;
  }

  // ── S-17: ONBOARDING ─────────────────────────────────────────────────
  function renderOnboarding() {
    const mr = state.data.masterRecord;
    const plan = mr.plan;
    const runDay = mr.run_day;
    const nextDate = (() => {
      const now = new Date();
      const d = new Date(now.getFullYear(), now.getMonth(), runDay);
      if (d <= now) d.setMonth(d.getMonth() + 1);
      return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    })();

    const details = document.getElementById('onboarding-details');
    details.innerHTML = `
      <div class="onboarding-detail-row">
        <span class="onboarding-detail-label">Website</span>
        <span class="onboarding-detail-value">${mr.website_url}</span>
      </div>
      <div class="onboarding-detail-row">
        <span class="onboarding-detail-label">Primary keyword</span>
        <span class="onboarding-detail-value">${mr.target_keyword_1}</span>
      </div>
      ${mr.target_keyword_2 ? `<div class="onboarding-detail-row">
        <span class="onboarding-detail-label">Keyword 2</span>
        <span class="onboarding-detail-value">${mr.target_keyword_2}</span>
      </div>` : ''}
      ${mr.target_keyword_3 ? `<div class="onboarding-detail-row">
        <span class="onboarding-detail-label">Keyword 3</span>
        <span class="onboarding-detail-value">${mr.target_keyword_3}</span>
      </div>` : ''}
      <div class="onboarding-detail-row">
        <span class="onboarding-detail-label">Plan</span>
        <span class="onboarding-detail-value">${plan.charAt(0).toUpperCase() + plan.slice(1)}</span>
      </div>
      <div class="onboarding-detail-row">
        <span class="onboarding-detail-label">First report date</span>
        <span class="onboarding-detail-value">${nextDate}</span>
      </div>
      <div class="onboarding-detail-row">
        <span class="onboarding-detail-label">Delivery email</span>
        <span class="onboarding-detail-value">${mr.email}</span>
      </div>
    `;

    document.getElementById('btn-got-it').onclick = () => {
      sessionStorage.setItem('onboarding_seen_' + mr.subscriber_id, '1');
      navigateTo('overview');
    };
  }

  // ── S-15: REACTIVATION ───────────────────────────────────────────────
  function renderReactivation() {
    const count = state.data.snapshots.length;
    document.getElementById('reactivation-archive-text').innerHTML =
      `You have <strong>${count} month${count !== 1 ? 's' : ''}</strong> of monitoring data in your archive.`;

    document.getElementById('btn-view-archives').onclick = () => {
      navigateTo('reports');
    };
  }

  // ── S-04: OVERVIEW ───────────────────────────────────────────────────
  function renderOverview() {
    const mr = state.data.masterRecord;
    const snapshots = state.data.snapshots;
    const plan = mr.plan;
    const status = mr.status;
    const curr = latest();
    const prevSnap = prev();
    const isFirstVisit = snapshots.length === 1;
    const newReport = isNewReport(curr);

    // Banners
    document.getElementById('overview-new-report-banner').classList.toggle('hidden', !newReport);
    document.getElementById('overview-paused-banner').classList.toggle('hidden', status !== 'paused');

    // Welcome first visit
    const welcomeEl = document.getElementById('overview-welcome');
    if (isFirstVisit) {
      welcomeEl.classList.remove('hidden');
      document.getElementById('overview-welcome-title').textContent = `Welcome, ${mr.business_name}`;
      document.getElementById('overview-welcome-sub').textContent = 'This is your first report. Deltas appear from Report #2 onwards.';
    } else {
      welcomeEl.classList.add('hidden');
    }

    // Presence Hero
    const score = calcPresenceScore(curr, plan);
    const prevScore = prevSnap ? calcPresenceScore(prevSnap, plan) : null;
    const scoreDelta = prevScore !== null ? score - prevScore : null;
    const days = daysUntilNext(mr.run_day);

    document.getElementById('presence-hero').innerHTML = `
      <div class="presence-score-block">
        <div class="presence-label">Presence Score</div>
        <div class="presence-number">${score}</div>
        ${scoreDelta !== null ? `<div class="presence-delta ${scoreDelta >= 0 ? 'delta-up' : 'delta-down'}">
          ${scoreDelta >= 0 ? '↑' : '↓'} ${Math.abs(scoreDelta)} pts from last month
        </div>` : `<div class="presence-delta delta-neutral">First report — no delta yet</div>`}
        <div class="presence-meta">Report #${curr.report_number} · ${monthLabel(curr.snapshot_date)}</div>
      </div>
      <div class="presence-right">
        <div class="report-number-badge">Report #${curr.report_number}</div>
        <div class="countdown-block">
          <div class="countdown-label">Next report in</div>
          <div class="countdown-value">${days} day${days !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `;

    // Stats row
    const lowerBetter = ['maps_rank_kw1'];
    const statsFields = [
      { field: 'maps_rank_kw1', label: 'Maps Rank', suffix: '', lowerBetter: true },
      { field: 'google_star_rating', label: 'Star Rating', suffix: '★', lowerBetter: false },
      { field: 'mobile_pagespeed', label: 'PageSpeed', suffix: '', lowerBetter: false },
      { field: 'domain_authority', label: plan === 'lite' ? 'GBP Complete' : 'Domain Auth', lowerBetter: false,
        fieldOverride: plan === 'lite' ? 'gbp_completeness_pct' : 'domain_authority',
        suffixOverride: plan === 'lite' ? '%' : '' },
    ];

    const statsRow = document.getElementById('stats-row');
    statsRow.innerHTML = statsFields.map(sf => {
      const f = sf.fieldOverride || sf.field;
      const s = sf.suffixOverride !== undefined ? sf.suffixOverride : sf.suffix;
      const v = curr[f];
      const d = calcDelta(curr, prevSnap, f);
      const dc = deltaClass(d, sf.lowerBetter);
      const arrow = d !== null ? deltaArrow(d, sf.lowerBetter) : null;
      return `
        <div class="stat-card">
          <div class="stat-label">${sf.label}</div>
          <div class="stat-value">${v !== null && v !== undefined ? v + s : '<span class="null-value">—</span>'}</div>
          ${arrow ? `<div class="stat-delta ${dc}">${arrow}</div>` : '<div class="stat-delta neutral">First report</div>'}
        </div>
      `;
    }).join('');

    // Priority action
    renderPriorityAction(curr, prevSnap, plan);

    // Signal grid (subset)
    const allFields = getSignalFields(plan, curr);
    const gridCount = plan === 'lite' ? 3 : plan === 'pro' ? 8 : 15;
    const gridFields = allFields.slice(0, gridCount);
    renderSignalCards('signal-grid-overview', gridFields, curr, prevSnap, plan, false);

    // All signals button
    document.getElementById('btn-all-signals').onclick = () => navigateTo('signals');
    document.getElementById('btn-full-trend').onclick = () => navigateTo('trends');

    // Overview chart
    const labels = snapshots.map(s => monthLabel(s.snapshot_date));
    const scores = snapshots.map(s => calcPresenceScore(s, plan));

    if (snapshots.length < 2) {
      document.getElementById('overview-chart').classList.add('hidden');
      document.getElementById('overview-chart-empty').classList.remove('hidden');
    } else {
      document.getElementById('overview-chart').classList.remove('hidden');
      document.getElementById('overview-chart-empty').classList.add('hidden');
      const last3labels = labels.slice(-3);
      const last3scores = scores.slice(-3);
      buildLineChart('overview-chart', last3labels, [{ data: last3scores, label: 'Presence Score' }]);
    }
  }

  function renderPriorityAction(curr, prevSnap, plan) {
    const container = document.getElementById('priority-action-section');
    const action = getPriorityAction(curr, prevSnap, plan);
    container.innerHTML = `
      <div class="priority-action-card">
        <div class="priority-icon"><i class="ti ${action.icon}"></i></div>
        <div class="priority-body">
          <div class="priority-tag">This Month's Priority</div>
          <div class="priority-title">${action.title}</div>
          <div class="priority-desc">${action.desc}</div>
        </div>
      </div>
    `;
  }

  function getPriorityAction(curr, prevSnap, plan) {
    // Find the weakest signal
    const fields = getSignalFields(plan, curr);
    let worst = null, worstScore = 101;
    fields.forEach(f => {
      const v = curr[f.field];
      if (v === null || v === undefined) return;
      const s = scoreSignal(f.field, v);
      if (s < worstScore) { worstScore = s; worst = f; }
    });

    if (!worst) return {
      icon: 'ti-star',
      title: 'Keep up the great work',
      desc: 'All your signals are looking strong. Continue building reviews and maintaining your GBP profile.',
    };

    const actions = {
      maps_rank_kw1: { icon: 'ti-map-pin', title: 'Improve your Google Maps ranking', desc: `Your Maps rank for "${state.data.masterRecord.target_keyword_1 || 'your keyword'}" needs attention. Add more photos, respond to all reviews, and ensure your GBP categories are accurate.` },
      mobile_pagespeed: { icon: 'ti-device-mobile', title: 'Boost your mobile page speed', desc: 'Your mobile PageSpeed score is reducing visibility. Compress images, enable lazy loading, and minimise render-blocking scripts.' },
      gbp_completeness_pct: { icon: 'ti-building-store', title: 'Complete your Google Business Profile', desc: 'Your GBP is not fully complete. Add services, products, opening hours, and a business description to improve visibility.' },
      google_star_rating: { icon: 'ti-star', title: 'Focus on earning more 5-star reviews', desc: 'Your average rating needs improvement. Follow up with recent customers and make it easy to leave a review.' },
      domain_authority: { icon: 'ti-link', title: 'Build quality backlinks', desc: 'Your domain authority is lower than competitors. Guest posts, local directory listings, and PR coverage all help.' },
      onpage_seo_score: { icon: 'ti-file-text', title: 'Improve your on-page SEO', desc: 'Key on-page elements need attention. Review title tags, meta descriptions, H1 headings, and internal linking.' },
      trustpilot_rating: { icon: 'ti-star-half', title: 'Grow your Trustpilot presence', desc: 'Your Trustpilot rating and review count can be improved. Email past customers asking them to share their experience.' },
    };

    return actions[worst.field] || {
      icon: 'ti-trending-up',
      title: `Improve your ${worst.label}`,
      desc: `This signal is currently your weakest area. Focus on this metric for the biggest score improvement.`,
    };
  }

  // ── SIGNAL CARDS RENDERER ─────────────────────────────────────────────
  function renderSignalCards(containerId, fields, curr, prevSnap, plan, showLocked) {
    const container = document.getElementById(containerId);
    let html = '';

    fields.forEach(f => {
      const v = curr[f.field];
      const d = calcDelta(curr, prevSnap, f.field);
      const rag = v !== null && v !== undefined ? ragStatus(f.field, v) : 'gray';
      const dc = deltaClass(d, f.lowerBetter);
      const suffix = f.suffix || '';
      const displayVal = v !== null && v !== undefined ? v + suffix : '—';

      html += `
        <div class="signal-card">
          <div class="signal-card-header">
            <div class="signal-name">${f.label}</div>
            <div class="rag-dot ${rag}"></div>
          </div>
          <div class="signal-value">${displayVal}</div>
          ${d !== null ? `<div class="signal-delta ${dc}"><i class="ti ${dc === 'up' ? 'ti-arrow-up' : dc === 'down' ? 'ti-arrow-down' : 'ti-minus'}"></i>${Math.abs(d)}${suffix} from last</div>` : `<div class="signal-prev">First report</div>`}
          ${prevSnap && prevSnap[f.field] !== null && prevSnap[f.field] !== undefined ? `<div class="signal-prev">Was: ${prevSnap[f.field]}${suffix}</div>` : ''}
        </div>
      `;
    });

    // Locked cards for lite
    if (showLocked && plan === 'lite') {
      const lockedCount = 5;
      for (let i = 0; i < lockedCount; i++) {
        html += `
          <div class="signal-card locked" onclick="window.__navigate('upgrade','Pro Signals')">
            <div class="signal-card-header">
              <div class="signal-name">Pro Signal</div>
              <div class="rag-dot gray"></div>
            </div>
            <div class="signal-value blurred">●●●</div>
            <div class="lock-overlay">
              <i class="ti ti-lock"></i>
              <span>Unlock with Pro</span>
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = html;
  }

  // ── S-05/S-06: SIGNALS ───────────────────────────────────────────────
  function renderSignals() {
    const mr = state.data.masterRecord;
    const plan = mr.plan;
    const curr = latest();
    const prevSnap = prev();
    const container = document.getElementById('signals-content');

    document.getElementById('signals-title').textContent = plan === 'lite' ? 'Your Signals' : 'All Signals';

    if (plan === 'lite') {
      // S-06: Lite view — 3 live + 5 locked
      container.innerHTML = `
        <div id="signal-grid-lite" class="signal-grid"></div>
      `;
      const liteFields = getSignalFields('lite', curr);
      renderSignalCards('signal-grid-lite', liteFields, curr, prevSnap, 'lite', true);
    } else {
      // S-05: Full grid
      const fields = getSignalFields(plan, curr);

      // CWV special cards
      const cwvHtml = `
        <div class="section-header"><span class="section-title">Core Web Vitals</span></div>
        <div class="signal-grid" style="margin-bottom:20px">
          ${['lcp','inp','cls'].map(cwv => {
            const key = `cwv_${cwv}_status`;
            const v = curr[key];
            const labels = { lcp: 'LCP', inp: 'INP', cls: 'CLS' };
            const rag = v === 'Pass' ? 'green' : v === 'Fail' ? 'red' : 'gray';
            return `
              <div class="signal-card">
                <div class="signal-card-header">
                  <div class="signal-name">CWV ${labels[cwv]}</div>
                  <div class="rag-dot ${rag}"></div>
                </div>
                <div class="signal-value" style="font-size:16px">${v || '—'}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      container.innerHTML = cwvHtml + `<div id="signal-grid-full" class="signal-grid"></div>`;
      renderSignalCards('signal-grid-full', fields, curr, prevSnap, plan, false);
    }
  }

  // ── S-07: TRENDS ─────────────────────────────────────────────────────
  function renderTrends() {
    const mr = state.data.masterRecord;
    const plan = mr.plan;

    if (plan === 'lite') {
      renderUpgradePrompt('screen-trends', 'Trend Charts', 'Trend charts are available on Pro and Agency plans.');
      return;
    }

    const snapshots = state.data.snapshots;
    if (snapshots.length < 2) {
      document.getElementById('trend-chart').classList.add('hidden');
      document.getElementById('trend-chart-empty').classList.remove('hidden');
    } else {
      document.getElementById('trend-chart').classList.remove('hidden');
      document.getElementById('trend-chart-empty').classList.add('hidden');
      buildTrendChart();
    }

    // Range buttons
    document.getElementById('trend-range-btns').querySelectorAll('.range-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#trend-range-btns .range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.trendRange = btn.dataset.range;
        buildTrendChart();
      });
    });

    // Benchmark toggle
    document.getElementById('benchmark-toggle').addEventListener('change', e => {
      state.benchmarkOn = e.target.checked;
      buildTrendChart();
    });

    // Sparkline accordion
    buildSparklines();
  }

  function getFilteredSnapshots() {
    const snaps = state.data.snapshots;
    const range = state.trendRange;
    if (range === 'all') return snaps;
    const months = parseInt(range);
    return snaps.slice(-months);
  }

  function buildTrendChart() {
    if (state.charts['trend-chart']) { state.charts['trend-chart'].destroy(); }
    const snaps = getFilteredSnapshots();
    const plan = state.data.masterRecord.plan;
    const labels = snaps.map(s => monthLabel(s.snapshot_date));
    const scores = snaps.map(s => calcPresenceScore(s, plan));

    const datasets = [{ data: scores, label: 'Presence Score' }];
    if (state.benchmarkOn) {
      const benchmark = scores.map(() => 58); // industry average line
      datasets.push({
        data: benchmark,
        label: 'Industry Average',
        borderDash: [6, 4],
        borderColor: 'rgba(100,100,120,0.45)',
        backgroundColor: 'transparent',
        pointRadius: 0,
      });
    }
    buildLineChart('trend-chart', labels, datasets);
  }

  function buildSparklines() {
    const plan = state.data.masterRecord.plan;
    const snapshots = state.data.snapshots;
    const fields = getSignalFields(plan, latest());
    const container = document.getElementById('sparkline-accordion');
    container.innerHTML = '';

    fields.forEach((f, i) => {
      const values = snapshots.map(s => s[f.field]).filter(v => v !== null && v !== undefined);
      const curr = latest()[f.field];
      const suffix = f.suffix || '';

      const item = document.createElement('div');
      item.className = 'sparkline-item';
      item.innerHTML = `
        <div class="sparkline-header">
          <div class="sparkline-header-left">
            <div class="rag-dot ${curr !== null && curr !== undefined ? ragStatus(f.field, curr) : 'gray'}"></div>
            <div class="sparkline-signal-name">${f.label}</div>
          </div>
          <div class="sparkline-current">${curr !== null && curr !== undefined ? curr + suffix : '—'} <i class="ti ti-chevron-down"></i></div>
        </div>
        <div class="sparkline-body" id="spark-body-${i}">
          <canvas id="spark-${i}" height="80"></canvas>
        </div>
      `;
      container.appendChild(item);

      item.querySelector('.sparkline-header').addEventListener('click', () => {
        const body = document.getElementById('spark-body-' + i);
        const isOpen = body.classList.contains('open');
        body.classList.toggle('open', !isOpen);
        if (!isOpen && values.length >= 2) {
          const spLabels = snapshots.filter(s => s[f.field] !== null && s[f.field] !== undefined)
            .map(s => monthLabel(s.snapshot_date));
          buildSparklineChart('spark-' + i, spLabels, values);
        }
      });
    });
  }

  // ── S-08: COMPARE ────────────────────────────────────────────────────
  function renderCompare() {
    const plan = state.data.masterRecord.plan;
    if (plan === 'lite') {
      renderUpgradePrompt('screen-compare', 'Compare Reports', 'Report comparison is available on Pro and Agency plans.');
      return;
    }

    const snapshots = state.data.snapshots;
    if (snapshots.length < 2) {
      document.getElementById('compare-empty').classList.remove('hidden');
      document.getElementById('compare-summary').classList.add('hidden');
      document.getElementById('compare-table').classList.add('hidden');
      document.getElementById('compare-controls').classList.add('hidden');
      return;
    }

    document.getElementById('compare-empty').classList.add('hidden');
    document.getElementById('compare-summary').classList.remove('hidden');
    document.getElementById('compare-table').classList.remove('hidden');
    document.getElementById('compare-controls').classList.remove('hidden');

    const selA = document.getElementById('compare-select-a');
    const selB = document.getElementById('compare-select-b');

    function buildOptions(sel, defaultIdx) {
      sel.innerHTML = snapshots.map((s, i) =>
        `<option value="${i}" ${i === defaultIdx ? 'selected' : ''}>Report #${s.report_number} — ${monthLabel(s.snapshot_date)}</option>`
      ).join('');
    }

    buildOptions(selA, snapshots.length - 2);
    buildOptions(selB, snapshots.length - 1);

    function updateCompare() {
      const a = snapshots[parseInt(selA.value)];
      const b = snapshots[parseInt(selB.value)];
      const scoreA = calcPresenceScore(a, plan);
      const scoreB = calcPresenceScore(b, plan);
      const scoreDiff = scoreB - scoreA;

      document.getElementById('compare-summary').innerHTML = `
        <div class="compare-score-block">
          <div class="compare-score-label">${monthLabel(a.snapshot_date)}</div>
          <div class="compare-score-value">${scoreA}</div>
        </div>
        <div class="compare-arrow">→</div>
        <div class="compare-score-block">
          <div class="compare-score-label">${monthLabel(b.snapshot_date)}</div>
          <div class="compare-score-value">${scoreB}</div>
        </div>
        <div class="compare-score-block" style="margin-left:auto">
          <div class="compare-score-label">Change</div>
          <div class="compare-score-value" style="color:${scoreDiff >= 0 ? '#7FD44B' : '#FF7070'}">${scoreDiff >= 0 ? '+' : ''}${scoreDiff}</div>
        </div>
      `;

      document.getElementById('compare-th-a').textContent = monthLabel(a.snapshot_date);
      document.getElementById('compare-th-b').textContent = monthLabel(b.snapshot_date);

      const fields = getSignalFields(plan, b);
      document.getElementById('compare-tbody').innerHTML = fields.map(f => {
        const va = a[f.field]; const vb = b[f.field];
        const suffix = f.suffix || '';
        const d = (va !== null && va !== undefined && vb !== null && vb !== undefined)
          ? Math.round((vb - va) * 10) / 10 : null;
        const dc = deltaClass(d, f.lowerBetter);
        const arrow = d !== null ? (dc === 'up' ? '↑' : dc === 'down' ? '↓' : '→') + ' ' + Math.abs(d) + suffix : '—';
        return `
          <tr>
            <td>${f.label}</td>
            <td>${va !== null && va !== undefined ? va + suffix : '—'}</td>
            <td class="td-delta ${dc}">${arrow}</td>
            <td>${vb !== null && vb !== undefined ? vb + suffix : '—'}</td>
          </tr>
        `;
      }).join('');
    }

    selA.addEventListener('change', updateCompare);
    selB.addEventListener('change', updateCompare);
    updateCompare();
  }

  // ── S-09: REPORTS ────────────────────────────────────────────────────
  function renderReports() {
    const snapshots = [...state.data.snapshots].reverse();
    const plan = state.data.masterRecord.plan;
    const status = state.data.masterRecord.status;
    const container = document.getElementById('reports-content');

    if (snapshots.length === 0) {
      const runDay = state.data.masterRecord.run_day;
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), runDay);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      const dateStr = next.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      container.innerHTML = `
        <div class="empty-state">
          <i class="ti ti-file-off"></i>
          <p>Your first report will appear here after your first monitoring run on <strong>${dateStr}</strong>.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `<div class="reports-list">${snapshots.map(s => {
      const score = calcPresenceScore(s, plan);
      const newTag = isNewReport(s) ? '<span class="new-report-tag">New</span>' : '';
      const isCancelled = status === 'cancelled';
      const dlBtn = isCancelled
        ? `<button class="btn-reactivate" onclick="window.__navigate('reactivation')">Reactivate to download</button>`
        : `<button class="btn-download"><i class="ti ti-download"></i> PDF</button>`;
      return `
        <div class="report-row">
          <div class="report-number">Report #${s.report_number}</div>
          <div class="report-date">${monthLabel(s.snapshot_date)}</div>
          <div class="report-score-block">
            <div class="report-score">${score}</div>
            ${newTag}
          </div>
          ${dlBtn}
        </div>
      `;
    }).join('')}</div>`;
  }

  // ── S-10: ACTIONS ────────────────────────────────────────────────────
  function renderActions() {
    const plan = state.data.masterRecord.plan;
    if (plan === 'lite') {
      renderUpgradePrompt('screen-actions', 'Action History', 'Action tracking is available on Pro and Agency plans.');
      return;
    }

    const snapshots = state.data.snapshots;
    const container = document.getElementById('actions-content');

    if (snapshots.length === 0) {
      container.innerHTML = `<div class="empty-state"><i class="ti ti-checklist"></i><p>Actions will appear after your first report.</p></div>`;
      return;
    }

    const subscriberId = state.data.masterRecord.subscriber_id;

    const actionItems = snapshots.map((s, i) => {
      const a = getPriorityAction(s, snapshots[i - 1] || null, plan);
      const isCurrentMonth = i === snapshots.length - 1;
      const doneKey = `action_done_${subscriberId}_${s.report_number}`;
      const isDone = sessionStorage.getItem(doneKey) === '1';
      return { snap: s, action: a, isCurrentMonth, doneKey, isDone };
    }).reverse();

    container.innerHTML = `<div class="actions-list">${actionItems.map((item, idx) => `
      <div class="action-row" id="action-row-${idx}">
        <button class="action-done-toggle ${item.isDone ? 'done' : ''}"
          onclick="window.__toggleAction('${item.doneKey}', ${actionItems.length - 1 - idx}, this)">
          ${item.isDone ? '<i class="ti ti-check"></i>' : ''}
        </button>
        <div class="action-body">
          <div class="action-text">${item.action.title}</div>
          <div class="action-meta">
            ${monthLabel(item.snap.snapshot_date)} · Affects: ${getWeakestSignalLabel(item.snap, plan)}
            ${item.isCurrentMonth ? '<span class="current-priority-tag">Current priority</span>' : ''}
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px;">${item.action.desc}</div>
        </div>
      </div>
    `).join('')}</div>`;
  }

  function getWeakestSignalLabel(snap, plan) {
    const fields = getSignalFields(plan, snap);
    let worst = null, worstScore = 101;
    fields.forEach(f => {
      const v = snap[f.field];
      if (v === null || v === undefined) return;
      const s = scoreSignal(f.field, v);
      if (s < worstScore) { worstScore = s; worst = f; }
    });
    return worst ? worst.label : 'Overall';
  }

  window.__toggleAction = function(doneKey, snapIdx, btn) {
    const isDone = sessionStorage.getItem(doneKey) === '1';
    if (isDone) {
      sessionStorage.removeItem(doneKey);
      btn.classList.remove('done');
      btn.innerHTML = '';
    } else {
      sessionStorage.setItem(doneKey, '1');
      btn.classList.add('done');
      btn.innerHTML = '<i class="ti ti-check"></i>';
    }
  };

  // ── S-11: COMPETITORS ────────────────────────────────────────────────
  function renderCompetitors() {
    const plan = state.data.masterRecord.plan;
    if (plan !== 'agency') {
      renderUpgradePrompt('screen-competitors', 'Competitor Tracker', 'Competitor tracking is an Agency-exclusive feature.');
      return;
    }

    const mr = state.data.masterRecord;
    const curr = latest();
    const container = document.getElementById('competitors-content');

    const hasCompetitors = mr.competitor_1_url || mr.competitor_2_url || mr.competitor_3_url;

    if (!hasCompetitors) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="ti ti-swords"></i>
          <p>No competitor URLs on file. Contact support to add up to 3 competitors to your monitoring profile.</p>
          <a href="mailto:service@tameyogroup.com" class="btn-upgrade" style="margin-top:12px;font-size:13px;padding:10px 20px;">Contact Support</a>
        </div>
      `;
      return;
    }

    const competitors = [
      { url: mr.competitor_1_url, rank: curr.competitor_1_maps_rank, color: '#E8400A', label: 'Competitor 1' },
      { url: mr.competitor_2_url, rank: curr.competitor_2_maps_rank, color: '#7C3AED', label: 'Competitor 2' },
      { url: mr.competitor_3_url, rank: curr.competitor_3_maps_rank, color: '#0EA5E9', label: 'Competitor 3' },
    ].filter(c => c.url);

    const snapshots = state.data.snapshots;
    const labels = snapshots.map(s => monthLabel(s.snapshot_date));

    const ownRanks = snapshots.map(s => s.maps_rank_kw1);

    container.innerHTML = `
      <div class="competitor-legend">
        <div class="legend-item"><div class="legend-dot" style="background:#0F0638"></div>${mr.business_name} (you)</div>
        ${competitors.map(c => `<div class="legend-item"><div class="legend-dot" style="background:${c.color}"></div>${c.url.replace('https://','').replace('www.','')}</div>`).join('')}
      </div>
      <div class="chart-card">
        <div class="chart-header"><div class="chart-title">Maps Rank — Monthly Comparison</div></div>
        <div class="chart-container"><canvas id="competitor-chart"></canvas></div>
      </div>
      <div class="chart-card" style="margin-top:0">
        <div class="chart-header"><div class="chart-title">Current Maps Rankings</div></div>
        <div class="stats-row" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
          <div class="stat-card">
            <div class="stat-label">You</div>
            <div class="stat-value">#${curr.maps_rank_kw1 || '—'}</div>
          </div>
          ${competitors.map(c => `
            <div class="stat-card">
              <div class="stat-label">${c.url.replace('https://','').replace('www.','').split('/')[0]}</div>
              <div class="stat-value">${c.rank !== null && c.rank !== undefined ? '#' + c.rank : '—'}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    const datasets = [
      { data: ownRanks, label: mr.business_name, borderColor: '#0F0638', backgroundColor: 'rgba(15,6,56,0.1)', pointBackgroundColor: '#0F0638' },
      ...competitors.map(c => ({
        data: snapshots.map(() => c.rank),
        label: c.label,
        borderColor: c.color,
        backgroundColor: c.color + '20',
        pointBackgroundColor: c.color,
        borderDash: [4, 3],
      })),
    ];

    setTimeout(() => {
      const ctx = document.getElementById('competitor-chart');
      if (!ctx) return;
      state.charts['competitor-chart'] = new Chart(ctx, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: {
            y: { reverse: true, min: 1, title: { display: true, text: 'Rank Position' }, grid: { color: 'rgba(0,0,0,0.05)' } },
            x: { grid: { color: 'rgba(0,0,0,0.05)' } },
          },
          plugins: { legend: { display: true, position: 'bottom' } },
        },
      });
    }, 50);
  }

  // ── S-12: AI VISIBILITY ──────────────────────────────────────────────
  function renderAI() {
    const plan = state.data.masterRecord.plan;
    if (plan !== 'agency') {
      renderUpgradePrompt('screen-ai', 'AI Visibility', 'AI Visibility tracking is an Agency-exclusive feature.');
      return;
    }

    const snapshots = state.data.snapshots;
    const curr = latest();
    const container = document.getElementById('ai-content');

    const platforms = [
      { key: 'ai_visibility_chatgpt', name: 'ChatGPT' },
      { key: 'ai_visibility_google', name: 'Google AI Overviews' },
    ];

    const cards = platforms.map(p => {
      const status = curr[p.key] || 'Not found';
      const isPresent = status === 'Present';

      const history = snapshots.map((s, i) => {
        const v = s[p.key] || 'Not found';
        const isFirst = isPresent && v === 'Present' && (i === 0 || (snapshots[i - 1] && snapshots[i - 1][p.key] !== 'Present'));
        return `
          <div class="ai-history-row">
            <span>${monthLabel(s.snapshot_date)}</span>
            <div style="display:flex;align-items:center;gap:8px">
              <span class="ai-status-chip ${v === 'Present' ? 'present' : 'not-found'}">${v}</span>
              ${isFirst ? '<span class="ai-win-badge">🎉 First appeared!</span>' : ''}
            </div>
          </div>
        `;
      }).reverse().join('');

      return `
        <div class="ai-card">
          <div class="ai-card-header">
            <div class="ai-platform-name">${p.name}</div>
            <div class="ai-status-chip ${isPresent ? 'present' : 'not-found'}">${status}</div>
          </div>
          <div style="font-size:13px;color:var(--text-secondary)">Current status for ${state.data.masterRecord.business_name}</div>
          <div class="ai-history">${history}</div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="ai-cards">${cards}</div>
      <div class="ai-guidance">
        <h3>How to improve your AI visibility</h3>
        <ul>
          <li>Ensure your business is listed on authoritative directories (Google, Yelp, BBB)</li>
          <li>Publish helpful FAQ content on your website that answers common queries about your services</li>
          <li>Build branded search volume — encourage customers to search your business name</li>
          <li>Keep your Google Business Profile completely filled in with recent photos and posts</li>
          <li>Earn mentions and citations from local news sites and industry blogs</li>
        </ul>
      </div>
    `;
  }

  // ── S-13: SOCIAL SIGNALS ─────────────────────────────────────────────
  function renderSocial() {
    const plan = state.data.masterRecord.plan;
    if (plan !== 'agency') {
      renderUpgradePrompt('screen-social', 'Social Signals', 'Social signal tracking is an Agency-exclusive feature.');
      return;
    }

    const mr = state.data.masterRecord;
    const curr = latest();
    const prevSnap = prev();
    const container = document.getElementById('social-content');

    const hasInstagram = mr.instagram_handle;
    const hasFacebook = mr.facebook_page_url;

    if (!hasInstagram && !hasFacebook) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="ti ti-brand-instagram"></i>
          <p>No social media handles on file. Contact support to add your Instagram and Facebook profiles.</p>
          <a href="mailto:service@tameyogroup.com" class="btn-upgrade" style="margin-top:12px;font-size:13px;padding:10px 20px;">Contact Support</a>
        </div>
      `;
      return;
    }

    let html = '';

    if (hasInstagram) {
      const eng = curr.instagram_engagement_rate;
      const shadow = curr.instagram_shadowban_status || 'None';
      const prevEng = prevSnap ? prevSnap.instagram_engagement_rate : null;
      const engDelta = eng !== null && prevEng !== null ? Math.round((eng - prevEng) * 10) / 10 : null;
      const shadowClass = shadow === 'None' ? 'none' : shadow.includes('Hashtag') ? 'hashtag' : 'profile';

      html += `
        <div class="social-section">
          <div class="social-section-header">
            <i class="ti ti-brand-instagram" style="font-size:20px;color:#E1306C"></i>
            <div class="social-section-title">Instagram — @${mr.instagram_handle}</div>
          </div>
          <div class="social-stats">
            <div class="social-stat">
              <div class="social-stat-label">Engagement Rate</div>
              <div class="social-stat-value">${eng !== null && eng !== undefined ? eng + '%' : '—'}</div>
              ${engDelta !== null ? `<div class="social-stat-delta ${engDelta >= 0 ? 'delta-up' : 'delta-down'}" style="color:${engDelta >= 0 ? 'var(--rag-green)' : 'var(--rag-red)'}">${engDelta >= 0 ? '↑' : '↓'} ${Math.abs(engDelta)}%</div>` : ''}
            </div>
            <div class="social-stat">
              <div class="social-stat-label">Shadowban Status</div>
              <div style="margin-top:6px"><span class="shadowban-chip ${shadowClass}">${shadow}</span></div>
            </div>
          </div>
        </div>
      `;
    }

    if (hasFacebook) {
      const fbScore = curr.facebook_page_score;
      const prevFb = prevSnap ? prevSnap.facebook_page_score : null;
      const fbDelta = fbScore !== null && prevFb !== null ? fbScore - prevFb : null;

      html += `
        <div class="social-section">
          <div class="social-section-header">
            <i class="ti ti-brand-facebook" style="font-size:20px;color:#1877F2"></i>
            <div class="social-section-title">Facebook</div>
          </div>
          <div class="social-stats">
            <div class="social-stat">
              <div class="social-stat-label">Page Health Score</div>
              <div class="social-stat-value">${fbScore !== null && fbScore !== undefined ? fbScore : '—'}</div>
              ${fbDelta !== null ? `<div class="social-stat-delta" style="color:${fbDelta >= 0 ? 'var(--rag-green)' : 'var(--rag-red)'}">${fbDelta >= 0 ? '↑' : '↓'} ${Math.abs(fbDelta)}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    container.innerHTML = html;
  }

  // ── S-14: UPGRADE PROMPT ─────────────────────────────────────────────
  function renderUpgrade() {
    const plan = state.data.masterRecord.plan;
    const context = state.upgradeContext || 'this feature';
    const container = document.getElementById('upgrade-content');

    const isLiteToPro = plan === 'lite';
    const targetPlan = isLiteToPro ? 'Pro' : 'Agency';
    const checkoutUrl = isLiteToPro
      ? 'https://www.tameyogroup.com/checkout?checkoutId=pro-plan-id'
      : 'https://www.tameyogroup.com/checkout?checkoutId=agency-plan-id';

    const features = isLiteToPro ? [
      'Full signal grid (8 signals)',
      'Trend charts & history',
      'Month-on-month comparison',
      'Action history tracker',
      'Desktop PageSpeed & Core Web Vitals',
      'Domain authority & backlinks',
      'Trustpilot rating monitoring',
    ] : [
      'Competitor tracker (up to 3)',
      'AI Visibility — ChatGPT & Google',
      'Social signals — Instagram & Facebook',
      'Shadowban detection',
      '15 signals tracked monthly',
      'Organic keyword rankings',
      'New & lost backlinks',
    ];

    const headline = context === 'nav'
      ? `Unlock the full power of Monitor`
      : `Unlock ${context}`;

    container.innerHTML = `
      <div class="upgrade-prompt">
        <i class="ti ti-rocket"></i>
        <h2>${headline}</h2>
        <p>Upgrade to ${targetPlan} to access this feature and everything else in the suite.</p>
        <div class="upgrade-features">
          ${features.map(f => `<div class="upgrade-feature"><i class="ti ti-check"></i>${f}</div>`).join('')}
        </div>
        <a href="${checkoutUrl}" target="_blank" class="btn-upgrade">Upgrade to ${targetPlan} →</a>
        <button onclick="window.__navigate('overview')" style="background:none;border:none;color:rgba(255,255,255,0.45);font-size:13px;cursor:pointer;margin-top:4px;">← Back to overview</button>
      </div>
    `;
  }

  function renderUpgradePrompt(screenId, featureName, desc) {
    const plan = state.data.masterRecord.plan;
    const isLiteToPro = plan === 'lite' || plan === 'pro';
    const targetPlan = plan === 'lite' ? 'Pro' : 'Agency';
    const checkoutUrl = plan === 'lite'
      ? 'https://www.tameyogroup.com/checkout?checkoutId=pro-plan-id'
      : 'https://www.tameyogroup.com/checkout?checkoutId=agency-plan-id';

    const el = document.getElementById(screenId);
    const existing = el.querySelector('.upgrade-prompt');
    if (existing) existing.remove();

    el.innerHTML += `
      <div class="upgrade-prompt" style="max-width:600px;margin:0 auto">
        <i class="ti ti-lock"></i>
        <h2>${featureName}</h2>
        <p>${desc}</p>
        <a href="${checkoutUrl}" target="_blank" class="btn-upgrade">Upgrade to ${targetPlan} →</a>
      </div>
    `;
  }

  // ── S-16: ACCOUNT SETTINGS ───────────────────────────────────────────
  function renderSettings() {
    const mr = state.data.masterRecord;
    const status = mr.status;
    const isCancelled = status === 'cancelled';
    const container = document.getElementById('settings-content');

    const emailNotifKey = 'notif_' + mr.subscriber_id;
    const notifOn = sessionStorage.getItem(emailNotifKey) !== '0';

    container.innerHTML = `
      <div class="settings-card">
        <div class="settings-section-title">Plan Details</div>
        <div class="settings-row">
          <div class="settings-key">Current Plan</div>
          <div class="settings-value">${mr.plan.charAt(0).toUpperCase() + mr.plan.slice(1)}</div>
        </div>
        <div class="settings-row">
          <div class="settings-key">Billing</div>
          <div class="settings-value">${mr.billing.charAt(0).toUpperCase() + mr.billing.slice(1)}</div>
        </div>
        <div class="settings-row">
          <div class="settings-key">Subscriber Since</div>
          <div class="settings-value">${new Date(mr.signup_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
        </div>
        <div class="settings-row">
          <div class="settings-key">Status</div>
          <div class="settings-value" style="color:${status === 'active' ? 'var(--rag-green)' : status === 'paused' ? 'var(--rag-amber)' : 'var(--rag-red)'}">
            ${status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-key">Report runs on day</div>
          <div class="settings-value">${mr.run_day} of each month</div>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-section-title">Monitoring Configuration</div>
        <div class="settings-row">
          <div class="settings-key">Monitored URL</div>
          <div class="settings-value">${mr.website_url}</div>
        </div>
        <div class="settings-row">
          <div class="settings-key">Primary Keyword</div>
          <div class="settings-value">${mr.target_keyword_1 || '—'}</div>
        </div>
        ${mr.target_keyword_2 ? `<div class="settings-row">
          <div class="settings-key">Keyword 2</div>
          <div class="settings-value">${mr.target_keyword_2}</div>
        </div>` : ''}
        ${mr.target_keyword_3 ? `<div class="settings-row">
          <div class="settings-key">Keyword 3</div>
          <div class="settings-value">${mr.target_keyword_3}</div>
        </div>` : ''}
        <div class="settings-row">
          <div class="settings-key">Change keywords or URL</div>
          <div class="settings-value"><a href="mailto:service@tameyogroup.com" class="settings-contact-link">Contact support</a></div>
        </div>
      </div>

      <div class="settings-card">
        <div class="settings-section-title">Notifications</div>
        <div class="settings-row">
          <div class="settings-key">Delivery email</div>
          ${isCancelled
            ? `<div class="settings-value">${mr.email}</div>`
            : `<div class="settings-edit">
                <input type="email" class="settings-input" id="email-input" value="${mr.email}" />
                <button class="btn-save" id="save-email-btn">Save</button>
              </div>`
          }
        </div>
        <div class="settings-row">
          <div class="settings-key">Report notification emails</div>
          ${isCancelled
            ? `<div class="settings-value">Disabled</div>`
            : `<div class="settings-edit">
                <label class="toggle-switch">
                  <input type="checkbox" id="notif-toggle" ${notifOn ? 'checked' : ''} />
                  <div class="toggle-slider"></div>
                </label>
              </div>`
          }
        </div>
      </div>

      ${!isCancelled ? `
      <div class="settings-card">
        <div class="settings-section-title">Account Actions</div>
        <div class="settings-row">
          <div class="settings-key">Pause, upgrade, or cancel subscription</div>
          <div class="settings-value"><a href="mailto:service@tameyogroup.com" class="settings-contact-link">Contact support</a></div>
        </div>
      </div>` : ''}
    `;

    if (!isCancelled) {
      document.getElementById('save-email-btn').addEventListener('click', () => {
        const val = document.getElementById('email-input').value;
        if (val && val.includes('@')) {
          alert('Email updated! (In production this would save via Make.com)');
        }
      });

      document.getElementById('notif-toggle').addEventListener('change', e => {
        sessionStorage.setItem(emailNotifKey, e.target.checked ? '1' : '0');
      });
    }
  }

  // ── CHART BUILDERS ───────────────────────────────────────────────────
  function buildLineChart(canvasId, labels, datasets) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (state.charts[canvasId]) { state.charts[canvasId].destroy(); }

    const defaultColors = ['#E8400A', '#0F0638', '#7C3AED', '#0EA5E9'];

    const styledDatasets = datasets.map((ds, i) => ({
      label: ds.label || '',
      data: ds.data,
      borderColor: ds.borderColor || defaultColors[i % defaultColors.length],
      backgroundColor: ds.backgroundColor || (defaultColors[i % defaultColors.length] + '18'),
      pointBackgroundColor: ds.pointBackgroundColor || defaultColors[i % defaultColors.length],
      pointRadius: ds.pointRadius !== undefined ? ds.pointRadius : 4,
      pointHoverRadius: 6,
      borderWidth: 2.5,
      borderDash: ds.borderDash || [],
      tension: 0.3,
      fill: i === 0,
    }));

    state.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: styledDatasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            min: 0,
            max: 100,
            grid: { color: 'rgba(0,0,0,0.06)' },
            ticks: { font: { size: 11 }, color: '#999' },
          },
          x: {
            grid: { display: false },
            ticks: { font: { size: 11 }, color: '#999' },
          },
        },
        plugins: {
          legend: { display: datasets.length > 1, position: 'bottom', labels: { font: { size: 12 }, usePointStyle: true } },
          tooltip: {
            backgroundColor: '#0F0638',
            titleColor: '#FFF',
            bodyColor: 'rgba(255,255,255,0.75)',
            padding: 10,
            cornerRadius: 6,
          },
        },
      },
    });
  }

  function buildSparklineChart(canvasId, labels, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    if (state.charts[canvasId]) { state.charts[canvasId].destroy(); }
    state.charts[canvasId] = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          data,
          borderColor: '#E8400A',
          backgroundColor: 'rgba(232,64,10,0.08)',
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.3,
          fill: true,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { display: false },
          x: { grid: { display: false }, ticks: { font: { size: 10 }, color: '#999' } },
        },
        plugins: { legend: { display: false }, tooltip: { enabled: true } },
      },
    });
  }

  // ── GLOBAL NAVIGATE HELPER ───────────────────────────────────────────
  window.__navigate = function(route, context) {
    if (context) state.upgradeContext = context;
    navigateTo(route);
  };

  // ── RE-AUTH BUTTON ───────────────────────────────────────────────────
  document.getElementById('btn-reauth').addEventListener('click', () => {
    window.parent.postMessage({ type: 'reauth' }, ALLOWED_ORIGIN);
  });

  // ── KICK OFF ─────────────────────────────────────────────────────────
  boot();

})();
