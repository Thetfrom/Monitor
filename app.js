// TAMEYO Monitor - Enhanced App Logic v2.0
// Features derived from real snapshot data. Every button wired. Clean layout.

(function () {
  'use strict';

  const ALLOWED_ORIGIN = 'https://www.tameyogroup.com';
  const MAKE_READ_ENDPOINT = '';

  let state = {
    auth: null,
    data: null,
    route: 'overview',
    upgradeContext: null,
    trendRange: '3',
    benchmarkOn: false,
    charts: {},
  };

  // ── BOOT ─────────────────────────────────────────────────────────────
  function readUrlData() {
    try {
      const h = window.location.hash || '';
      if (h === '#noaccount') return 'noaccount';
      if (h.indexOf('#d=') === 0) {
        const json = decodeURIComponent(escape(atob(h.slice(3))));
        const payload = JSON.parse(json);
        if (payload && payload.masterRecord) return payload;
      }
    } catch (e) {}
    return null;
  }

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

    // URL-delivered data (robust path): Velo sets the iframe URL with the data in
    // the hash; we read it directly on load. No cross-frame messaging involved.
    const urlData = readUrlData();
    if (urlData === 'noaccount') { showScreen('screen-no-account'); return; }
    if (urlData) {
      state.auth = {
        subscriberId: urlData.masterRecord.subscriber_id,
        plan: urlData.masterRecord.plan,
        status: urlData.masterRecord.status,
        businessName: urlData.masterRecord.business_name,
      };
      state.data = { masterRecord: urlData.masterRecord, snapshots: urlData.snapshots || [] };
      onDataReady();
      return;
    }

    // Wix HtmlComponent ("Embed a Site") relays messages through its own iframe
    // bridge with a Wix-internal origin, so we post the ready ping to any parent
    // and validate incoming messages by shape/type rather than exact origin.
    // (The dashboard only renders the data it is handed, so this is safe.)
    window.parent.postMessage({ type: 'ready' }, '*');
    const timeout = setTimeout(() => showScreen('screen-no-account'), 10000);
    window.addEventListener('message', function handler(e) {
      const msg = e.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'auth_error') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        showScreen(msg.reason === 'session_expired' ? 'screen-session-expired' : 'screen-no-account');
        return;
      }
      // Direct data payload from Wix Velo - no Make.com needed
      if (msg.type === 'data') {
        clearTimeout(timeout);
        window.removeEventListener('message', handler);
        if (!msg.masterRecord || !msg.snapshots) { showScreen('screen-no-account'); return; }
        state.auth = {
          subscriberId: msg.masterRecord.subscriber_id,
          plan: msg.masterRecord.plan,
          status: msg.masterRecord.status,
          businessName: msg.masterRecord.business_name,
        };
        state.data = { masterRecord: msg.masterRecord, snapshots: msg.snapshots };
        onDataReady();
        return;
      }
      if (msg.type !== 'auth') return;
      clearTimeout(timeout);
      window.removeEventListener('message', handler);
      state.auth = { subscriberId: msg.subscriberId, plan: msg.plan, status: msg.status, businessName: msg.businessName };
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
      console.warn('MAKE_READ_ENDPOINT not set - cannot load subscriber data.');
      showScreen('screen-no-account');
      return;
    }
    fetch(MAKE_READ_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscriber_id: subscriberId }),
    })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(json => { if (!json || !json.masterRecord) throw new Error('Invalid payload'); state.data = json; onDataReady(); })
      .catch(err => { console.error('Failed to load subscriber data:', err); showScreen('screen-no-account'); });
  }

  function onDataReady() {
    const { masterRecord, snapshots } = state.data;
    const status = masterRecord.status;
    if (status === 'cancelled') { buildNav(); showScreen('app-shell'); navigateTo('reactivation'); return; }
    const onboardingSeen = sessionStorage.getItem('onboarding_seen_' + masterRecord.subscriber_id);
    if (!onboardingSeen && snapshots.length === 0) { buildNav(); showScreen('app-shell'); renderOnboarding(); showPage('onboarding'); return; }
    buildNav();
    showScreen('app-shell');
    const latestSnap = snapshots[snapshots.length - 1];
    if (!onboardingSeen && latestSnap && latestSnap.report_number === 1) { renderOnboarding(); showPage('onboarding'); return; }
    navigateTo('overview');
  }

  // ── SCREEN VISIBILITY ────────────────────────────────────────────────
  function showScreen(name) {
    ['screen-loading', 'screen-no-account', 'screen-session-expired', 'app-shell'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('hidden');
    });
    const target = document.getElementById(name);
    if (target) target.classList.remove('hidden');
  }

  function showPage(name) {
    ['overview','signals','trends','compare','reports','actions','competitors','ai','social','upgrade','settings','onboarding','reactivation']
      .forEach(p => { const el = document.getElementById('screen-' + p); if (el) el.classList.add('hidden'); });
    const el = document.getElementById('screen-' + name);
    if (el) el.classList.remove('hidden');
    state.route = name;
    updateNavActive();
  }

  // ── NAVIGATION ───────────────────────────────────────────────────────
  const NAV_ITEMS = [
    { id: 'overview',    label: 'Overview',      icon: 'ti-home',        tiers: ['lite','pro','agency'] },
    { id: 'signals',     label: 'Signals',       icon: 'ti-antenna',     tiers: ['lite','pro','agency'] },
    { id: 'trends',      label: 'Trends',        icon: 'ti-trending-up', tiers: ['pro','agency'],  lockFor: ['lite'] },
    { id: 'compare',     label: 'Compare',       icon: 'ti-arrows-diff', tiers: ['pro','agency'],  lockFor: ['lite'] },
    { id: 'reports',     label: 'Reports',       icon: 'ti-file-text',   tiers: ['lite','pro','agency'] },
    { id: 'actions',     label: 'Actions',       icon: 'ti-checklist',   tiers: ['pro','agency'],  lockFor: ['lite'] },
    { id: 'competitors', label: 'Competitors',   icon: 'ti-swords',      tiers: ['agency'],        lockFor: ['lite','pro'] },
    { id: 'ai',          label: 'AI Visibility', icon: 'ti-brain',       tiers: ['agency'],        lockFor: ['lite','pro'] },
    { id: 'social',      label: 'Social',        icon: 'ti-heart',       tiers: ['agency'],        lockFor: ['lite','pro'] },
    { id: 'settings',    label: 'Settings',      icon: 'ti-settings',    tiers: ['lite','pro','agency'] },
  ];

  function buildNav() {
    const { masterRecord, snapshots } = state.data;
    const plan = masterRecord.plan;
    const status = masterRecord.status;
    document.getElementById('nav-business-name').textContent = masterRecord.business_name;
    const streak = calcStreak(snapshots, plan);
    const streakEl = document.getElementById('streak-label');
    if (streak >= 2) {
      streakEl.textContent = streak + '-mo streak';
      document.getElementById('streak-pill').style.background = 'rgba(127,212,75,0.15)';
      document.getElementById('streak-pill').style.color = '#7FD44B';
    } else {
      streakEl.textContent = snapshots.length ? 'Report #' + snapshots[snapshots.length - 1].report_number : 'Welcome';
    }
    const badge = document.getElementById('plan-badge');
    badge.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
    badge.className = 'plan-badge ' + plan;
    const upgradeBtn = document.getElementById('nav-upgrade-btn');
    if (plan !== 'agency' && status === 'active') {
      upgradeBtn.classList.remove('hidden');
      upgradeBtn.onclick = () => window.__openUpgrade('nav');
    }
    const container = document.getElementById('nav-tabs');
    container.innerHTML = '';
    NAV_ITEMS.forEach(item => {
      const isLocked = item.lockFor && item.lockFor.includes(plan);
      const btn = document.createElement('button');
      btn.className = 'nav-tab' + (isLocked ? ' locked' : '');
      btn.dataset.route = item.id;
      btn.innerHTML = `<i class="ti ${item.icon}"></i>${item.label}${isLocked ? ' <i class="ti ti-lock" style="font-size:11px;opacity:0.55"></i>' : ''}`;
      btn.addEventListener('click', () => {
        if (isLocked) window.__openUpgrade(item.label);
        else navigateTo(item.id);
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
      window.__openUpgrade(opts && opts.context ? opts.context : 'feature');
      return;
    }
    if (route === 'reactivation') { renderReactivation(); showPage('reactivation'); return; }
    showPage(route);
    switch (route) {
      case 'overview':    renderOverview();    break;
      case 'signals':     renderSignals();     break;
      case 'trends':      renderTrends();      break;
      case 'compare':     renderCompare();     break;
      case 'reports':     renderReports();     break;
      case 'actions':     renderActions();     break;
      case 'competitors': renderCompetitors(); break;
      case 'ai':          renderAI();          break;
      case 'social':      renderSocial();      break;
      case 'settings':    renderSettings();    break;
    }
  }

  function destroyCharts() {
    Object.values(state.charts).forEach(c => { try { c.destroy(); } catch(e) {} });
    state.charts = {};
  }

  // ── DATA HELPERS (original) ──────────────────────────────────────────
  function latest() { const s = state.data.snapshots; return s[s.length - 1]; }
  function prev() { const s = state.data.snapshots; return s.length >= 2 ? s[s.length - 2] : null; }

  function fmtVal(v, suffix) {
    if (v === null || v === undefined) return '<span class="null-value">-</span>';
    return suffix ? v + suffix : v;
  }

  function deltaClass(d, lowerIsBetter) {
    if (d === null || d === undefined || d === 0) return 'same';
    if (lowerIsBetter) return d < 0 ? 'up' : 'down';
    return d > 0 ? 'up' : 'down';
  }

  function deltaArrow(d, lowerIsBetter) {
    if (d === null || d === undefined || d === 0) return '→ 0';
    if (lowerIsBetter) return d < 0 ? `↑ ${Math.abs(d)}` : `↓ ${Math.abs(d)}`;
    return d > 0 ? `↑ ${d}` : `↓ ${Math.abs(d)}`;
  }

  function calcDelta(curr, prevSnap, field) {
    if (!prevSnap) return null;
    const a = prevSnap[field], b = curr[field];
    if (a === null || a === undefined || b === null || b === undefined) return null;
    return Math.round((b - a) * 10) / 10;
  }

  function ragStatus(field, value) {
    if (value === null || value === undefined) return 'gray';
    const thresholds = {
      maps_rank_kw1: [3, 10, 20], maps_rank_kw2: [3, 10, 20], maps_rank_kw3: [3, 10, 20],
      mobile_pagespeed: [90, 70, 50], desktop_pagespeed: [90, 70, 50],
      gbp_completeness_pct: [95, 75, 50], google_star_rating: [4.7, 4.3, 3.8],
      domain_authority: [50, 30, 15], onpage_seo_score: [85, 70, 50],
      trustpilot_rating: [4.7, 4.3, 3.8], instagram_engagement_rate: [5, 2, 1],
      facebook_page_score: [80, 60, 40], organic_rank_kw1: [3, 10, 20],
      organic_rank_kw2: [3, 10, 20], organic_rank_kw3: [3, 10, 20],
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

  function calcPresenceScore(snapshot, plan) {
    const fields = getSignalFields(plan);
    let total = 0, count = 0;
    fields.forEach(f => {
      const v = snapshot[f.field];
      if (v === null || v === undefined) return;
      total += scoreSignal(f.field, v);
      count++;
    });
    return count > 0 ? Math.round(total / count) : 0;
  }

  function scoreSignal(field, value) {
    const lowerBetter = ['maps_rank_kw1','maps_rank_kw2','maps_rank_kw3','organic_rank_kw1','organic_rank_kw2','organic_rank_kw3'];
    const maxes = {
      maps_rank_kw1: 25, maps_rank_kw2: 25, maps_rank_kw3: 25,
      mobile_pagespeed: 100, desktop_pagespeed: 100, gbp_completeness_pct: 100,
      google_star_rating: 5, google_review_count: 500, domain_authority: 100,
      onpage_seo_score: 100, trustpilot_rating: 5, instagram_engagement_rate: 10,
      facebook_page_score: 100, organic_rank_kw1: 25, organic_rank_kw2: 25, organic_rank_kw3: 25,
      backlinks_total: 2000,
    };
    if (lowerBetter.includes(field)) {
      const max = maxes[field] || 25;
      return Math.max(0, Math.min(100, ((max - value) / (max - 1)) * 100));
    }
    return Math.min(100, (value / (maxes[field] || 100)) * 100);
  }

  function getSignalFields(plan) {
    const lite = [
      { field: 'maps_rank_kw1',     label: 'Maps Rank',        lowerBetter: true },
      { field: 'google_star_rating', label: 'Google Rating',   suffix: '★' },
      { field: 'mobile_pagespeed',   label: 'Mobile PageSpeed' },
    ];
    const proBase = [
      { field: 'maps_rank_kw1',        label: 'Maps Rank KW1',    lowerBetter: true },
      { field: 'gbp_completeness_pct', label: 'GBP Completeness', suffix: '%' },
      { field: 'google_star_rating',   label: 'Google Rating',    suffix: '★' },
      { field: 'mobile_pagespeed',     label: 'Mobile PageSpeed' },
      { field: 'maps_rank_kw2',        label: 'Maps Rank KW2',    lowerBetter: true },
      { field: 'maps_rank_kw3',        label: 'Maps Rank KW3',    lowerBetter: true },
      { field: 'desktop_pagespeed',    label: 'Desktop PageSpeed' },
      { field: 'domain_authority',     label: 'Domain Authority' },
    ];
    const agencyExtra = [
      { field: 'trustpilot_rating',         label: 'Trustpilot Rating',    suffix: '★' },
      { field: 'onpage_seo_score',          label: 'On-Page SEO' },
      { field: 'google_review_count',       label: 'Google Reviews' },
      { field: 'backlinks_total',           label: 'Backlinks' },
      { field: 'organic_rank_kw1',          label: 'Organic Rank KW1',     lowerBetter: true },
      { field: 'organic_rank_kw2',          label: 'Organic Rank KW2',     lowerBetter: true },
      { field: 'organic_rank_kw3',          label: 'Organic Rank KW3',     lowerBetter: true },
      { field: 'instagram_engagement_rate', label: 'Instagram Engagement', suffix: '%' },
      { field: 'facebook_page_score',       label: 'Facebook Score' },
    ];
    if (plan === 'lite') return lite;
    if (plan === 'pro') return proBase;
    return [...proBase, ...agencyExtra];
  }

  function isNewReport(snapshot) {
    if (!snapshot) return false;
    return (new Date() - new Date(snapshot.snapshot_date)) < 48 * 60 * 60 * 1000;
  }

  function monthLabel(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }

  function daysUntilNext(runDay) {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), runDay);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    return Math.ceil((next - now) / (1000 * 60 * 60 * 24));
  }

  // ── DATA HELPERS (new - all derived from real snapshot data) ─────────

  // Consecutive months where overall presence score improved
  function calcStreak(snapshots, plan) {
    if (snapshots.length < 2) return 0;
    let streak = 0;
    for (let i = snapshots.length - 1; i >= 1; i--) {
      if (calcPresenceScore(snapshots[i], plan) > calcPresenceScore(snapshots[i - 1], plan)) streak++;
      else break;
    }
    return streak;
  }

  // Average monthly score change over last 3 months (rounded to 1 dp)
  function calcVelocity(snapshots, plan) {
    if (snapshots.length < 2) return null;
    const last = snapshots.slice(-Math.min(4, snapshots.length));
    let total = 0, count = 0;
    for (let i = 1; i < last.length; i++) {
      total += calcPresenceScore(last[i], plan) - calcPresenceScore(last[i - 1], plan);
      count++;
    }
    return count > 0 ? Math.round((total / count) * 10) / 10 : null;
  }

  // Biggest all-time score improvement across any signal (first → latest)
  function getBiggestAllTimeWin(snapshots, plan) {
    if (snapshots.length < 2) return null;
    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];
    const fields = getSignalFields(plan);
    let best = null, bestGain = -Infinity;
    fields.forEach(f => {
      const va = first[f.field], vb = last[f.field];
      if (va === null || va === undefined || vb === null || vb === undefined) return;
      const gain = scoreSignal(f.field, vb) - scoreSignal(f.field, va);
      if (gain > bestGain) { bestGain = gain; best = { ...f, scoreGain: Math.round(gain), fromVal: va, toVal: vb }; }
    });
    return best && bestGain > 1 ? best : null;
  }

  // Count signals by RAG status
  function getHealthCounts(fields, curr) {
    let green = 0, amber = 0, red = 0;
    fields.forEach(f => {
      const v = curr[f.field];
      if (v === null || v === undefined) return;
      const r = ragStatus(f.field, v);
      if (r === 'green') green++; else if (r === 'amber') amber++; else red++;
    });
    return { green, amber, red };
  }

  // Min/avg/max for a field across all snapshots
  function getSignalRange(snapshots, field) {
    const vals = snapshots.map(s => s[field]).filter(v => v !== null && v !== undefined);
    if (vals.length < 2) return null;
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      avg: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10,
    };
  }

  // Is current value a personal record?
  function isPersonalRecord(snapshots, field, lowerBetter) {
    if (snapshots.length < 2) return false;
    const curr = snapshots[snapshots.length - 1][field];
    if (curr === null || curr === undefined) return false;
    const prevVals = snapshots.slice(0, -1).map(s => s[field]).filter(v => v !== null && v !== undefined);
    if (!prevVals.length) return false;
    return lowerBetter ? curr < Math.min(...prevVals) : curr > Math.max(...prevVals);
  }

  // Signal with biggest positive score delta this month
  function getMostImproved(curr, prevSnap, plan) {
    if (!prevSnap) return null;
    const fields = getSignalFields(plan);
    let best = null, bestDelta = 0;
    fields.forEach(f => {
      const va = prevSnap[f.field], vb = curr[f.field];
      if (va === null || va === undefined || vb === null || vb === undefined) return;
      const delta = scoreSignal(f.field, vb) - scoreSignal(f.field, va);
      if (delta > bestDelta) { bestDelta = delta; best = { ...f, delta: Math.round(delta), fromVal: va, toVal: vb }; }
    });
    return best;
  }

  // Weakest signal by score right now
  function getWeakestField(curr, plan) {
    const fields = getSignalFields(plan);
    let worst = null, worstScore = 101;
    fields.forEach(f => {
      const v = curr[f.field];
      if (v === null || v === undefined) return;
      const s = scoreSignal(f.field, v);
      if (s < worstScore) { worstScore = s; worst = f; }
    });
    return worst;
  }

  // Linear projection of next month's score based on last 3 data points
  function calcProjection(scores) {
    if (scores.length < 2) return null;
    const last = scores.slice(-3);
    const n = last.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    last.forEach((y, x) => { sumX += x; sumY += y; sumXY += x * y; sumX2 += x * x; });
    const denom = n * sumX2 - sumX * sumX;
    if (denom === 0) return null;
    const m = (n * sumXY - sumX * sumY) / denom;
    const b = (sumY - m * sumX) / n;
    return Math.round(Math.min(100, Math.max(0, m * n + b)));
  }

  // Signal that has been non-green for 3+ consecutive months
  function getPersistentIssue(snapshots, plan) {
    if (snapshots.length < 3) return null;
    const fields = getSignalFields(plan);
    let worst = null, worstCount = 0;
    fields.forEach(f => {
      let count = 0;
      for (let i = snapshots.length - 1; i >= 0; i--) {
        const v = snapshots[i][f.field];
        if (v === null || v === undefined) break;
        if (ragStatus(f.field, v) !== 'green') count++;
        else break;
      }
      if (count > worstCount) { worstCount = count; worst = { ...f, months: count }; }
    });
    return worstCount >= 3 ? worst : null;
  }

  // AI Visibility composite score (0-100) from binary platform data
  function calcAIScore(snapshots) {
    if (!snapshots.length) return 0;
    const curr = snapshots[snapshots.length - 1];
    const googleOn = curr.ai_visibility_google === 'Present';
    const chatgptOn = curr.ai_visibility_chatgpt === 'Present';
    const platformScore = (googleOn ? 40 : 0) + (chatgptOn ? 40 : 0);
    let consistency = 0;
    for (let i = snapshots.length - 1; i >= 0; i--) {
      const s = snapshots[i];
      if (s.ai_visibility_google === 'Present' || s.ai_visibility_chatgpt === 'Present') consistency += 5;
      else break;
    }
    return Math.min(100, 10 + platformScore + consistency);
  }

  // Weakest signal label only (for action meta)
  function getWeakestSignalLabel(snap, plan) {
    const fields = getSignalFields(plan);
    let worst = null, worstScore = 101;
    fields.forEach(f => {
      const v = snap[f.field];
      if (v === null || v === undefined) return;
      const s = scoreSignal(f.field, v);
      if (s < worstScore) { worstScore = s; worst = f; }
    });
    return worst ? worst.label : 'Overall';
  }

  // Remove injected elements by ID before re-render (handle back navigation)
  function removeInjected(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
  }

  // ── S-17: ONBOARDING ─────────────────────────────────────────────────
  function renderOnboarding() {
    const mr = state.data.masterRecord;
    const runDay = mr.run_day;
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), runDay);
    if (next <= now) next.setMonth(next.getMonth() + 1);
    const nextDate = next.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    document.getElementById('onboarding-details').innerHTML = `
      <div class="onboarding-detail-row"><span class="onboarding-detail-label">Website</span><span class="onboarding-detail-value">${mr.website_url}</span></div>
      <div class="onboarding-detail-row"><span class="onboarding-detail-label">Primary keyword</span><span class="onboarding-detail-value">${mr.target_keyword_1}</span></div>
      ${mr.target_keyword_2 ? `<div class="onboarding-detail-row"><span class="onboarding-detail-label">Keyword 2</span><span class="onboarding-detail-value">${mr.target_keyword_2}</span></div>` : ''}
      ${mr.target_keyword_3 ? `<div class="onboarding-detail-row"><span class="onboarding-detail-label">Keyword 3</span><span class="onboarding-detail-value">${mr.target_keyword_3}</span></div>` : ''}
      <div class="onboarding-detail-row"><span class="onboarding-detail-label">Plan</span><span class="onboarding-detail-value">${mr.plan.charAt(0).toUpperCase() + mr.plan.slice(1)}</span></div>
      <div class="onboarding-detail-row"><span class="onboarding-detail-label">First report</span><span class="onboarding-detail-value">${nextDate}</span></div>
      <div class="onboarding-detail-row"><span class="onboarding-detail-label">Delivery email</span><span class="onboarding-detail-value">${mr.email}</span></div>
    `;
    document.getElementById('btn-got-it').onclick = () => {
      sessionStorage.setItem('onboarding_seen_' + mr.subscriber_id, '1');
      navigateTo('overview');
    };
  }

  // ── S-15: REACTIVATION ───────────────────────────────────────────────
  function renderReactivation() {
    const count = state.data.snapshots.length;
    const plan = state.data.masterRecord.plan;
    document.getElementById('reactivation-archive-text').innerHTML =
      `You have <strong>${count} month${count !== 1 ? 's' : ''}</strong> of monitoring data in your archive.`;
    const urls = {
      lite: 'https://www.tameyogroup.com/checkout?checkoutId=lite-plan-id',
      pro: 'https://www.tameyogroup.com/checkout?checkoutId=pro-plan-id',
      agency: 'https://www.tameyogroup.com/checkout?checkoutId=agency-plan-id',
    };
    document.getElementById('btn-reactivate-main').href = urls[plan] || urls.pro;
    document.getElementById('btn-view-archives').onclick = () => navigateTo('reports');
  }

  // ── S-04: OVERVIEW ───────────────────────────────────────────────────
  // ── Safe storage (localStorage with graceful fallback) ──────────────
  function lsGet(k){ try{ return localStorage.getItem(k); }catch(e){ try{ return sessionStorage.getItem(k); }catch(e2){ return null; } } }
  function lsSet(k,v){ try{ localStorage.setItem(k,v); }catch(e){ try{ sessionStorage.setItem(k,v); }catch(e2){} } }
  function isActionDone(rn){ return lsGet('action_done_' + state.data.masterRecord.subscriber_id + '_' + rn) === '1'; }

  // ── Since-your-last-visit recap (deploy-today) ──────────────────────
  function renderSinceLastVisit(curr, score){
    const subId = state.data.masterRecord.subscriber_id;
    const key = 'monitor_lastseen_' + subId;
    let prev = null;
    try { prev = JSON.parse(lsGet(key) || 'null'); } catch(e) { prev = null; }
    removeInjected('since-last-visit');
    let msg = null;
    if (prev && typeof prev.score === 'number') {
      const diff = score - prev.score;
      if (prev.rn !== curr.report_number) {
        msg = `Since your last visit, Report #${curr.report_number} arrived. Your Presence Score went ${prev.score} &rarr; ${score} (${diff >= 0 ? '+' : ''}${diff} pts).`;
      } else if (prev.score !== score) {
        msg = `Welcome back. Your Presence Score is now ${score} (${diff >= 0 ? '+' : ''}${diff} since you last looked).`;
      }
    }
    lsSet(key, JSON.stringify({ rn: curr.report_number, score: score, ts: Date.now() }));
    if (msg) {
      const hero = document.getElementById('presence-hero');
      if (hero) hero.insertAdjacentHTML('beforebegin',
        `<div class="since-visit" id="since-last-visit"><i class="ti ti-history"></i><span>${msg}</span></div>`);
    }
  }

  // ── Presence Goal with progress (deploy-today) ──────────────────────
  function renderGoalBlock(score){
    const subId = state.data.masterRecord.subscriber_id;
    const plan = state.data.masterRecord.plan;
    const snapshots = state.data.snapshots;
    const key = 'monitor_goal_' + subId;
    let goal = parseInt(lsGet(key) || '', 10);
    if (!goal || goal < 1 || goal > 100) goal = Math.min(100, Math.max(75, Math.ceil((score + 10) / 5) * 5));
    const pct = Math.max(0, Math.min(100, Math.round(score / goal * 100)));
    const reached = score >= goal;
    const velocity = calcVelocity(snapshots, plan);
    const remaining = goal - score;
    let eta;
    if (reached) {
      eta = 'You hit your goal. Set a higher one to keep the momentum going.';
    } else if (velocity !== null && velocity > 0) {
      const months = Math.max(1, Math.ceil(remaining / velocity));
      eta = `At your recent pace (+${velocity} pts/mo), about ${months} month${months !== 1 ? 's' : ''} to reach ${goal}.`;
    } else {
      eta = 'Your score is not climbing yet. Completing this month\'s priority action is the fastest way to move it.';
    }
    removeInjected('goal-block');
    const statsRow = document.getElementById('stats-row');
    if (!statsRow) return;
    statsRow.insertAdjacentHTML('afterend', `
      <div class="goal-card" id="goal-block">
        <div class="goal-card-head">
          <span class="goal-card-title"><i class="ti ti-target"></i> Presence Goal</span>
          <button class="goal-edit-btn" id="goal-edit-btn">${reached ? 'Set new goal' : 'Edit goal'}</button>
        </div>
        <p class="goal-explain">Your Presence Score averages your measured signals into one number out of 100. Set a target to work toward - we show how close you are and flag the month you hit it.</p>
        <div class="goal-bar"><div class="goal-fill ${reached ? 'reached' : ''}" style="width:${pct}%"></div></div>
        <div class="goal-stat">${reached
          ? `<strong>Goal reached</strong> - you hit ${goal}.`
          : `<strong>${score}</strong> of <strong>${goal}</strong> &middot; ${pct}% there`}</div>
        <div class="goal-eta"><i class="ti ti-clock"></i> ${eta}</div>
        <div class="goal-edit hidden" id="goal-edit">
          <label class="goal-edit-label">Target Presence Score (1-100)</label>
          <div class="goal-edit-row">
            <input type="number" min="1" max="100" id="goal-input" value="${goal}" />
            <button class="goal-save-btn" id="goal-save-btn">Save goal</button>
          </div>
          <p class="goal-edit-hint">Most local businesses aim for 80+, the range where you are consistently ahead of nearby competitors.</p>
        </div>
      </div>
    `);
    const editBtn = document.getElementById('goal-edit-btn');
    const editBox = document.getElementById('goal-edit');
    if (editBtn && editBox) editBtn.onclick = () => editBox.classList.toggle('hidden');
    const saveBtn = document.getElementById('goal-save-btn');
    if (saveBtn) saveBtn.onclick = () => {
      let v = parseInt(document.getElementById('goal-input').value, 10);
      if (!v || v < 1) v = 1; if (v > 100) v = 100;
      lsSet(key, String(v));
      renderGoalBlock(score);
    };
  }

  function renderOverview() {
    const mr = state.data.masterRecord;
    const snapshots = state.data.snapshots;
    const plan = mr.plan;
    const status = mr.status;

    if (status === 'cancelled') { navigateTo('reactivation'); return; }
    if (snapshots.length === 0) return;

    const curr = latest();
    const prevSnap = prev();
    const isFirstVisit = snapshots.length === 1;

    // Banners
    document.getElementById('overview-new-report-banner').classList.toggle('hidden', !isNewReport(curr));
    document.getElementById('overview-paused-banner').classList.toggle('hidden', status !== 'paused');

    // Welcome block
    const welcomeEl = document.getElementById('overview-welcome');
    if (isFirstVisit) {
      welcomeEl.classList.remove('hidden');
      document.getElementById('overview-welcome-title').textContent = `Welcome, ${mr.business_name}`;
      document.getElementById('overview-welcome-sub').textContent = 'This is your first report. Deltas appear from Report #2 onwards.';
    } else {
      welcomeEl.classList.add('hidden');
    }

    const score = calcPresenceScore(curr, plan);
    const fieldsAllPS = getSignalFields(plan);
    const measuredPS = fieldsAllPS.filter(f => curr[f.field] !== null && curr[f.field] !== undefined).length;
    const prevScore = prevSnap ? calcPresenceScore(prevSnap, plan) : null;
    const scoreDelta = prevScore !== null ? score - prevScore : null;
    const days = daysUntilNext(mr.run_day);
    const streak = calcStreak(snapshots, plan);
    const velocity = calcVelocity(snapshots, plan);

    const momentumClass = streak >= 2 ? 'momentum-up' : (scoreDelta !== null && scoreDelta < -1 ? 'momentum-down' : '');

    // Presence Hero
    document.getElementById('presence-hero').innerHTML = `
      <div class="presence-score-block">
        <div class="presence-label">Presence Score</div>
        <div class="presence-number ${momentumClass}">${score}</div>
        ${scoreDelta !== null
          ? `<div class="presence-delta ${scoreDelta >= 0 ? 'delta-up' : 'delta-down'}">${scoreDelta >= 0 ? '↑' : '↓'} ${Math.abs(scoreDelta)} pts this month</div>`
          : `<div class="presence-delta delta-neutral">First report - baseline set</div>`}
        <div class="presence-chips">
          ${velocity !== null ? `<span class="velocity-chip ${velocity >= 0 ? 'positive' : 'negative'}">${velocity > 0 ? '+' : ''}${velocity} pts/mo avg</span>` : ''}
          ${streak >= 2 ? `<span class="streak-chip">🔥 ${streak}-month streak</span>` : ''}
        </div>
        <div class="presence-meta">Report #${curr.report_number} · ${monthLabel(curr.snapshot_date)} · ${measuredPS} of ${fieldsAllPS.length} signals measured</div>
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
    const statsFields = [
      { field: 'maps_rank_kw1',      label: 'Maps Rank',   lowerBetter: true, suffix: '' },
      { field: 'google_star_rating', label: 'Star Rating', lowerBetter: false, suffix: '★' },
      { field: 'mobile_pagespeed',   label: 'PageSpeed',   lowerBetter: false, suffix: '' },
      {
        field: plan === 'lite' ? 'google_review_count' : 'domain_authority',
        label: plan === 'lite' ? 'Reviews' : 'Domain Auth',
        lowerBetter: false, suffix: '',
      },
    ];
    document.getElementById('stats-row').innerHTML = statsFields.map(sf => {
      const v = curr[sf.field];
      const d = calcDelta(curr, prevSnap, sf.field);
      const dc = deltaClass(d, sf.lowerBetter);
      const arrow = d !== null ? deltaArrow(d, sf.lowerBetter) : null;
      return `
        <div class="stat-card">
          <div class="stat-label">${sf.label}</div>
          <div class="stat-value">${v !== null && v !== undefined ? v + sf.suffix : '<span class="null-value">-</span>'}</div>
          ${arrow ? `<div class="stat-delta ${dc}">${arrow}</div>` : `<div class="stat-delta neutral">${v !== null && v !== undefined ? 'First report' : 'Not measured'}</div>`}
        </div>
      `;
    }).join('');

    // Since-your-last-visit recap + Presence Goal (deploy-today additions)
    renderSinceLastVisit(curr, score);
    renderGoalBlock(score);

    // Priority action (unchanged logic)
    renderPriorityAction(curr, prevSnap, plan);

    // ── Intelligence Brief (unique to Overview - lives nowhere else) ──
    removeInjected('intel-brief');
    {
      const bigWin = snapshots.length >= 2 ? getBiggestAllTimeWin(snapshots, plan) : null;
      const weakest = getWeakestField(curr, plan);
      const firstScore = snapshots.length >= 2 ? calcPresenceScore(snapshots[0], plan) : null;
      const totalGain = firstScore !== null ? score - firstScore : null;
      const months = snapshots.length;
      const healthy = getSignalFields(plan).filter(f => scoreSignal(f.field, curr[f.field]) >= 70).length;
      const total = getSignalFields(plan).length;

      let brief = '';
      if (streak >= 3) {
        brief = `${streak} consecutive months of improvement - your longest run since joining.`;
      } else if (streak === 2) {
        brief = `2 months of back-to-back improvement. Keep the momentum going.`;
      } else if (totalGain !== null && totalGain > 0) {
        brief = `+${totalGain} points over ${months} months. You're tracking in the right direction.`;
      } else {
        brief = `${months} month${months !== 1 ? 's' : ''} of data. Here's where to focus next.`;
      }

      let detail = '';
      if (bigWin && bigWin.scoreGain > 5) {
        const suffix = bigWin.suffix || '';
        detail += `Biggest gain: <strong>${bigWin.label}</strong> moved ${bigWin.fromVal}${suffix} → ${bigWin.toVal}${suffix}. `;
      }
      if (weakest) {
        detail += `Next unlock: <strong>${weakest.label}</strong> is your weakest signal right now.`;
      }

      const priorityEl = document.getElementById('priority-action-section');
      priorityEl.insertAdjacentHTML('beforebegin', `
        <div class="intel-brief" id="intel-brief">
          <div class="intel-brief-header">
            <i class="ti ti-brain"></i>
            <span>Monthly Intelligence</span>
          </div>
          <p class="intel-brief-line1">${brief}</p>
          ${detail ? `<p class="intel-brief-line2">${detail}</p>` : ''}
          <div class="intel-brief-chips">
            <span class="intel-chip"><i class="ti ti-checks"></i> ${healthy}/${total} signals healthy</span>
            ${streak >= 2 ? `<span class="intel-chip fire"><i class="ti ti-flame"></i> ${streak}-month streak</span>` : ''}
            ${totalGain !== null && totalGain > 0 ? `<span class="intel-chip positive"><i class="ti ti-trending-up"></i> +${totalGain} pts all-time</span>` : ''}
          </div>
        </div>
      `);
    }

    // ── Spotlight Signals (3 key signals only - full grid lives in Signals tab) ──
    const spotlightFields = getSignalFields(plan).slice(0, 3);
    renderSignalCards('signal-grid-overview', spotlightFields, curr, prevSnap, plan, false);

    // ── Screen Snapshot Row (snippets linking to other screens) ──
    removeInjected('screen-snapshot-row');
    const snapshotItems = [
      { icon: 'ti-chart-line', label: 'Trends', sub: streak >= 2 ? `${streak}-mo streak` : `${snapshots.length} reports`, screen: 'trends' },
      { icon: 'ti-arrows-diff', label: 'Compare', sub: snapshots.length >= 2 ? `${monthLabel(snapshots[snapshots.length-2]?.snapshot_date)} vs ${monthLabel(curr.snapshot_date)}` : 'Needs 2 reports', screen: 'compare' },
      { icon: 'ti-archive', label: 'Reports', sub: `${snapshots.length} report${snapshots.length !== 1 ? 's' : ''} archived`, screen: 'reports' },
      { icon: 'ti-list-check', label: 'Actions', sub: curr.recommended_action ? 'Action this month' : 'All clear', screen: 'actions' },
    ];
    const gridEl = document.getElementById('signal-grid-overview');
    gridEl.insertAdjacentHTML('afterend', `
      <div class="screen-snapshot-row" id="screen-snapshot-row">
        ${snapshotItems.map(item => `
          <button class="snapshot-tile" onclick="window.__navigate('${item.screen}')">
            <i class="ti ${item.icon}"></i>
            <span class="snapshot-tile-label">${item.label}</span>
            <span class="snapshot-tile-sub">${item.sub}</span>
          </button>
        `).join('')}
        ${plan !== 'lite' ? `<button class="snapshot-tile locked" onclick="window.__navigate('ai')">
          <i class="ti ti-robot"></i>
          <span class="snapshot-tile-label">AI Visibility</span>
          <span class="snapshot-tile-sub">${plan === 'agency' ? 'View report' : 'Pro+'}</span>
        </button>` : ''}
      </div>
    `);

    // Buttons
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
      buildLineChart('overview-chart', labels.slice(-3), [{ data: scores.slice(-3), label: 'Presence Score' }]);
    }
  }

  function renderPriorityAction(curr, prevSnap, plan) {
    const container = document.getElementById('priority-action-section');
    let action = getPriorityAction(curr, prevSnap, plan);
    if (curr.recommended_action) action = { icon: 'ti-sparkles', title: "This month's priority action", desc: curr.recommended_action };
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
    const worst = getWeakestField(curr, plan);
    if (!worst) return { icon: 'ti-star', title: 'Keep up the great work', desc: 'All signals are healthy. Keep building reviews and maintaining your GBP profile.' };
    const actions = {
      maps_rank_kw1:        { icon: 'ti-map-pin',        title: 'Improve your Google Maps ranking',     desc: `Your Maps rank for "${state.data.masterRecord.target_keyword_1}" needs work. Add photos weekly, respond to every review, and audit your GBP categories.` },
      mobile_pagespeed:     { icon: 'ti-device-mobile',  title: 'Fix your mobile page speed',           desc: 'Every 1-second delay costs conversions. Compress images, defer non-critical JS, and enable caching.' },
      gbp_completeness_pct: { icon: 'ti-building-store', title: 'Complete your Google Business Profile', desc: 'Incomplete GBPs rank lower. Add services, products, a business description, and check your opening hours.' },
      google_star_rating:   { icon: 'ti-star',           title: 'Earn more 5-star reviews',             desc: 'Your average rating affects click-through rate directly. Follow up with happy customers by text or email.' },
      domain_authority:     { icon: 'ti-link',           title: 'Build quality backlinks',              desc: 'Your domain authority is your digital credibility score. Guest posts, local citations, and PR placements all move this number.' },
      onpage_seo_score:     { icon: 'ti-file-text',      title: 'Fix your on-page SEO',                 desc: 'Review title tags, meta descriptions, and H1s. Each page you optimise competes for more searches.' },
      trustpilot_rating:    { icon: 'ti-star-half',      title: 'Grow your Trustpilot presence',        desc: 'Trustpilot reviews build trust and appear in Google search snippets. Email past customers to share their experience.' },
    };
    return actions[worst.field] || {
      icon: 'ti-trending-up',
      title: `Improve your ${worst.label}`,
      desc: 'This is currently your lowest-scoring signal. A focused month here will move your Presence Score the most.',
    };
  }

  // Agency teaser cards - shows blurred "preview" of data Pro users don't have
  function buildAgencyTeasers(domId) {
    return `
      <div class="agency-teasers-row" id="${domId}">
        <div class="agency-teasers-label"><i class="ti ti-lock"></i> Agency Plan - 3 more signal categories tracked</div>
        <div class="signal-grid" style="margin-top:8px">
          <div class="signal-card teaser-card" onclick="window.__navigate('upgrade','Competitor Tracker')">
            <div class="signal-card-header"><div class="signal-name">Competitor #1 Rank</div><div class="rag-dot gray"></div></div>
            <div class="signal-value teaser-blur">●●●</div>
            <div class="teaser-note">Tracked on Agency</div>
            <div class="teaser-cta">Unlock Competitors →</div>
          </div>
          <div class="signal-card teaser-card" onclick="window.__navigate('upgrade','AI Visibility')">
            <div class="signal-card-header"><div class="signal-name">Google AI Visibility</div><div class="rag-dot gray"></div></div>
            <div class="signal-value teaser-blur" style="font-size:15px">●●●</div>
            <div class="teaser-note">Tracked on Agency</div>
            <div class="teaser-cta">Unlock AI Visibility →</div>
          </div>
          <div class="signal-card teaser-card" onclick="window.__navigate('upgrade','Social Signals')">
            <div class="signal-card-header"><div class="signal-name">Instagram Engagement</div><div class="rag-dot gray"></div></div>
            <div class="signal-value teaser-blur">●●●</div>
            <div class="teaser-note">Tracked on Agency</div>
            <div class="teaser-cta">Unlock Social →</div>
          </div>
        </div>
      </div>
    `;
  }

  // ── SIGNAL CARDS RENDERER ─────────────────────────────────────────────
  // ── Per-signal guidance (deploy-today: Signals expanders) ───────────
  function signalGuidance(field){
    const M = {
      maps_rank_kw1: { why: 'Most local customers choose from the top 3 map results. A higher rank means more calls and visits.', how: 'Add photos weekly, earn and reply to every review, and keep your categories and service areas accurate.' },
      maps_rank_kw2: { why: 'Ranking for a second keyword puts you in front of more local searches.', how: 'Mention this service on your site and in GBP posts, and gather reviews that name it.' },
      maps_rank_kw3: { why: 'A third keyword widens the searches that can find you.', how: 'Create a dedicated page for this service and keep your GBP description relevant to it.' },
      gbp_completeness_pct: { why: 'Google ranks complete profiles higher and shows them more often.', how: 'Fill every field: services, products, hours, description, and attributes.' },
      mobile_pagespeed: { why: 'Slow mobile pages lose visitors and rank lower. Most local searches are on a phone.', how: 'Compress images, defer non-critical scripts, and enable caching.' },
      desktop_pagespeed: { why: 'Desktop speed still affects rankings and the experience for half your visitors.', how: 'Optimise images, reduce heavy plugins, and use a faster host or CDN.' },
      google_star_rating: { why: 'Your star rating decides whether people click you over a competitor.', how: 'Ask happy customers for a review by text or email, and reply to every one.' },
      google_review_count: { why: 'More reviews mean more trust and stronger local ranking.', how: 'Make a review request part of your follow-up after every job.' },
      domain_authority: { why: 'Domain authority is your site\'s credibility score with search engines.', how: 'Earn links from local press, directories, suppliers, and partners.' },
      onpage_seo_score: { why: 'Well-optimised pages rank for more searches.', how: 'Tighten title tags, meta descriptions, and headings on your key pages.' },
      trustpilot_rating: { why: 'Trustpilot ratings appear in Google and build buyer confidence.', how: 'Invite recent customers to leave a Trustpilot review.' },
      backlinks_total: { why: 'Quality links signal authority to Google.', how: 'Pursue local citations, guest posts, and PR mentions.' },
    };
    return M[field] || { why: 'This signal is part of how customers find and judge your business online.', how: 'This is a good month to focus here; small improvements compound over time.' };
  }

  window.__toggleCardInfo = function(btn){
    const g = btn.nextElementSibling;
    if (!g) return;
    const nowHidden = g.classList.toggle('hidden');
    btn.innerHTML = nowHidden
      ? '<i class="ti ti-info-circle"></i> Why this matters'
      : '<i class="ti ti-chevron-up"></i> Hide';
  };

  function renderSignalCards(containerId, fields, curr, prevSnap, plan, showLocked, expanders) {
    const container = document.getElementById(containerId);
    const snapshots = state.data.snapshots;
    let html = '';

    fields.forEach(f => {
      const v = curr[f.field];
      const d = calcDelta(curr, prevSnap, f.field);
      const rag = v !== null && v !== undefined ? ragStatus(f.field, v) : 'gray';
      const dc = deltaClass(d, f.lowerBetter);
      const suffix = f.suffix || '';
      const displayVal = v !== null && v !== undefined ? v + suffix : '-';
      const isPR = isPersonalRecord(snapshots, f.field, f.lowerBetter);
      const range = getSignalRange(snapshots, f.field);
      const g = expanders ? signalGuidance(f.field) : null;

      html += `
        <div class="signal-card">
          <div class="signal-card-header">
            <div class="signal-name">${f.label}</div>
            <div class="rag-dot ${rag}"></div>
          </div>
          <div class="signal-value">${displayVal}
            ${isPR ? '<span class="pr-badge"><i class="ti ti-trophy"></i> Best ever</span>' : ''}
          </div>
          ${d !== null
            ? `<div class="signal-delta ${dc}"><i class="ti ${dc === 'up' ? 'ti-arrow-up' : dc === 'down' ? 'ti-arrow-down' : 'ti-minus'}"></i>${Math.abs(d)}${suffix} from last</div>`
            : `<div class="signal-prev">${v !== null && v !== undefined ? 'First report' : 'Not measured yet'}</div>`}
          ${prevSnap && prevSnap[f.field] !== null && prevSnap[f.field] !== undefined
            ? `<div class="signal-prev">Was: ${prevSnap[f.field]}${suffix}</div>` : ''}
          ${range ? `<div class="signal-range"><span><span class="range-label">Best</span>${range[f.lowerBetter ? 'min' : 'max']}${suffix}</span><span><span class="range-label">Avg</span>${range.avg}${suffix}</span><span><span class="range-label">Worst</span>${range[f.lowerBetter ? 'max' : 'min']}${suffix}</span></div>` : ''}
          ${g ? `<button class="signal-guide-btn" onclick="window.__toggleCardInfo(this)"><i class="ti ti-info-circle"></i> Why this matters</button><div class="signal-guide hidden"><p><strong>Why it matters.</strong> ${g.why}</p><p><strong>How to improve.</strong> ${g.how}</p></div>` : ''}
        </div>
      `;
    });

    // Locked teaser cards for Lite plan
    if (showLocked && plan === 'lite') {
      const proSignals = [
        { name: 'GBP Completeness', hint: 'Are you leaving visibility on the table?' },
        { name: 'Maps Rank KW2',    hint: 'Rank for more searches, get more calls.' },
        { name: 'Maps Rank KW3',    hint: 'Your competitors track this. Do you?' },
        { name: 'Desktop PageSpeed',hint: 'Half your visitors are on desktop.' },
        { name: 'Domain Authority', hint: 'Your SEO credibility score.' },
      ];
      proSignals.forEach(s => {
        html += `
          <div class="signal-card locked" onclick="window.__navigate('upgrade','Pro Signals')">
            <div class="signal-card-header"><div class="signal-name">${s.name}</div><div class="rag-dot gray"></div></div>
            <div class="signal-value blurred">●●●</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${s.hint}</div>
            <div class="lock-overlay"><i class="ti ti-lock"></i><span>Unlock with Pro</span></div>
          </div>
        `;
      });
    }

    container.innerHTML = html;
  }

  // ── S-05/S-06: SIGNALS ───────────────────────────────────────────────
  function renderSignals() {
    const mr = state.data.masterRecord;
    const plan = mr.plan;
    const curr = latest();
    const prevSnap = prev();
    const snapshots = state.data.snapshots;
    const container = document.getElementById('signals-content');
    document.getElementById('signals-title').textContent = plan === 'lite' ? 'Your Signals' : 'All Signals';

    // Signal health bar
    const fields = getSignalFields(plan);
    const health = getHealthCounts(fields, curr);
    const mostImproved = getMostImproved(curr, prevSnap, plan);

    const healthBarHtml = `
      <div class="signal-health-bar">
        <span class="health-label">Signal Health:</span>
        <span class="health-count green-count"><span class="dot"></span><span>${health.green} Healthy</span></span>
        <span class="health-count amber-count"><span class="dot"></span><span>${health.amber} Watch</span></span>
        <span class="health-count red-count"><span class="dot"></span><span>${health.red} Action needed</span></span>
      </div>
      ${mostImproved ? `
        <div class="most-improved-banner">
          <i class="ti ti-trending-up"></i>
          <span><strong>Most improved this month:</strong> ${mostImproved.label} - ${mostImproved.fromVal}${mostImproved.suffix || ''} → ${mostImproved.toVal}${mostImproved.suffix || ''}</span>
        </div>
      ` : ''}
    `;

    if (plan === 'lite') {
      container.innerHTML = healthBarHtml + `<div id="signal-grid-lite" class="signal-grid"></div>`;
      renderSignalCards('signal-grid-lite', getSignalFields('lite'), curr, prevSnap, 'lite', true, true);
    } else {
      const cwvHtml = `
        <div class="section-header"><span class="section-title">Core Web Vitals</span></div>
        <div class="signal-grid" style="margin-bottom:20px">
          ${['lcp','inp','cls'].map(cwv => {
            const v = curr[`cwv_${cwv}_status`];
            const labels = { lcp: 'LCP', inp: 'INP', cls: 'CLS' };
            const descMap = { lcp: 'Largest Contentful Paint', inp: 'Interaction to Next Paint', cls: 'Cumulative Layout Shift' };
            const rag = v === 'Pass' ? 'green' : v === 'Fail' ? 'red' : 'gray';
            return `
              <div class="signal-card">
                <div class="signal-card-header"><div class="signal-name">CWV ${labels[cwv]}</div><div class="rag-dot ${rag}"></div></div>
                <div class="signal-value" style="font-size:16px">${v || '-'}</div>
                <div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${descMap[cwv]}</div>
              </div>`;
          }).join('')}
        </div>
      `;
      // Sort worst-first and optionally filter to what needs attention
      const filter = state.signalFilter || 'all';
      const scored = fields.map(f => {
        const v = curr[f.field];
        const sc = (v === null || v === undefined) ? 999 : scoreSignal(f.field, v);
        const rag = (v === null || v === undefined) ? 'gray' : ragStatus(f.field, v);
        return { f, sc, rag };
      }).sort((a, b) => a.sc - b.sc);
      const attnCount = scored.filter(x => x.rag === 'red' || x.rag === 'amber').length;
      const displayFields = (filter === 'attention'
        ? scored.filter(x => x.rag === 'red' || x.rag === 'amber')
        : scored).map(x => x.f);

      const controlsHtml = `
        <div class="signal-controls">
          <span class="signal-controls-label"><i class="ti ti-arrow-down"></i> Sorted by what needs attention first</span>
          <div class="signal-filter-btns">
            <button class="sig-filter-btn ${filter === 'all' ? 'active' : ''}" id="sig-filter-all">All (${fields.length})</button>
            <button class="sig-filter-btn ${filter === 'attention' ? 'active' : ''}" id="sig-filter-attn">Needs attention (${attnCount})</button>
          </div>
        </div>`;

      container.innerHTML = healthBarHtml + cwvHtml + controlsHtml + `<div id="signal-grid-full" class="signal-grid"></div>`;
      if (displayFields.length === 0) {
        document.getElementById('signal-grid-full').innerHTML = '<div class="signals-allclear"><i class="ti ti-circle-check"></i> Every signal is healthy right now. Nothing needs attention this month.</div>';
      } else {
        renderSignalCards('signal-grid-full', displayFields, curr, prevSnap, plan, false, true);
      }
      const fAll = document.getElementById('sig-filter-all');
      const fAttn = document.getElementById('sig-filter-attn');
      if (fAll) fAll.onclick = () => { state.signalFilter = 'all'; renderSignals(); };
      if (fAttn) fAttn.onclick = () => { state.signalFilter = 'attention'; renderSignals(); };

      // Agency teasers for Pro on signals page
      if (plan === 'pro') {
        const gridEl = document.getElementById('signal-grid-full');
        gridEl.insertAdjacentHTML('afterend', buildAgencyTeasers('agency-teasers-signals'));
      }
    }
  }

  // ── S-07: TRENDS ─────────────────────────────────────────────────────
  function renderTrends() {
    const mr = state.data.masterRecord;
    const plan = mr.plan;

    if (plan === 'lite') {
      renderUpgradePrompt('screen-trends', 'Trend Charts', 'See how every signal moves month by month. Available on Pro and Agency.');
      return;
    }

    const snapshots = state.data.snapshots;

    // Inject slope banner if warranted
    removeInjected('slope-banner');
    const streak = calcStreak(snapshots, plan);
    const scores = snapshots.map(s => calcPresenceScore(s, plan));
    const bestIdx = scores.indexOf(Math.max(...scores));
    const bestMonth = monthLabel(snapshots[bestIdx].snapshot_date);
    const projection = calcProjection(scores);

    if (streak >= 2) {
      const chartCard = document.querySelector('#screen-trends .chart-card.trend-page');
      if (chartCard) {
        chartCard.insertAdjacentHTML('beforebegin', `
          <div class="slope-banner" id="slope-banner">
            <i class="ti ti-flame"></i>
            <span>${streak} consecutive months of improvement. You're on a roll - don't break the chain.</span>
          </div>
        `);
      }
    }

    // Inject projection & best month note
    removeInjected('trends-meta-row');
    const sparklineEl = document.getElementById('sparkline-accordion');
    if (sparklineEl && snapshots.length >= 2) {
      sparklineEl.insertAdjacentHTML('beforebegin', `
        <div class="trends-meta-row" id="trends-meta-row">
          <div class="trends-meta-item"><i class="ti ti-trophy" style="color:#E8400A"></i> <strong>Best month:</strong> ${bestMonth} (score: ${scores[bestIdx]})</div>
          ${projection !== null ? `<div class="trends-meta-item"><i class="ti ti-arrow-narrow-right" style="color:#7FD44B"></i> <strong>Projected next:</strong> ~${projection} pts based on recent trend</div>` : ''}
        </div>
      `);
    }

    if (snapshots.length < 2) {
      document.getElementById('trend-chart').classList.add('hidden');
      document.getElementById('trend-chart-empty').classList.remove('hidden');
    } else {
      document.getElementById('trend-chart').classList.remove('hidden');
      document.getElementById('trend-chart-empty').classList.add('hidden');
      buildTrendChart();
    }

    // Range buttons
    document.querySelectorAll('#trend-range-btns .range-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#trend-range-btns .range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.trendRange = btn.dataset.range;
        buildTrendChart();
      };
    });

    // Benchmark toggle
    document.getElementById('benchmark-toggle').onchange = e => {
      state.benchmarkOn = e.target.checked;
      buildTrendChart();
    };

    // Action-completed annotations note (deploy-today)
    removeInjected('trend-actions-note');
    const doneMonths = snapshots.filter(s => isActionDone(s.report_number)).map(s => monthLabel(s.snapshot_date));
    const sparkEl = document.getElementById('sparkline-accordion');
    if (doneMonths.length && sparkEl) {
      sparkEl.insertAdjacentHTML('beforebegin',
        `<div class="trend-actions-note" id="trend-actions-note"><span class="dot-done"></span> Green points mark months you completed your priority action: ${doneMonths.join(', ')}. Watch how the line responds after each one.</div>`);
    }

    buildSparklines();
  }

  function getFilteredSnapshots() {
    const snaps = state.data.snapshots;
    const range = state.trendRange;
    if (range === 'all') return snaps;
    return snaps.slice(-parseInt(range));
  }

  function computeHealthyTarget(plan){
    const green = {
      maps_rank_kw1: 3, maps_rank_kw2: 3, maps_rank_kw3: 3,
      organic_rank_kw1: 3, organic_rank_kw2: 3, organic_rank_kw3: 3,
      mobile_pagespeed: 90, desktop_pagespeed: 90, gbp_completeness_pct: 95,
      google_star_rating: 4.7, domain_authority: 50, onpage_seo_score: 85,
      trustpilot_rating: 4.7, instagram_engagement_rate: 5, facebook_page_score: 80,
    };
    const fields = getSignalFields(plan);
    let total = 0, count = 0;
    fields.forEach(f => { if (green[f.field] !== undefined) { total += scoreSignal(f.field, green[f.field]); count++; } });
    return count ? Math.round(total / count) : 85;
  }

  function buildTrendChart() {
    if (state.charts['trend-chart']) state.charts['trend-chart'].destroy();
    const snaps = getFilteredSnapshots();
    const plan = state.data.masterRecord.plan;
    const labels = snaps.map(s => monthLabel(s.snapshot_date));
    const scores = snaps.map(s => calcPresenceScore(s, plan));

    // Find best month in filtered range for point highlight
    const maxScore = Math.max(...scores);
    const doneFlags = snaps.map(s => isActionDone(s.report_number));
    const pointRadii = scores.map((s, i) => (doneFlags[i] || s === maxScore) ? 7 : 4);
    const pointBg = doneFlags.map(done => done ? '#3B6D11' : '#E8400A');

    const datasets = [{
      data: scores,
      label: 'Presence Score',
      pointRadius: pointRadii,
      pointHoverRadius: 8,
      pointBackgroundColor: pointBg,
    }];

    // Projection point
    const proj = calcProjection(scores);
    if (proj !== null && state.trendRange !== '3' || scores.length >= 3) {
      const projLabels = [...labels, 'Next →'];
      const projData = [...scores, proj];
      datasets.push({
        data: projData.map((v, i) => i < scores.length ? null : v),
        label: 'Projected',
        borderDash: [5, 4],
        borderColor: 'rgba(127,212,75,0.7)',
        backgroundColor: 'transparent',
        pointRadius: [0, 0, 0, 0, 0, 0, 0, 6].slice(-projData.length),
        pointBackgroundColor: '#7FD44B',
      });
      if (state.benchmarkOn) {
        const ht = computeHealthyTarget(plan);
        datasets.push({ data: projData.map(() => ht), label: `Healthy target (${ht})`, borderDash: [6, 4], borderColor: 'rgba(15,6,56,0.45)', backgroundColor: 'transparent', pointRadius: 0, fill: false });
      }
      buildLineChart('trend-chart', projLabels, datasets);
      return;
    }

    if (state.benchmarkOn) {
      const ht = computeHealthyTarget(plan);
      datasets.push({ data: scores.map(() => ht), label: `Healthy target (${ht})`, borderDash: [6, 4], borderColor: 'rgba(15,6,56,0.45)', backgroundColor: 'transparent', pointRadius: 0, fill: false });
    }
    buildLineChart('trend-chart', labels, datasets);
  }

  function buildSparklines() {
    const plan = state.data.masterRecord.plan;
    const snapshots = state.data.snapshots;
    const fields = getSignalFields(plan);
    const container = document.getElementById('sparkline-accordion');
    container.innerHTML = '';

    fields.forEach((f, i) => {
      const values = snapshots.map(s => s[f.field]).filter(v => v !== null && v !== undefined);
      const curr = latest()[f.field];
      const suffix = f.suffix || '';
      // Check for consecutive decline
      let declining = false;
      if (snapshots.length >= 3) {
        const last3 = snapshots.slice(-3).map(s => s[f.field]).filter(v => v !== null && v !== undefined);
        if (last3.length === 3) {
          if (f.lowerBetter) declining = last3[1] > last3[0] && last3[2] > last3[1];
          else declining = last3[1] < last3[0] && last3[2] < last3[1];
        }
      }

      const item = document.createElement('div');
      item.className = 'sparkline-item';
      item.innerHTML = `
        <div class="sparkline-header">
          <div class="sparkline-header-left">
            <div class="rag-dot ${curr !== null && curr !== undefined ? ragStatus(f.field, curr) : 'gray'}"></div>
            <div class="sparkline-signal-name">${f.label}${declining ? ' <span style="color:#FF7070;font-size:10px;font-weight:700">↓ 2-mo decline</span>' : ''}</div>
          </div>
          <div class="sparkline-current">${curr !== null && curr !== undefined ? curr + suffix : '-'} <i class="ti ti-chevron-down"></i></div>
        </div>
        <div class="sparkline-body" id="spark-body-${i}">
          <canvas id="spark-${i}" height="80"></canvas>
        </div>
      `;
      container.appendChild(item);

      item.querySelector('.sparkline-header').onclick = () => {
        const body = document.getElementById('spark-body-' + i);
        const isOpen = body.classList.contains('open');
        body.classList.toggle('open', !isOpen);
        if (!isOpen && values.length >= 2) {
          const spLabels = snapshots.filter(s => s[f.field] !== null && s[f.field] !== undefined).map(s => monthLabel(s.snapshot_date));
          buildSparklineChart('spark-' + i, spLabels, values);
        }
      };
    });
  }

  // ── S-08: COMPARE ────────────────────────────────────────────────────
  function renderCompare() {
    const plan = state.data.masterRecord.plan;
    if (plan === 'lite') {
      renderUpgradePrompt('screen-compare', 'Compare Reports', 'Pick any two months and see exactly what moved. Available on Pro and Agency.');
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
        `<option value="${i}" ${i === defaultIdx ? 'selected' : ''}>Report #${s.report_number} - ${monthLabel(s.snapshot_date)}</option>`
      ).join('');
    }
    buildOptions(selA, snapshots.length - 2);
    buildOptions(selB, snapshots.length - 1);

    // Elevate the selector UI - it IS the hero of this screen
    const controls = document.getElementById('compare-controls');
    controls.classList.add('compare-controls-hero');

    // "From Day 1" quick button
    removeInjected('compare-day1-btn');
    controls.insertAdjacentHTML('afterend', `
      <div id="compare-day1-btn" class="compare-quick-links">
        <button class="compare-quick-btn" id="btn-compare-day1"><i class="ti ti-calendar-stats"></i> Compare vs. Day 1</button>
        <button class="compare-quick-btn" id="btn-compare-lastmonth"><i class="ti ti-clock"></i> Last month vs. now</button>
      </div>
    `);
    document.getElementById('btn-compare-day1').onclick = () => {
      selA.value = '0';
      selB.value = String(snapshots.length - 1);
      updateCompare();
    };
    document.getElementById('btn-compare-lastmonth').onclick = () => {
      selA.value = String(Math.max(0, snapshots.length - 2));
      selB.value = String(snapshots.length - 1);
      updateCompare();
    };

    function updateCompare() {
      const a = snapshots[parseInt(selA.value)];
      const b = snapshots[parseInt(selB.value)];
      const scoreA = calcPresenceScore(a, plan);
      const scoreB = calcPresenceScore(b, plan);
      const scoreDiff = scoreB - scoreA;
      const fields = getSignalFields(plan);

      // Count improved/declined signals
      let improved = 0, declined = 0, unchanged = 0;
      let biggestField = null, biggestDiff = 0;
      fields.forEach(f => {
        const va = a[f.field], vb = b[f.field];
        if (va === null || va === undefined || vb === null || vb === undefined) return;
        const scoreGain = scoreSignal(f.field, vb) - scoreSignal(f.field, va);
        if (scoreGain > 1) improved++;
        else if (scoreGain < -1) declined++;
        else unchanged++;
        if (Math.abs(scoreGain) > Math.abs(biggestDiff)) { biggestDiff = scoreGain; biggestField = f; }
      });

      // Verdict card
      removeInjected('compare-verdict');
      const verdictColor = scoreDiff > 0 ? '#7FD44B' : scoreDiff < 0 ? '#FF7070' : 'var(--text-secondary)';
      const verdictIcon = scoreDiff > 0 ? 'ti-trending-up' : scoreDiff < 0 ? 'ti-trending-down' : 'ti-minus';
      document.getElementById('compare-summary').insertAdjacentHTML('beforebegin', `
        <div class="verdict-card" id="compare-verdict">
          <div class="verdict-score">
            <div class="verdict-number" style="color:${verdictColor}">${scoreDiff > 0 ? '+' : ''}${scoreDiff}</div>
            <div class="verdict-label">Score change</div>
          </div>
          <div class="verdict-divider"></div>
          <div class="verdict-text">
            <i class="ti ${verdictIcon}" style="color:${verdictColor};margin-right:6px"></i>
            <strong>${improved} signals improved</strong>, ${declined} declined${unchanged > 0 ? `, ${unchanged} unchanged` : ''}.
            ${biggestField && Math.abs(biggestDiff) > 3
              ? `<br><span style="font-size:12px;color:var(--text-secondary)">Biggest move: <strong>${biggestField.label}</strong> ${biggestDiff > 0 ? 'gained' : 'dropped'} ${Math.abs(Math.round(biggestDiff))} score pts.</span>`
              : ''}
          </div>
        </div>
      `);

      document.getElementById('compare-summary').innerHTML = `
        <div class="compare-score-block"><div class="compare-score-label">${monthLabel(a.snapshot_date)}</div><div class="compare-score-value">${scoreA}</div></div>
        <div class="compare-arrow">→</div>
        <div class="compare-score-block"><div class="compare-score-label">${monthLabel(b.snapshot_date)}</div><div class="compare-score-value">${scoreB}</div></div>
        <div class="compare-score-block" style="margin-left:auto">
          <div class="compare-score-label">Change</div>
          <div class="compare-score-value" style="color:${verdictColor}">${scoreDiff >= 0 ? '+' : ''}${scoreDiff}</div>
        </div>
      `;

      document.getElementById('compare-th-a').textContent = monthLabel(a.snapshot_date);
      document.getElementById('compare-th-b').textContent = monthLabel(b.snapshot_date);

      document.getElementById('compare-tbody').innerHTML = fields.map(f => {
        const va = a[f.field], vb = b[f.field];
        const suffix = f.suffix || '';
        const d = (va !== null && va !== undefined && vb !== null && vb !== undefined)
          ? Math.round((vb - va) * 10) / 10 : null;
        const dc = deltaClass(d, f.lowerBetter);
        const arrow = d !== null ? (dc === 'up' ? '↑' : dc === 'down' ? '↓' : '→') + ' ' + Math.abs(d) + suffix : '-';
        return `
          <tr>
            <td>${f.label}</td>
            <td>${va !== null && va !== undefined ? va + suffix : '-'}</td>
            <td class="td-delta ${dc}">${arrow}</td>
            <td>${vb !== null && vb !== undefined ? vb + suffix : '-'}</td>
          </tr>
        `;
      }).join('');
    }

    selA.onchange = updateCompare;
    selB.onchange = updateCompare;
    updateCompare();
  }

  // ── S-09: REPORTS ────────────────────────────────────────────────────
  function renderReports() {
    const snapshots = [...state.data.snapshots].reverse();
    const allSnaps = state.data.snapshots;
    const plan = state.data.masterRecord.plan;
    const status = state.data.masterRecord.status;
    const mr = state.data.masterRecord;
    const container = document.getElementById('reports-content');

    if (snapshots.length === 0) {
      const runDay = mr.run_day;
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), runDay);
      if (next <= now) next.setMonth(next.getMonth() + 1);
      container.innerHTML = `
        <div class="empty-state">
          <i class="ti ti-file-off"></i>
          <p>Your first report will appear here on <strong>${next.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</strong>.</p>
        </div>
      `;
      return;
    }

    // Score journey mini chart above list
    const journeyScores = allSnaps.map(s => calcPresenceScore(s, plan));
    const firstScore = journeyScores[0];
    const latestScore = journeyScores[journeyScores.length - 1];
    const totalGain = latestScore - firstScore;
    const streak = calcStreak(allSnaps, plan);

    const bestScore = Math.max(...journeyScores);
    const bestSnap = allSnaps[journeyScores.indexOf(bestScore)];

    let html = `
      <div class="journey-chart-card">
        <div class="journey-chart-header">
          <div class="journey-chart-title">Your Score Journey</div>
          <div class="journey-chart-stat">
            ${totalGain !== 0 ? `<strong style="color:${totalGain > 0 ? '#7FD44B' : '#FF7070'}">${totalGain > 0 ? '+' : ''}${totalGain} pts total</strong>` : '<span style="color:var(--text-secondary)">First report</span>'}
            ${streak >= 2 ? ` · <span style="color:#E8400A;font-weight:700">🔥 ${streak}-mo streak</span>` : ''}
          </div>
        </div>
        <div style="height:80px;position:relative">
          <canvas id="journey-chart"></canvas>
        </div>
      </div>
    `;

    // Report list
    html += `<div class="reports-list">`;
    snapshots.forEach(s => {
      const score = calcPresenceScore(s, plan);
      const prevIdx = allSnaps.indexOf(s) - 1;
      const prevS = prevIdx >= 0 ? allSnaps[prevIdx] : null;
      const sDelta = prevS ? score - calcPresenceScore(prevS, plan) : null;
      const mi = prevS ? getMostImproved(s, prevS, plan) : null;
      const changeText = prevS
        ? (mi ? `Biggest gain: ${mi.label}` : (sDelta < 0 ? 'Slight dip this month' : 'Held steady'))
        : 'Your baseline report';
      const isBest = score === bestScore && s === bestSnap;
      const newTag = isNewReport(s) ? '<span class="new-report-tag">New</span>' : '';
      const isCancelled = status === 'cancelled';
      const emailSubject = encodeURIComponent(`PDF Report Request - ${mr.business_name} Report #${s.report_number}`);
      const emailBody = encodeURIComponent(`Hi TAMEYO team,\n\nPlease resend the PDF for:\nSubscriber: ${mr.subscriber_id}\nReport: #${s.report_number} (${monthLabel(s.snapshot_date)})\n\nThank you`);
      const dlBtn = isCancelled
        ? `<button class="btn-reactivate" onclick="window.__navigate('reactivation')">Reactivate to download</button>`
        : `<a class="btn-download" href="mailto:service@tameyogroup.com?subject=${emailSubject}&body=${emailBody}"><i class="ti ti-mail"></i> Email PDF</a>`;

      html += `
        <div class="report-row">
          <div class="report-number">Report #${s.report_number}</div>
          <div class="report-date">${monthLabel(s.snapshot_date)}<span class="report-change">${changeText}</span></div>
          <div class="report-score-block">
            <div class="report-score">${score}</div>
            ${sDelta !== null ? `<span class="report-delta ${sDelta >= 0 ? 'pos' : 'neg'}">${sDelta >= 0 ? '+' : ''}${sDelta}</span>` : ''}
            ${isBest ? '<span class="best-report-badge"><i class="ti ti-trophy"></i> Best</span>' : ''}
            ${newTag}
          </div>
          ${dlBtn}
        </div>
      `;
    });
    html += `</div>`;

    // Coming up card
    const days = daysUntilNext(mr.run_day);
    const projNext = calcProjection(journeyScores);
    html += `
      <div class="coming-up-card">
        <div class="coming-up-header"><i class="ti ti-calendar-event"></i> Report #${(allSnaps[allSnaps.length - 1]?.report_number || 0) + 1} arrives in ${days} day${days !== 1 ? 's' : ''}</div>
        ${projNext !== null ? `<div class="coming-up-body">Based on your recent trend, we expect a score around <strong>${projNext}</strong>. Keep working on ${getWeakestField(latest(), plan)?.label || 'your priority signal'} to push it higher.</div>` : ''}
      </div>
    `;

    container.innerHTML = html;

    // Build journey sparkline
    if (allSnaps.length >= 2) {
      setTimeout(() => {
        buildSparklineChart('journey-chart', allSnaps.map(s => monthLabel(s.snapshot_date)), journeyScores);
      }, 50);
    }
  }

  // ── S-10: ACTIONS ────────────────────────────────────────────────────
  function actionImpact(field){
    const M = {
      maps_rank_kw1: 'Moving up the map is the fastest route to more calls and visits.',
      maps_rank_kw2: 'A higher rank here opens a second stream of local searches.',
      maps_rank_kw3: 'Ranking for this term widens the searches that reach you.',
      gbp_completeness_pct: 'A complete profile lifts how often Google shows you.',
      mobile_pagespeed: 'Faster pages keep visitors and help every other ranking.',
      desktop_pagespeed: 'A quicker site improves experience and search position.',
      google_star_rating: 'A better rating raises your click-through from search.',
      google_review_count: 'More reviews build trust and strengthen local ranking.',
      domain_authority: 'More authority helps every page you have rank higher.',
      onpage_seo_score: 'Cleaner on-page SEO wins more searches per page.',
      trustpilot_rating: 'A stronger Trustpilot profile builds buyer confidence.',
    };
    return M[field] || 'Focused effort here moves your Presence Score the most.';
  }

  function renderActions() {
    const plan = state.data.masterRecord.plan;
    if (plan === 'lite') {
      renderUpgradePrompt('screen-actions', 'Action History', 'Every month we surface your #1 priority action. Track what you did and what it moved. Available on Pro and Agency.');
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
      const isDone = lsGet(doneKey) === '1'; // persisted via localStorage (sessionStorage fallback)
      const wf = getWeakestField(s, plan);
      const nextSnap = snapshots[i + 1] || null;
      const scoreThis = calcPresenceScore(s, plan);
      const scoreNext = nextSnap ? calcPresenceScore(nextSnap, plan) : null;
      const loopDelta = scoreNext !== null ? scoreNext - scoreThis : null;
      return { snap: s, action: a, isCurrentMonth, doneKey, isDone, wf, scoreThis, scoreNext, loopDelta };
    }).reverse();

    const doneCount = actionItems.filter(i => i.isDone).length;
    const totalCount = actionItems.length;
    const pct = Math.round((doneCount / totalCount) * 100);

    // Persistent issue alert
    const persistent = getPersistentIssue(snapshots, plan);
    const persistentHtml = persistent ? `
      <div class="persistent-alert">
        <i class="ti ti-alert-circle"></i>
        <div><strong>${persistent.label}</strong> has been your #1 concern for ${persistent.months} consecutive months. This needs focused attention - it's costing you score points every month.</div>
      </div>
    ` : '';

    // Completion meter
    const meterHtml = `
      <div class="completion-meter">
        <div class="completion-meter-header">
          <div class="completion-meter-label">Actions Completed</div>
          <div class="completion-meter-pct">${pct}%</div>
        </div>
        <div class="completion-bar"><div class="completion-fill" style="width:${pct}%"></div></div>
        <div style="font-size:11px;color:var(--text-secondary);margin-top:6px">${doneCount} of ${totalCount} months marked done · ${pct >= 70 ? 'Great discipline - this is what moves the score.' : 'Mark actions done each month to track your impact.'}</div>
      </div>
    `;

    const listHtml = `<div class="actions-list">${actionItems.map((item, idx) => `
      <div class="action-row" id="action-row-${idx}">
        <button class="action-done-toggle ${item.isDone ? 'done' : ''}"
          onclick="window.__toggleAction('${item.doneKey}', ${idx}, this)">
          ${item.isDone ? '<i class="ti ti-check"></i>' : ''}
        </button>
        <div class="action-body">
          <div class="action-text">${item.action.title}</div>
          <div class="action-meta">
            ${monthLabel(item.snap.snapshot_date)} · Affects: ${getWeakestSignalLabel(item.snap, plan)}
            ${item.isCurrentMonth ? '<span class="current-priority-tag">Current priority</span>' : ''}
          </div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${item.action.desc}</div>
          <div class="action-impact"><i class="ti ti-bolt"></i> ${actionImpact(item.wf ? item.wf.field : null)}</div>
          ${item.isDone && item.loopDelta !== null
            ? `<div class="action-loop ${item.loopDelta >= 0 ? 'pos' : 'neg'}"><i class="ti ti-arrow-back-up"></i> After you completed this, your score went ${item.scoreThis} &rarr; ${item.scoreNext} the next month (${item.loopDelta >= 0 ? '+' : ''}${item.loopDelta}).</div>`
            : ''}
          <button class="action-signal-link" onclick="window.__navigate('signals')"><i class="ti ti-arrow-right"></i> See this signal</button>
        </div>
      </div>
    `).join('')}</div>`;

    container.innerHTML = meterHtml + persistentHtml + listHtml;
  }

  window.__toggleAction = function(doneKey, rowIdx, btn) {
    const isDone = lsGet(doneKey) === '1';
    if (isDone) {
      lsSet(doneKey, '0');
      btn.classList.remove('done');
      btn.innerHTML = '';
    } else {
      lsSet(doneKey, '1');
      btn.classList.add('done');
      btn.innerHTML = '<i class="ti ti-check"></i>';
    }
    // Refresh meter
    const subscriberId = state.data.masterRecord.subscriber_id;
    const snapshots = state.data.snapshots;
    let done = 0;
    snapshots.forEach(s => {
      if (lsGet(`action_done_${subscriberId}_${s.report_number}`) === '1') done++;
    });
    const pct = Math.round((done / snapshots.length) * 100);
    const fill = document.querySelector('.completion-fill');
    const pctEl = document.querySelector('.completion-meter-pct');
    if (fill) fill.style.width = pct + '%';
    if (pctEl) pctEl.textContent = pct + '%';
  };

  // ── S-11: COMPETITORS ────────────────────────────────────────────────
  function renderCompetitors() {
    const plan = state.data.masterRecord.plan;
    if (plan !== 'agency') {
      renderUpgradePrompt('screen-competitors', 'Competitor Tracker', 'See exactly where your top 3 competitors rank month by month - and whether you\'re gaining or losing ground. Agency-exclusive.');
      return;
    }

    const mr = state.data.masterRecord;
    const snapshots = state.data.snapshots;
    const curr = latest();
    const container = document.getElementById('competitors-content');

    const hasCompetitors = mr.competitor_1_url || mr.competitor_2_url || mr.competitor_3_url;
    if (!hasCompetitors) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="ti ti-swords"></i>
          <p>No competitor URLs on file. Contact support to add up to 3 competitors.</p>
          <a href="mailto:service@tameyogroup.com" class="btn-upgrade" style="margin-top:12px;font-size:13px;padding:10px 20px;">Contact Support</a>
        </div>`;
      return;
    }

    const competitors = [
      { n: 1, url: mr.competitor_1_url, rank: curr.competitor_1_maps_rank, color: '#E8400A' },
      { n: 2, url: mr.competitor_2_url, rank: curr.competitor_2_maps_rank, color: '#7C3AED' },
      { n: 3, url: mr.competitor_3_url, rank: curr.competitor_3_maps_rank, color: '#0EA5E9' },
    ].filter(c => c.url);

    const myRank = curr.maps_rank_kw1;
    const prevSnap = prev();
    const prevMy = prevSnap ? prevSnap.maps_rank_kw1 : null;
    const overtakes = [];

    const rows = competitors.map(c => {
      const n = c.n;
      const theirRank = c.rank;
      const gap = (myRank != null && theirRank != null) ? theirRank - myRank : null;
      let gapText = 'No rank yet', gapClass = 'level';
      if (gap !== null) {
        if (gap > 0) { gapText = `You are ${gap} spot${gap !== 1 ? 's' : ''} ahead`; gapClass = 'ahead'; }
        else if (gap < 0) { gapText = `You are ${-gap} spot${-gap !== 1 ? 's' : ''} behind`; gapClass = 'behind'; }
        else { gapText = 'Level with you'; gapClass = 'level'; }
      }
      const prevTheir = prevSnap ? prevSnap['competitor_' + n + '_maps_rank'] : null;
      let moveHtml = '';
      if (prevTheir != null && theirRank != null && prevTheir !== theirRank) {
        const improved = theirRank < prevTheir; // lower rank = better
        moveHtml = `<span class="competitor-move ${improved ? 'worse-for-you' : 'better-for-you'}">${improved ? '↑' : '↓'} ${Math.abs(prevTheir - theirRank)} vs last mo</span>`;
      }
      if (prevMy != null && prevTheir != null && myRank != null && theirRank != null) {
        if (prevMy > prevTheir && myRank <= theirRank) overtakes.push({ type: 'win', url: c.url });
        else if (prevMy < prevTheir && myRank > theirRank) overtakes.push({ type: 'loss', url: c.url });
      }
      return `
        <div class="competitor-row">
          <div class="competitor-url">${c.url}</div>
          <div class="competitor-rank" style="color:${c.color}">Rank ${theirRank != null ? theirRank : '-'} ${moveHtml}</div>
          <div class="competitor-gap ${gapClass}">${gapText}</div>
        </div>`;
    }).join('');

    const alertHtml = overtakes.length ? `<div class="competitor-alerts">${overtakes.map(o => o.type === 'win'
      ? `<div class="competitor-alert win"><i class="ti ti-trophy"></i> You overtook ${o.url} this month. Keep the pressure on.</div>`
      : `<div class="competitor-alert loss"><i class="ti ti-alert-triangle"></i> ${o.url} overtook you this month. This is the one to focus on.</div>`).join('')}</div>` : '';

    container.innerHTML = alertHtml + `
      <div class="competitor-grid">${rows}</div>
      <p class="competitor-note">Rankings update each monthly report cycle. Lower rank is better.</p>`;
  }

  // ── S-16: SETTINGS ───────────────────────────────────────────────────
  function renderSettings() {
    const mr = state.data.masterRecord;
    const container = document.getElementById('settings-content');
    const planLabel = (mr.plan || 'lite').charAt(0).toUpperCase() + (mr.plan || 'lite').slice(1);
    const statusLabel = (mr.status || 'active').charAt(0).toUpperCase() + (mr.status || 'active').slice(1);
    const PRICING_URL = 'https://www.tameyogroup.com/pricing-plans';

    container.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-title">ACCOUNT</div>
        <div class="settings-row">
          <span class="settings-label">Business</span>
          <span class="settings-value">${mr.business_name || '-'}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Plan</span>
          <span class="settings-value"><span class="plan-badge plan-${mr.plan}">${planLabel}</span></span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Status</span>
          <span class="settings-value">${statusLabel}</span>
        </div>
        <div class="settings-row">
          <span class="settings-label">Monthly report day</span>
          <span class="settings-value">Day ${mr.run_day || '1'} of each month</span>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">ACCOUNT ACTIONS</div>

        <div class="settings-action-row">
          <div class="settings-action-info">
            <div class="settings-action-title">Upgrade your plan</div>
            <div class="settings-action-sub">Unlock more signals, competitor tracking, and AI visibility</div>
          </div>
          <button class="btn-settings-action btn-settings-upgrade" onclick="window.__openUpgrade('nav')">Upgrade ↑</button>
        </div>

        <div class="settings-action-row">
          <div class="settings-action-info">
            <div class="settings-action-title">Pause subscription</div>
            <div class="settings-action-sub">Keep your data archive. Pause monthly reports any time.</div>
          </div>
          <a href="${PRICING_URL}" target="_blank" class="btn-settings-action btn-settings-pause">Manage</a>
        </div>

        <div class="settings-action-row">
          <div class="settings-action-info">
            <div class="settings-action-title">Cancel subscription</div>
            <div class="settings-action-sub">Need to cancel? Reach out and we'll take care of it.</div>
          </div>
          <a href="mailto:service@tameyogroup.com?subject=Cancel%20Subscription" class="btn-settings-action btn-settings-cancel">Contact Support</a>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-title">SUPPORT</div>
        <div class="settings-row">
          <span class="settings-label">Questions or issues?</span>
          <a href="mailto:service@tameyogroup.com" class="settings-link">service@tameyogroup.com</a>
        </div>
      </div>
    `;
  }

  // ── S-12/13/14: STUBS (upgrade-gated screens) ────────────────────────
  function renderAI() {
    const planAI = state.data.masterRecord.plan;
    if (planAI !== 'agency') {
      renderUpgradePrompt('screen-ai', 'AI Visibility', 'See how your business appears when people ask ChatGPT, Gemini, or Perplexity about your category. Available on Agency.');
      return;
    }
    const currAI = latest();
    const gv = currAI ? currAI.ai_visibility_google : null;
    const cv = currAI ? currAI.ai_visibility_chatgpt : null;
    const hasAI = (gv === 'Present' || gv === 'Absent' || cv === 'Present' || cv === 'Absent');
    const htmlAI = hasAI ? '<div class="signal-grid"><div class="signal-card"><div class="signal-card-header"><div class="signal-name">Google AI Visibility</div><div class="rag-dot ' + (gv === 'Present' ? 'green' : gv === 'Absent' ? 'red' : 'gray') + '"></div></div><div class="signal-value" style="font-size:16px">' + (gv || '-') + '</div></div><div class="signal-card"><div class="signal-card-header"><div class="signal-name">ChatGPT Visibility</div><div class="rag-dot ' + (cv === 'Present' ? 'green' : cv === 'Absent' ? 'red' : 'gray') + '"></div></div><div class="signal-value" style="font-size:16px">' + (cv || '-') + '</div></div></div>' : '<div class="empty-state"><i class="ti ti-brain"></i><p>AI visibility measurement is being set up for your account. It arrives with an upcoming monthly report - no action needed on your side.</p></div>';
    var elAI = document.getElementById('ai-content');
    if (elAI) { elAI.innerHTML = htmlAI; } else { var scAI = document.getElementById('screen-ai'); if (scAI) { var oldAI = scAI.querySelector('.honest-inject'); if (oldAI) oldAI.remove(); scAI.insertAdjacentHTML('beforeend', '<div class="honest-inject">' + htmlAI + '</div>'); } }
  }
  function renderSocial() {
    const planSO = state.data.masterRecord.plan;
    if (planSO !== 'agency') {
      renderUpgradePrompt('screen-social', 'Social Signals', 'Track your Instagram and LinkedIn engagement month over month. Available on Agency.');
      return;
    }
    const currSO = latest();
    const ig = currSO ? currSO.instagram_engagement_rate : null;
    const fb = currSO ? currSO.facebook_page_score : null;
    const sb = currSO ? currSO.instagram_shadowban_status : null;
    const hasSO = (ig !== null && ig !== undefined && ig !== '') || (fb !== null && fb !== undefined && fb !== '');
    const htmlSO = hasSO ? '<div class="signal-grid"><div class="signal-card"><div class="signal-card-header"><div class="signal-name">Instagram Engagement</div><div class="rag-dot ' + ((ig !== null && ig !== undefined && ig !== '') ? ragStatus('instagram_engagement_rate', ig) : 'gray') + '"></div></div><div class="signal-value">' + ((ig !== null && ig !== undefined && ig !== '') ? ig + '%' : '-') + '</div></div><div class="signal-card"><div class="signal-card-header"><div class="signal-name">Facebook Page Score</div><div class="rag-dot ' + ((fb !== null && fb !== undefined && fb !== '') ? ragStatus('facebook_page_score', fb) : 'gray') + '"></div></div><div class="signal-value">' + ((fb !== null && fb !== undefined && fb !== '') ? fb : '-') + '</div></div><div class="signal-card"><div class="signal-card-header"><div class="signal-name">Shadowban Status</div><div class="rag-dot gray"></div></div><div class="signal-value" style="font-size:16px">' + (sb || '-') + '</div></div></div>' : '<div class="empty-state"><i class="ti ti-heart"></i><p>Social signal measurement is being set up for your account. It arrives with an upcoming monthly report - no action needed on your side.</p></div>';
    var elSO = document.getElementById('social-content');
    if (elSO) { elSO.innerHTML = htmlSO; } else { var scSO = document.getElementById('screen-social'); if (scSO) { var oldSO = scSO.querySelector('.honest-inject'); if (oldSO) oldSO.remove(); scSO.insertAdjacentHTML('beforeend', '<div class="honest-inject">' + htmlSO + '</div>'); } }
  }

  // ── UPGRADE PROMPT ───────────────────────────────────────────────────
  function renderUpgradePrompt(screenId, featureName, desc) {
    var screen = document.getElementById(screenId);
    if (!screen) return;

    // Derive inner content div: 'screen-ai' -> 'ai-content'
    var contentId = screenId.replace('screen-', '') + '-content';
    var contentEl = document.getElementById(contentId);

    var upgradeHtml = '<div class="upgrade-prompt-wall">'
      + '<div class="upgrade-lock-icon"><i class="ti ti-lock-filled"></i></div>'
      + '<div class="upgrade-feature-name">' + featureName + '</div>'
      + '<div class="upgrade-feature-desc">' + desc + '</div>'
      + '<a href="https://www.tameyogroup.com/pricing-plans" target="_blank" class="btn-upgrade">Upgrade to Unlock &rarr;</a>'
      + '</div>';

    if (contentEl) {
      contentEl.innerHTML = upgradeHtml;
    } else {
      Array.from(screen.children).forEach(function(child) {
        if (!child.classList.contains('page-title')) child.style.display = 'none';
      });
      var existing = screen.querySelector('.upgrade-prompt-wall');
      if (existing) existing.remove();
      screen.insertAdjacentHTML('beforeend', upgradeHtml);
    }
  }

  // ── CHART BUILDERS ────────────────────────────────────────────────────
  function buildLineChart(canvasId, labels, datasets) {
    if (state.charts[canvasId]) {
      state.charts[canvasId].destroy();
      delete state.charts[canvasId];
    }
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;

    var _g2d = null, _grad = null;
    try { _g2d = canvas.getContext('2d'); } catch (e) {}
    if (_g2d && _g2d.createLinearGradient) {
      _grad = _g2d.createLinearGradient(0, 0, 0, 240);
      _grad.addColorStop(0, 'rgba(232,64,10,0.22)');
      _grad.addColorStop(1, 'rgba(232,64,10,0.00)');
    }

    state.charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets.map(function(ds, i) {
          return {
            label: ds.label || '',
            data: ds.data,
            borderColor: ds.borderColor || '#E8400A',
            backgroundColor: ds.backgroundColor !== undefined ? ds.backgroundColor : (i === 0 && _grad ? _grad : 'rgba(232,64,10,0.10)'),
            pointRadius: ds.pointRadius !== undefined ? ds.pointRadius : 4,
            pointHoverRadius: ds.pointHoverRadius || 6,
            pointBackgroundColor: ds.pointBackgroundColor || '#E8400A',
            borderWidth: ds.borderWidth || 3,
            borderDash: ds.borderDash || [],
            tension: 0.35,
            fill: ds.fill !== undefined ? ds.fill : (i === 0),
            spanGaps: true
          };
        })
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: datasets.length > 1 },
          tooltip: {
            callbacks: {
              label: function(ctx) { return ctx.dataset.label + ': ' + ctx.parsed.y; }
            }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(15,6,56,0.06)' },
            ticks: { color: '#6B6B6B', font: { size: 11 } }
          },
          y: {
            grid: { color: 'rgba(15,6,56,0.06)' },
            ticks: { color: '#6B6B6B', font: { size: 11 }, stepSize: 20 },
            min: 0,
            max: 100
          }
        }
      }
    });
  }

  function buildSparklineChart(canvasId, labels, values) {
    if (state.charts[canvasId]) {
      state.charts[canvasId].destroy();
      delete state.charts[canvasId];
    }
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;

    state.charts[canvasId] = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          data: values,
          borderColor: '#E8400A',
          backgroundColor: 'rgba(232,64,10,0.08)',
          pointRadius: 3,
          pointHoverRadius: 5,
          borderWidth: 2,
          tension: 0.35,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: {
            display: true,
            grid: { display: false },
            ticks: { color: '#8A8FA6', font: { size: 10 } }
          },
          y: {
            display: true,
            grid: { color: 'rgba(255,255,255,0.05)' },
            ticks: { color: '#8A8FA6', font: { size: 10 }, maxTicksLimit: 4 }
          }
        }
      }
    });
  }

  // ── UPGRADE POPUP ────────────────────────────────────────────────────
  function getUpgradeCopy(plan, context) {
    const isLiteToPro = plan === 'lite';
    const targetPlan = isLiteToPro ? 'Pro' : 'Agency';
    const price = isLiteToPro ? '$67' : '$147';
    const checkoutUrl = 'https://www.tameyogroup.com/pricing-plans';
    const features = isLiteToPro ? [
      'Full signal grid (8 signals tracked)',
      'Trend charts and month-on-month history',
      'Compare any two reports side by side',
      'Action history tracker',
      'Desktop PageSpeed and Core Web Vitals',
      'Domain authority and backlinks',
    ] : [
      'Competitor tracker (up to 3 rivals)',
      'AI Visibility in ChatGPT, Gemini and Perplexity',
      'Social signals for Instagram and LinkedIn',
      'Shadowban detection',
      'Organic keyword rankings',
      '15 signals tracked every month',
    ];
    const headline = context === 'nav'
      ? 'Unlock the full power of Monitor'
      : 'Unlock ' + (context || 'this feature');
    const bn = (state.data && state.data.masterRecord && state.data.masterRecord.business_name) || 'your business';
    const sub = 'Upgrade to ' + targetPlan + ' to see this and every other signal we track for ' + bn + ' each month.';
    const urgency = isLiteToPro
      ? 'Pro members catch ranking drops weeks earlier. Your next report is already on the way.'
      : 'Agency members see exactly where rivals are beating them, while there is still time to respond.';
    return { targetPlan, price, checkoutUrl, features, headline, sub, urgency };
  }

  window.__openUpgrade = function(context) {
    const plan = state.data.masterRecord.plan;
    state.upgradeContext = context || 'feature';
    const c = getUpgradeCopy(plan, context);
    document.getElementById('upgrade-modal-content').innerHTML = `
      <div class="upgrade-modal-inner">
        <div class="upgrade-modal-icon"><i class="ti ti-rocket"></i></div>
        <span class="upgrade-modal-eyebrow">${c.targetPlan} plan &middot; ${c.price}/mo</span>
        <h2 id="upgrade-modal-title">${c.headline}</h2>
        <p>${c.sub}</p>
        <div class="upgrade-preview" aria-hidden="true">
          <div class="upgrade-preview-row"><span class="upgrade-preview-name">&bull;&bull;&bull;&bull;&bull;</span><span class="upgrade-preview-val">&bull;&bull;</span></div>
          <div class="upgrade-preview-row"><span class="upgrade-preview-name">&bull;&bull;&bull;&bull;</span><span class="upgrade-preview-val">&bull;&bull;&bull;</span></div>
          <div class="upgrade-preview-row"><span class="upgrade-preview-name">&bull;&bull;&bull;&bull;&bull;&bull;</span><span class="upgrade-preview-val">&bull;&bull;</span></div>
          <span class="upgrade-preview-cap"><i class="ti ti-lock"></i> A peek at what unlocks</span>
        </div>
        <div class="upgrade-features">
          ${c.features.map(f => `<div class="upgrade-feature"><i class="ti ti-check"></i>${f}</div>`).join('')}
        </div>
        <div class="upgrade-modal-urgency"><i class="ti ti-bolt"></i> ${c.urgency}</div>
        <a href="${c.checkoutUrl}" target="_blank" rel="noopener" class="btn-upgrade">Upgrade to ${c.targetPlan} - ${c.price}/mo &rarr;</a>
        <div class="upgrade-reassure"><i class="ti ti-lock-open"></i> Cancel anytime</div>
        <button class="upgrade-modal-later" id="upgrade-modal-later">Maybe later</button>
      </div>
    `;
    const m = document.getElementById('upgrade-modal');
    m.classList.remove('hidden');
    m.onclick = (e) => { if (e.target === m) window.__closeUpgrade(); };
    const x = document.getElementById('upgrade-modal-close');
    if (x) x.onclick = () => window.__closeUpgrade();
    const later = document.getElementById('upgrade-modal-later');
    if (later) later.onclick = () => window.__closeUpgrade();
  };

  window.__closeUpgrade = function() {
    const m = document.getElementById('upgrade-modal');
    if (m) m.classList.add('hidden');
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.__closeUpgrade();
  });

  // Global navigate helper (used by teaser cards, locked cards, reactivation links)
  window.__navigate = function(route, context) {
    if (route === 'upgrade') { window.__openUpgrade(context || 'feature'); return; }
    navigateTo(route, context ? { context: context } : undefined);
  };

  // ── INIT ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', boot);

})();
