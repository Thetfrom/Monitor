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
      state.data = { masterRecord: urlData.masterRecord, snapshots: urlData.snapshots || [], aiVisibilityChecks: urlData.ai_visibility_checks || [], socialSnapshots: urlData.social_snapshots || [], competitorSocial: urlData.competitor_social };
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
        state.data = { masterRecord: msg.masterRecord, snapshots: msg.snapshots, aiVisibilityChecks: msg.ai_visibility_checks || [], socialSnapshots: msg.social_snapshots || [], competitorSocial: msg.competitor_social };
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
      gbp_completeness_pct: [95, 75, 50], google_star_rating: [4.7, 4.3, 3.8], google_review_count: [100, 25, 0],
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
      const measuredIB = getSignalFields(plan).filter(f => curr[f.field] !== null && curr[f.field] !== undefined);
      const healthy = measuredIB.filter(f => scoreSignal(f.field, curr[f.field]) >= 70).length;
      const total = measuredIB.length;

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
            <span class="intel-chip"><i class="ti ti-checks"></i> ${healthy} of ${total} measured signals healthy</span>
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
      { icon: 'ti-chart-line', label: 'Trends', sub: streak >= 2 ? `${streak}-mo streak` : `${snapshots.length} report${snapshots.length !== 1 ? 's' : ''}`, screen: 'trends' },
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
          <span class="snapshot-tile-sub">${plan === 'agency' ? 'View report' : 'Agency'}</span>
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
    var fpEl = document.getElementById('priority-action-section');
    var fpActs = [];
    if (curr) {
      [curr.recommended_action_1, curr.recommended_action_2, curr.recommended_action_3, curr.recommended_action_4, curr.recommended_action_5].forEach(function (t) {
        var s = (t === null || t === undefined) ? '' : String(t).trim();
        if (s && s.toLowerCase() !== 'null') fpActs.push(s);
      });
    }
    if (fpEl && fpActs.length) {
      var fpCap = plan === 'agency' ? 5 : (plan === 'pro' ? 3 : 1);
      var fpEscape = function (s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
      var fpItems = fpActs.slice(0, fpCap).map(function (a, i) {
        return '<div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid #f4f4f8;align-items:flex-start">'
          + '<div style="min-width:26px;height:26px;border-radius:13px;background:#E8400A;color:#ffffff;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center">' + (i + 1) + '</div>'
          + '<div style="font-size:14px;color:#0F0638;line-height:1.5">' + fpEscape(a) + '</div>'
          + '</div>';
      }).join('');
      fpEl.innerHTML = '<div style="background:#ffffff;border:1px solid #ececf4;border-radius:12px;padding:20px 22px">'
        + '<div style="font-size:11px;font-weight:700;color:#E8400A;letter-spacing:1px">YOUR MONTHLY FIX PLAN</div>'
        + '<div style="font-size:12.5px;color:#8a8fa6;margin:4px 0 6px">Ranked by urgency, most important first, compared against your previous reports.</div>'
        + fpItems + '</div>';
      return;
    }

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
    const planC = state.data.masterRecord.plan;
    if (planC !== 'agency') {
      renderUpgradePrompt('screen-competitors', 'Competitor Tracker', 'Track how your direct competitors rank against you on your own keywords. Available on Agency.');
      return;
    }
    var mrC = state.data.masterRecord;
    var snapsC = (state.data.snapshots || []).slice();
    var checksC = state.data.aiVisibilityChecks || state.data.ai_visibility_checks || [];
    var bizC = mrC.business_name || 'You';
    var escC = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var normHLc = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[\u2019\u02BC\u00B4]/g, "'"); };
    var normC = function (s) { return normHLc(s).replace(/\bavenue\b/g, 'ave'); };
    var num = function (v) { if (v === null || v === undefined) return null; if (typeof v === 'number') return isNaN(v) ? null : v; var x = String(v).trim(); if (!x || x === 'null' || x === '-' || x === 'undefined') return null; var n = parseInt(x, 10); return isNaN(n) ? null : n; };
    var pillC = function (txt, bg, fg) { return '<span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;background:' + bg + ';color:' + fg + '">' + txt + '</span>'; };
    var cardC = function (title, sub, inner, full) {
      return '<div class="' + (full ? 'tmc-full' : '') + '" style="background:#fff;border:1px solid #eceaf5;border-radius:14px;padding:18px 20px">'
        + (title ? '<div style="font-weight:700;color:#0F0638;font-size:15px">' + title + '</div>' : '')
        + (sub ? '<div style="font-size:12px;color:#8a8fa6;margin-top:3px;line-height:1.5">' + sub + '</div>' : '')
        + '<div style="margin-top:13px">' + inner + '</div></div>';
    };
    var compsC = [];
    [1, 2, 3].forEach(function (n) {
      var nm = mrC['competitor_' + n + '_name'];
      var url = mrC['competitor_' + n + '_url'];
      if (nm || url) compsC.push({ slot: n, name: nm || '', url: url || '' });
    });
    var htmlC;
    if (!compsC.length) {
      htmlC = '<div class="empty-state"><i class="ti ti-users"></i><p>No competitors are set on your account yet. Once up to three are added, their map ranking and following are tracked here every month beside yours.</p></div>';
    } else {
      snapsC.sort(function (a, b) {
        var ra = num(a.report_number), rb = num(b.report_number);
        if (ra !== null && rb !== null && ra !== rb) return ra - rb;
        return String(a.snapshot_date || '').localeCompare(String(b.snapshot_date || ''));
      });
      var latestC = snapsC.length ? snapsC[snapsC.length - 1] : null;
      var prevC = snapsC.length > 1 ? snapsC[snapsC.length - 2] : null;
      var kw2C = mrC.target_keyword_2 || '';
      var cmpKw = kw2C || mrC.target_keyword_1 || '';
      var myRankOf = function (sn) { if (!sn) return null; return kw2C ? num(sn.maps_rank_kw2) : num(sn.maps_rank_kw1); };
      var myRank = myRankOf(latestC), myPrev = myRankOf(prevC);
      compsC.forEach(function (c) {
        c.rank = latestC ? num(latestC['competitor_' + c.slot + '_maps_rank']) : null;
        c.prev = prevC ? num(prevC['competitor_' + c.slot + '_maps_rank']) : null;
      });
      var ranked = compsC.filter(function (c) { return c.rank !== null; });
      var aheadOfMe = myRank === null ? [] : ranked.filter(function (c) { return c.rank < myRank; });
      var closest = null;
      ranked.forEach(function (c) { if (myRank !== null && c.rank > myRank) { if (!closest || c.rank < closest.rank) closest = c; } });
      var headC, subC, st;
      if (myRank === null) {
        headC = 'Your rank for "' + escC(cmpKw) + '" has not been recorded yet.';
        subC = 'Competitor positions appear here once your next monthly report runs.';
        st = { t: 'Measuring', b: '#f0f0f4', f: '#8a8fa6' };
      } else if (!ranked.length) {
        headC = 'You rank #' + myRank + ' for "' + escC(cmpKw) + '".';
        subC = 'None of your ' + compsC.length + ' tracked competitors have a recorded position yet. Theirs appear on the next monthly report.';
        st = { t: 'Awaiting competitor data', b: '#f0f0f4', f: '#8a8fa6' };
      } else if (!aheadOfMe.length) {
        headC = 'You rank #' + myRank + ' for "' + escC(cmpKw) + '", ahead of every tracked competitor.';
        subC = closest ? 'Closest behind you is ' + escC(closest.name || closest.url) + ' at #' + closest.rank + ', ' + (closest.rank - myRank) + ' place' + (closest.rank - myRank === 1 ? '' : 's') + ' back.' : '';
        st = { t: 'Leading', b: '#e8f7e0', f: '#3f9c1c' };
      } else {
        headC = aheadOfMe.length + ' of your ' + ranked.length + ' tracked competitors rank ahead of you for "' + escC(cmpKw) + '".';
        var best = aheadOfMe.slice().sort(function (a, b) { return a.rank - b.rank; })[0];
        subC = 'You are #' + myRank + '. ' + escC(best.name || best.url) + ' is highest at #' + best.rank + '.';
        st = { t: aheadOfMe.length >= 2 ? 'Losing ground' : 'Under pressure', b: aheadOfMe.length >= 2 ? '#fde8e8' : '#fff4e0', f: aheadOfMe.length >= 2 ? '#c0392b' : '#a86b12' };
      }
      var moveC = '';
      if (myRank !== null && myPrev !== null && myRank !== myPrev) {
        moveC = myRank < myPrev ? 'You moved up ' + (myPrev - myRank) + ' place' + (myPrev - myRank === 1 ? '' : 's') + ' since the last report.' : 'You moved down ' + (myRank - myPrev) + ' place' + (myRank - myPrev === 1 ? '' : 's') + ' since the last report.';
      }
      var actC = myRank === null ? 'Nothing to act on yet. Your first competitor comparison lands with your next monthly report.'
        : aheadOfMe.length ? 'Look at what the businesses above you are doing on this keyword. Local map position moves slowly, so judge it over a few reports, not one.'
        : (moveC ? moveC + ' Hold your position; single-report moves are normal.' : 'Hold your position. Local map rankings move day to day, so treat one change as noise.');
      var verdictC = '<div class="tmc-full" style="background:#fff;border:1px solid #eceaf5;border-radius:14px;padding:20px 22px">'
        + '<div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">'
        + (myRank === null ? '' : '<div style="text-align:center;flex:0 0 auto;min-width:96px"><div style="font-size:40px;font-weight:700;color:#0F0638;line-height:1">#' + myRank + '</div><div style="font-size:11px;color:#8a8fa6;margin-top:3px">your position</div></div>')
        + '<div style="flex:1;min-width:280px">'
        + '<div style="font-size:11px;letter-spacing:.08em;color:#8a8fa6;font-weight:600">COMPETITOR TRACKER' + (latestC && latestC.snapshot_date ? ' &middot; ' + escC(latestC.snapshot_date) : '') + '</div>'
        + '<div style="font-size:21px;line-height:1.3;font-weight:700;margin:8px 0 7px;color:#0F0638">' + headC + '</div>'
        + (subC ? '<div style="font-size:13.5px;color:#5c5f75;line-height:1.6">' + subC + '</div>' : '')
        + '<div style="margin-top:13px">' + pillC(st.t, st.b, st.f) + ' ' + pillC('map rank, monthly', '#f0f0f4', '#8a8fa6') + '</div>'
        + '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #f0f0f4;font-size:13px;color:#3f4157"><b>What to do:</b> ' + actC + '</div>'
        + '</div></div></div>';
      var rowsAll = [{ name: bizC, url: mrC.website_url || '', rank: myRank, prev: myPrev, own: true }]
        .concat(compsC.map(function (c) { return { name: c.name || c.url, url: c.url, rank: c.rank, prev: c.prev, own: false }; }));
      rowsAll.sort(function (a, b) { if (a.rank === null && b.rank === null) return 0; if (a.rank === null) return 1; if (b.rank === null) return -1; return a.rank - b.rank; });
      var h2hRows = rowsAll.map(function (r, i) {
        var mv = (r.rank === null || r.prev === null) ? '<span style="color:#c9c9d6">no prior report</span>'
          : r.rank < r.prev ? '<span style="color:#3f9c1c;font-weight:700">&#9650; up ' + (r.prev - r.rank) + '</span>'
          : r.rank > r.prev ? '<span style="color:#c0392b;font-weight:700">&#9660; down ' + (r.rank - r.prev) + '</span>'
          : '<span style="color:#8a8fa6">no change</span>';
        var gap = (r.own || r.rank === null || myRank === null) ? '' : (r.rank > myRank ? '<span style="color:#3f9c1c">' + (r.rank - myRank) + ' behind you</span>' : '<span style="color:#c0392b">' + (myRank - r.rank) + ' ahead of you</span>');
        return '<tr' + (r.own ? ' style="background:#faf9ff"' : '') + '>'
          + '<td style="padding:10px 8px;border-bottom:1px solid #f4f4f8;color:#c9c9d6;font-weight:700">' + (r.rank === null ? '-' : i + 1) + '</td>'
          + '<td style="padding:10px 8px;border-bottom:1px solid #f4f4f8;' + (r.own ? 'font-weight:700' : '') + '">' + escC(r.name) + (r.own ? ' ' + pillC('you', '#0F0638', '#ffffff') : '') + '</td>'
          + '<td style="padding:10px 8px;border-bottom:1px solid #f4f4f8;font-weight:700;color:#0F0638">' + (r.rank === null ? '<span style="color:#8a8fa6;font-weight:400">not in the top results</span>' : '#' + r.rank) + '</td>'
          + '<td style="padding:10px 8px;border-bottom:1px solid #f4f4f8;font-size:12.5px">' + gap + '</td>'
          + '<td style="padding:10px 8px;border-bottom:1px solid #f4f4f8;font-size:12.5px">' + mv + '</td></tr>';
      }).join('');
      var missingRank = compsC.filter(function (c) { return c.rank === null; }).length;
      var h2h = cardC('Head to head on "' + escC(cmpKw) + '"', 'Google local map position for one keyword, measured ' + (latestC && latestC.snapshot_date ? latestC.snapshot_date : 'on your latest report') + '. Lower is better.' + (function () { var orank = num(latestC ? (kw2C ? latestC.organic_rank_kw2 : latestC.organic_rank_kw1) : null); return orank ? ' On the same search you sit at #' + orank + ' in the regular web results, which is a separate list from the map pack.' : ''; })(),
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px;color:#0F0638"><thead><tr>'
        + '<th style="text-align:left;padding:6px 8px;font-size:10.5px;letter-spacing:.06em;color:#8a8fa6">#</th>'
        + '<th style="text-align:left;padding:6px 8px;font-size:10.5px;letter-spacing:.06em;color:#8a8fa6">BUSINESS</th>'
        + '<th style="text-align:left;padding:6px 8px;font-size:10.5px;letter-spacing:.06em;color:#8a8fa6">MAP RANK</th>'
        + '<th style="text-align:left;padding:6px 8px;font-size:10.5px;letter-spacing:.06em;color:#8a8fa6">GAP</th>'
        + '<th style="text-align:left;padding:6px 8px;font-size:10.5px;letter-spacing:.06em;color:#8a8fa6">VS LAST REPORT</th>'
        + '</tr></thead><tbody>' + h2hRows + '</tbody></table></div>'
        + (missingRank ? '<div style="font-size:12px;color:#8a8fa6;margin-top:10px">' + missingRank + ' competitor' + (missingRank === 1 ? '' : 's') + ' had no recorded position in this report. That means they did not appear in the top local results for this keyword, or they were added since the last run.</div>' : '')
        + (kw2C ? '' : '<div style="font-size:12px;color:#8a8fa6;margin-top:8px">This comparison uses your first keyword because no second keyword is set.</div>'), false);
      var byMDc = {}, orderC = [];
      checksC.forEach(function (c) { var k = c.model + '|' + c.check_date; if (!byMDc[k]) orderC.push(k); byMDc[k] = c; });
      var rowsChk = orderC.map(function (k) { return byMDc[k]; });
      var datesC = [];
      rowsChk.forEach(function (c) { if (datesC.indexOf(c.check_date) === -1) datesC.push(c.check_date); });
      datesC.sort();
      var todayC = datesC[datesC.length - 1];
      var todayRowsC = rowsChk.filter(function (c) { return c.check_date === todayC; });
      var ansC = [];
      todayRowsC.forEach(function (c) { [1, 2, 3].forEach(function (n) { if (c['answer_kw' + n]) ansC.push({ t: c['answer_kw' + n], k: n - 1, m: c.model }); }); });
      var cntC = function (name) { var nn = normC(name); if (!nn) return 0; return ansC.filter(function (a) { return normC(a.t).indexOf(nn) !== -1; }).length; };
      var sovPanel;
      if (!ansC.length) {
        sovPanel = cardC('Who the AIs name most', 'How often each business appears in stored AI answers.', '<div style="padding:16px;background:#faf9ff;border-radius:10px;font-size:12.5px;color:#8a8fa6">No AI answers stored yet. This fills in from your daily AI checks.</div>', false);
      } else {
        var entsC = [{ n: bizC, own: true }].concat(compsC.filter(function (c) { return c.name; }).map(function (c) { return { n: c.name, own: false }; }));
        entsC.forEach(function (en) { en.c = cntC(en.n); });
        var maxSov = Math.max.apply(null, entsC.map(function (en) { return en.c; }).concat([1]));
        var sovRows = entsC.slice().sort(function (a, b) { return b.c - a.c; }).map(function (en) {
          var p = Math.round(en.c / ansC.length * 100);
          return '<div style="margin-bottom:12px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px"><span style="color:#0F0638;' + (en.own ? 'font-weight:700' : '') + '">' + escC(en.n) + (en.own ? ' ' + pillC('you', '#0F0638', '#ffffff') : '') + '</span><span style="color:#5c5f75"><b>' + p + '%</b> <span style="color:#a9aabb;font-size:11.5px">' + en.c + '/' + ansC.length + '</span></span></div>'
            + '<div style="height:8px;background:#f4f4f8;border-radius:99px;overflow:hidden"><div style="height:8px;width:' + Math.round(en.c / maxSov * 100) + '%;background:' + (en.own ? '#0F0638' : '#c5c3dc') + ';border-radius:99px"></div></div></div>';
        }).join('');
        sovPanel = cardC('Who the AIs name most', 'Across ' + ansC.length + ' AI answers stored on ' + escC(todayC) + '. This is measured daily, unlike the map ranks above.', sovRows + '<div style="font-size:12px;color:#8a8fa6;margin-top:4px;padding-top:10px;border-top:1px solid #f4f4f8">These are the same figures as your AI Visibility page.</div>', false);
      }
      var kwNamesC = [mrC.target_keyword_1 || '', mrC.target_keyword_2 || '', mrC.target_keyword_3 || ''];
      var beats = [];
      todayRowsC.forEach(function (c) {
        [1, 2, 3].forEach(function (n) {
          var kn = kwNamesC[n - 1]; if (!kn) return;
          var ans = c['answer_kw' + n]; if (!ans) return;
          if (c['kw' + n + '_mentioned'] === 'yes') return;
          compsC.forEach(function (comp) {
            if (!comp.name) return;
            if (normC(ans).indexOf(normC(comp.name)) !== -1) beats.push({ m: c.model, k: kn, c: comp.name });
          });
        });
      });
      var beatsInner = beats.length
        ? beats.map(function (b) {
            return '<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid #f4f4f8">'
              + '<div style="width:8px;height:8px;border-radius:50%;background:#c0392b;margin-top:5px;flex:0 0 auto"></div>'
              + '<div style="font-size:12.5px;color:#3f4157;line-height:1.5"><b>' + escC(b.c) + '</b> is named by <b>' + escC(b.m).toUpperCase() + '</b> for "' + escC(b.k) + '" and you are not</div></div>';
          }).join('') + '<div style="font-size:12px;color:#8a8fa6;margin-top:11px;padding-top:10px;border-top:1px solid #f4f4f8">Each line is a question where a customer hears about them instead of you.</div>'
        : '<div style="padding:16px;background:#f4fbf0;border-radius:10px;font-size:13px;color:#2f7a12">There is no answer today where a tracked competitor is named and you are not.</div>';
      var beatsPanel = cardC('Where they beat you in AI answers', 'Keyword and model combinations where a competitor appears and your business does not.', beatsInner, false);
      var whyRows = compsC.map(function (c) {
        return '<div style="padding:9px 0;border-top:1px solid #f4f4f8;font-size:13px;color:#3f4157"><b>' + escC(c.name || 'Not named yet') + '</b>'
          + (c.url ? '<div style="font-size:12px;color:#8a8fa6;margin-top:2px">' + escC(c.url.replace(/^https?:\/\//, '')) + '</div>' : '<div style="font-size:12px;color:#a86b12;margin-top:2px">No website recorded, so no map rank can be matched for this slot</div>')
          + '</div>';
      }).join('');
      var whyPanel = cardC('How these ' + compsC.length + ' are tracked', 'Set on your account, then measured in the same search as you, every month.',
        '<div style="font-size:12.5px;color:#3f4157;line-height:1.7">'
        + 'They are the businesses set on your account for tracking. Nothing here is picked automatically.<br><br>'
        + 'Every month your keyword is searched in your area and the businesses in those local results are recorded. Where one of these appears, its position is taken from that same search, on the same day as your own, so the comparison is like for like.<br><br>'
        + 'Rank, following and activity are measured the same way for them as for you.<br>'
        + '<span style="color:#6b6b6b;font-size:12px">Opening hours are not part of this check.</span>'
        + '</div>' + whyRows
        + '<div style="font-size:12px;color:#8a8fa6;margin-top:11px;padding-top:10px;border-top:1px solid #f4f4f8">Nothing on this panel is estimated. When one of them is missing from the results for a month, that month is left blank rather than filled in.</div>', false);
      var seriesC = [{ name: bizC, own: true, vals: snapsC.map(myRankOf) }].concat(compsC.map(function (c) {
        return { name: c.name || c.url, own: false, vals: snapsC.map(function (sn) { return num(sn['competitor_' + c.slot + '_maps_rank']); }) };
      }));
      var anyPt = 0;
      seriesC.forEach(function (s2) { s2.vals.forEach(function (v) { if (v !== null) anyPt++; }); });
      var trendInnerC;
      if (snapsC.length < 2 || !anyPt) {
        trendInnerC = '<div style="height:150px;display:flex;align-items:center;justify-content:center;background:#faf9ff;border-radius:10px;color:#8a8fa6;font-size:12.5px;text-align:center;padding:0 18px">A rank line needs at least two recorded reports. You have ' + snapsC.length + '.</div>';
      } else {
        var W2 = 520, H2 = 150, PADL = 26, PADB = 20;
        var allV = [];
        seriesC.forEach(function (s2) { s2.vals.forEach(function (v) { if (v !== null) allV.push(v); }); });
        var maxV = Math.max.apply(null, allV.concat([5]));
        var stepX2 = (W2 - PADL) / Math.max(1, snapsC.length - 1);
        var yOf = function (v) { return ((v - 1) / Math.max(1, maxV - 1)) * (H2 - PADB); };
        var cols = ['#0F0638', '#c0392b', '#3f9c1c', '#d98b0f'];
        var paths = seriesC.map(function (s2, si) {
          var col = s2.own ? cols[0] : cols[(si % 3) + 1];
          var d = '', dots = '', open = false;
          s2.vals.forEach(function (v, i) {
            if (v === null) { open = false; return; }
            var x = PADL + i * stepX2, y = yOf(v);
            d += (open ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1) + ' ';
            dots += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3.2" fill="' + col + '"></circle>';
            open = true;
          });
          return '<path d="' + d + '" fill="none" stroke="' + col + '" stroke-width="' + (s2.own ? 2.6 : 1.8) + '" stroke-linejoin="round"></path>' + dots;
        }).join('');
        var xLabels = snapsC.map(function (sn, i) {
          return '<text x="' + (PADL + i * stepX2).toFixed(1) + '" y="' + (H2 - 4) + '" text-anchor="middle" font-size="9" fill="#8a8fa6">#' + (num(sn.report_number) || (i + 1)) + '</text>';
        }).join('');
        var legend = seriesC.map(function (s2, si) {
          var col = s2.own ? cols[0] : cols[(si % 3) + 1];
          var shown = s2.vals.filter(function (v) { return v !== null; }).length;
          return '<span style="display:inline-flex;align-items:center;gap:5px;margin-right:13px;font-size:11.5px;color:#3f4157"><span style="width:9px;height:3px;background:' + col + ';display:inline-block;border-radius:2px"></span>' + escC(s2.name) + (shown ? '' : ' <span style="color:#a9aabb">(no data)</span>') + '</span>';
        }).join('');
        var dateSet = [];
        snapsC.forEach(function (sn) { if (sn.snapshot_date && dateSet.indexOf(sn.snapshot_date) === -1) dateSet.push(sn.snapshot_date); });
        trendInnerC = '<svg viewBox="0 0 ' + W2 + ' ' + H2 + '" style="width:100%;height:150px;display:block">'
          + '<text x="0" y="10" font-size="9" fill="#c9c9d6">#1</text><text x="0" y="' + (H2 - PADB) + '" font-size="9" fill="#c9c9d6">#' + maxV + '</text>'
          + paths + xLabels + '</svg>'
          + '<div style="margin-top:9px">' + legend + '</div>'
          + (dateSet.length < 2 ? '<div style="font-size:12px;color:#a86b12;margin-top:9px">All ' + snapsC.length + ' reports so far carry the same date, so this shows report order rather than movement over time. It becomes a real timeline as your weekly runs land.</div>' : '<div style="font-size:12px;color:#8a8fa6;margin-top:9px">' + dateSet.length + ' report dates from ' + escC(dateSet[0]) + ' to ' + escC(dateSet[dateSet.length - 1]) + '.</div>');
      }
      var duoC = (function () {
      var L = snapsC.length;
      var dts = snapsC.map(function (sn) { return sn.snapshot_date || ''; });
      var rows = seriesC.map(function (s) {
        var last = L ? s.vals[L - 1] : null;
        var prev = L > 1 ? s.vals[L - 2] : null;
        return { name: s.name, own: s.own, vals: s.vals, last: last, prev: prev };
      });
      var ranked = rows.slice().sort(function (a, b) {
        if (a.last === null && b.last === null) return 0;
        if (a.last === null) return 1;
        if (b.last === null) return -1;
        return a.last - b.last;
      });
      var spark = function (r, light) {
        var nn = r.vals.filter(function (v) { return v !== null; });
        if (!nn.length) return '';
        var lo = Math.min.apply(null, nn), hi = Math.max.apply(null, nn);
        var n = r.vals.length, w = 60, h = 16, p = 3;
        var sx2 = n > 1 ? (w - p * 2) / (n - 1) : 0;
        var y2 = function (v) { return hi === lo ? h / 2 : (p + (v - lo) / (hi - lo) * (h - p * 2)); };
        var d2 = '', o2 = false, lastPt = '';
        r.vals.forEach(function (v, ix) {
          if (v === null) { o2 = false; return; }
          var X = (p + ix * sx2).toFixed(1), Y = y2(v).toFixed(1);
          d2 += (o2 ? ' L' : ' M') + X + ',' + Y; o2 = true; lastPt = '<circle cx="' + X + '" cy="' + Y + '" r="2.5" fill="' + (light ? '#ffffff' : '#888780') + '"></circle>';
        });
        return '<svg viewBox="0 0 60 16" style="width:60px;height:16px;flex:none"><path d="' + d2.replace(/^ /, '') + '" fill="none" stroke="' + (light ? '#ffffff' : '#888780') + '" stroke-width="1.5"></path>' + lastPt + '</svg>';
      };
      var move = function (r) {
        if (r.last === null) return ['not in top results', '#8a8fa6'];
        if (r.prev === null) return [L > 1 ? 'newly ranked' : 'first report', '#8a8fa6'];
        if (r.last < r.prev) return ['up ' + (r.prev - r.last), '#3B6D11'];
        if (r.last > r.prev) return ['down ' + (r.last - r.prev), '#A32D2D'];
        return [r.own ? 'held #' + r.last : 'no change', r.own ? '#CECBF6' : '#8a8fa6'];
      };
      var ladder = ranked.map(function (r) {
        var mv = move(r);
        var rankTxt = r.last === null ? '-' : '#' + r.last;
        if (r.own) {
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#0F0638;border-radius:10px;margin-bottom:6px">'
            + '<div style="font-size:15px;font-weight:700;color:#ffffff;min-width:32px">' + rankTxt + '</div>'
            + '<div style="flex:1;font-size:12.5px;font-weight:700;color:#ffffff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escC(r.name) + ' <span style="background:#E8400A;color:#ffffff;font-size:10px;padding:2px 7px;border-radius:10px">you</span></div>'
            + spark(r, true)
            + '<div style="font-size:10.5px;color:' + mv[1] + ';min-width:60px;text-align:right">' + mv[0] + '</div></div>';
        }
        return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-bottom:1px solid #f4f4f8">'
          + '<div style="font-size:13px;font-weight:700;color:#8a8fa6;min-width:32px">' + rankTxt + '</div>'
          + '<div style="flex:1;font-size:12.5px;color:#0F0638;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escC(r.name) + '</div>'
          + spark(r, false)
          + '<div style="font-size:10.5px;color:' + mv[1] + ';min-width:60px;text-align:right">' + mv[0] + '</div></div>';
      }).join('');
      var insL = (function () {
        var own = null; var ups = 0, downs = 0, news = 0;
        rows.forEach(function (r) {
          if (r.own) { own = r; return; }
          if (r.last === null) return;
          if (r.prev === null) { news++; return; }
          if (r.last < r.prev) ups++; else if (r.last > r.prev) downs++;
        });
        var bits = [];
        if (own && own.last !== null) {
          if (own.prev === null) bits.push('You enter the board at #' + own.last + '.');
          else if (own.last < own.prev) bits.push('You climbed ' + (own.prev - own.last) + ' to #' + own.last + '.');
          else if (own.last > own.prev) bits.push('You slipped ' + (own.last - own.prev) + ' to #' + own.last + '.');
          else bits.push('You held #' + own.last + '.');
        } else if (own) {
          bits.push('You are not in the top local results this report.');
        }
        if (ups || downs || news) {
          var m = [];
          if (ups) m.push(ups + ' climbed');
          if (downs) m.push(downs + ' fell');
          if (news) m.push(news + ' entered');
          bits.push('Around you: ' + m.join(', ') + '.');
        } else if (L > 1) {
          bits.push('No competitor moved since the last report.');
        }
        return bits.length ? '<div style="border-left:3px solid #E8400A;padding:8px 12px;background:#FFF3ED;margin-top:12px"><div style="font-size:12.5px;color:#0F0638;line-height:1.55">' + bits.join(' ') + '</div></div>' : '';
      })();
      var ladderCard = cardC('Local pack standings', 'Positions from your latest report' + (dts[L - 1] ? ', ' + dts[L - 1] : '') + '. Movement compares against the report before.', ladder + insL);
      var raceInner;
      var anyPts = 0;
      rows.forEach(function (r) { r.vals.forEach(function (v) { if (v !== null) anyPts++; }); });
      if (L < 2 || anyPts < 2) {
        raceInner = '<div style="font-size:12.5px;color:#8a8fa6;padding:12px 0">The race view draws itself once you have at least two reports with positions. Not shown rather than guessed.</div>';
      } else {
        var allV = [];
        rows.forEach(function (r) { r.vals.forEach(function (v) { if (v !== null) allV.push(v); }); });
        var rMax = Math.max(5, Math.max.apply(null, allV));
        var W3 = 460, H3 = 170, P3 = 12, LBL = 120;
        var xs = function (ix) { return (P3 + ix * ((W3 - P3 * 2 - LBL) / Math.max(1, L - 1))).toFixed(1); };
        var ys = function (v) { return (P3 + 10 + (v - 1) / Math.max(1, rMax - 1) * (H3 - P3 * 2 - 30)).toFixed(1); };
        var pal = ['#1D9E75', '#D85A30', '#D4537E'];
        var ci = 0;
        var labs = [];
        var linesH = rows.map(function (r) {
          var col = r.own ? '#0F0638' : pal[ci++ % 3];
          var d3 = '', o3 = false, lx = null, ly = null;
          r.vals.forEach(function (v, ix) {
            if (v === null) { o3 = false; return; }
            var X = xs(ix), Y = ys(v);
            d3 += (o3 ? ' L' : ' M') + X + ',' + Y; o3 = true; lx = X; ly = Y;
          });
          if (!d3) return '';
          var nm = r.own ? 'You' : r.name;
          if (nm.length > 16) nm = nm.slice(0, 15) + '\u2026';
          labs.push({ x: parseFloat(lx) + 8, y: parseFloat(ly) + 4, dotY: parseFloat(ly), txt: escC(nm) + (r.last === null ? '' : ' #' + r.last), col: col, own: r.own });
          return '<path d="' + d3.replace(/^ /, '') + '" fill="none" stroke="' + col + '" stroke-width="' + (r.own ? 3 : 2) + '"></path>'
            + '<circle cx="' + lx + '" cy="' + ly + '" r="' + (r.own ? 4.5 : 3.5) + '" fill="' + col + '"></circle>';
        }).join('');
        labs.sort(function (a, b) { return a.y - b.y; });
        for (var li = 1; li < labs.length; li++) {
          if (labs[li].y - labs[li - 1].y < 13) labs[li].y = labs[li - 1].y + 13;
        }
        for (var lj = labs.length - 1; lj >= 0; lj--) {
          var maxLY = H3 - 18 - (labs.length - 1 - lj) * 13;
          if (labs[lj].y > maxLY) labs[lj].y = maxLY;
        }
        labs.forEach(function (lb) {
          if (Math.abs(lb.y - 4 - lb.dotY) > 6) {
            linesH += '<line x1="' + (lb.x - 4) + '" y1="' + lb.dotY + '" x2="' + (lb.x + 1) + '" y2="' + (lb.y - 4) + '" stroke="' + lb.col + '" stroke-width="0.7" opacity="0.5"></line>';
          }
          linesH += '<text x="' + lb.x + '" y="' + lb.y + '" font-size="10.5" font-weight="' + (lb.own ? '700' : '400') + '" fill="' + lb.col + '">' + lb.txt + '</text>';
        });
        raceInner = '<svg viewBox="0 0 ' + W3 + ' ' + H3 + '" style="width:100%">'
          + '<line x1="' + P3 + '" y1="' + ys(1) + '" x2="' + (W3 - P3) + '" y2="' + ys(1) + '" stroke="#f0f0f6"></line>'
          + '<line x1="' + P3 + '" y1="' + ys(rMax) + '" x2="' + (W3 - P3) + '" y2="' + ys(rMax) + '" stroke="#f0f0f6"></line>'
          + '<text x="' + P3 + '" y="' + (parseFloat(ys(1)) - 5) + '" font-size="9.5" fill="#b9bccb">#1 top of the pack</text>'
          + '<text x="' + P3 + '" y="' + (parseFloat(ys(rMax)) + 12) + '" font-size="9.5" fill="#b9bccb">#' + rMax + '</text>'
          + linesH
          + '<text x="' + P3 + '" y="' + (H3 - 2) + '" font-size="9.5" fill="#b9bccb">' + escC(dts[0] || '') + '</text>'
          + '<text x="' + xs(L - 1) + '" y="' + (H3 - 2) + '" font-size="9.5" fill="#b9bccb" text-anchor="middle">' + escC(dts[L - 1] || '') + '</text>'
          + '</svg>';
      }
      var insR = '';
      if (L >= 2) {
        var movers = [];
        rows.forEach(function (r) {
          var first = null, lastv = null;
          r.vals.forEach(function (v) { if (v !== null) { if (first === null) first = v; lastv = v; } });
          if (first === null || lastv === null) return;
          movers.push({ name: r.name, own: r.own, d: first - lastv });
        });
        var best = null, worst = null;
        movers.forEach(function (m) {
          if (!best || m.d > best.d) best = m;
          if (!worst || m.d < worst.d) worst = m;
        });
        var rl = [];
        if (best && best.d > 0) rl.push((best.own ? 'You are' : escC(best.name) + ' is') + ' the fastest climber on the board, up ' + best.d + ' spot' + (best.d === 1 ? '' : 's') + ' across your reports.');
        if (worst && worst.d < 0) rl.push((worst.own ? 'You have' : escC(worst.name) + ' has') + ' dropped ' + (-worst.d) + ' spot' + (worst.d === -1 ? '' : 's') + ' across the same stretch.');
        if (!rl.length && movers.length) rl.push('Every line is flat so far. Nobody has gained or lost ground across your reports.');
        if (rl.length) insR = '<div style="border-left:3px solid #E8400A;padding:8px 12px;background:#FFF3ED;margin-top:12px">' + rl.map(function (x) { return '<div style="font-size:12.5px;color:#0F0638;line-height:1.55">' + x + '</div>'; }).join('') + '</div>';
      }
      var raceCard = cardC('The race for the map pack', 'Position per report on your comparison keyword. The top line leads. Lower numbers are better.', raceInner + insR);
      return '<div class="tmc-grid tmc-full">' + ladderCard + raceCard + '</div>';
    })();
    var gapC = (function () {
      var L2 = snapsC.length;
      var ownRow = null, compRows = [];
      seriesC.forEach(function (s) {
        var last = L2 ? s.vals[L2 - 1] : null;
        var prev = L2 > 1 ? s.vals[L2 - 2] : null;
        var r = { name: s.name, own: s.own, last: last, prev: prev };
        if (s.own) ownRow = r; else compRows.push(r);
      });
      var inner = '';
      if (!ownRow || ownRow.last === null) {
        inner = '<div style="font-size:12.5px;color:#8a8fa6;padding:8px 0">You are not in the top local results in this report, so gaps cannot be measured from your position. The standings above show where your competitors sit.</div>';
      } else {
        var oL = ownRow.last, oP = ownRow.prev;
        var behind = [], ahead = [], unranked = [];
        compRows.forEach(function (r) {
          if (r.last === null) { unranked.push(r); return; }
          if (r.last > oL) behind.push(r); else if (r.last < oL) ahead.push(r); else behind.push(r);
        });
        behind.sort(function (a, b) { return a.last - b.last; });
        ahead.sort(function (a, b) { return b.last - a.last; });
        var maxGap = 10;
        behind.forEach(function (r) { maxGap = Math.max(maxGap, r.last - oL); });
        ahead.forEach(function (r) { maxGap = Math.max(maxGap, oL - r.last); });
        var barRow = function (r) {
          var g = r.last - oL;
          var isAhead = g < 0; var ag = Math.abs(g);
          var w = Math.max(6, Math.min(100, Math.round(ag / maxGap * 100)));
          var bg = isAhead ? '#F09595' : (ag <= 5 ? '#F0997B' : '#5DCAA5');
          var tc = isAhead ? '#501313' : (ag <= 5 ? '#4A1B0C' : '#04342C');
          var lbl = isAhead ? ag + ' ahead of you' : (g === 0 ? 'tied with you' : ag + ' behind');
          var ghost = '';
          if (r.prev !== null && oP !== null) {
            var gPrev = r.prev - oP;
            if (gPrev !== g) ghost = '<span style="font-size:10px;color:#b9bccb;margin-left:8px">was ' + Math.abs(gPrev) + (gPrev < 0 ? ' ahead' : ' behind') + '</span>';
          }
          return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
            + '<div style="min-width:130px;font-size:12.5px;color:#0F0638;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escC(r.name) + '</div>'
            + '<div style="flex:1;background:#f7f7fb;border-radius:4px;height:18px"><div style="width:' + w + '%;height:18px;border-radius:4px;background:' + bg + ';display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:10px;color:' + tc + ';font-weight:700;min-width:56px;box-sizing:border-box">' + lbl + '</div></div>'
            + ghost + '</div>';
        };
        var bars = ahead.map(barRow).join('') + behind.map(barRow).join('');
        unranked.forEach(function (r) {
          bars += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
            + '<div style="min-width:130px;font-size:12.5px;color:#0F0638;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escC(r.name) + '</div>'
            + '<div style="flex:1;font-size:11px;color:#8a8fa6">not in the top local results this report</div></div>';
        });
        var lines = [];
        if (ahead.length) {
          var tgt = ahead[ahead.length - 1];
          lines.push(escC(tgt.name) + ' sits ' + (oL - tgt.last) + ' spot' + ((oL - tgt.last) === 1 ? '' : 's') + ' ahead of you. That is the one to chase.');
        }
        var chasers = behind.filter(function (r) { return r.last > oL; });
        if (chasers.length) {
          var cl = chasers[0]; var cg = cl.last - oL;
          var quip = cg <= 3 ? ' Close enough to worry about.' : (cg >= 15 ? ' Not exactly breathing down your neck.' : '');
          lines.push('Your closest chaser is ' + escC(cl.name) + ', ' + cg + ' spot' + (cg === 1 ? '' : 's') + ' back.' + quip);
        }
        if (oP !== null) {
          var gainers = [], faders = [];
          compRows.forEach(function (r) {
            if (r.last === null || r.prev === null) return;
            var gNow = r.last - oL, gPrev = r.prev - oP;
            if (gNow < gPrev) gainers.push({ n: r.name, d: gPrev - gNow });
            if (gNow > gPrev) faders.push({ n: r.name, d: gNow - gPrev });
          });
          if (gainers.length) {
            gainers.sort(function (a, b) { return b.d - a.d; });
            lines.push(escC(gainers[0].n) + ' closed ' + gainers[0].d + ' spot' + (gainers[0].d === 1 ? '' : 's') + ' on you since the last report. Worth watching.');
          } else if (faders.length) {
            faders.sort(function (a, b) { return b.d - a.d; });
            lines.push('Nobody gained on you since the last report. ' + escC(faders[0].n) + ' actually slipped ' + faders[0].d + ' further back.');
          } else if (chasers.length) {
            lines.push('Nobody moved since the last report. A quiet week' + (oL === 1 ? ' at the top.' : '.'));
          }
        }
        var insight = lines.length ? '<div style="border-left:3px solid #E8400A;padding:8px 12px;background:#FFF3ED;border-radius:0;margin-top:10px">' + lines.map(function (ln) { return '<div style="font-size:12.5px;color:#0F0638;line-height:1.55">' + ln + '</div>'; }).join('') + '</div>' : '';
        inner = '<div style="border-left:3px solid #0F0638;padding-left:14px;margin-bottom:4px"><div style="font-size:11px;font-weight:700;color:#0F0638;margin-bottom:10px">YOU - #' + oL + '</div>' + bars + '</div>' + insight;
      }
      return cardC('The gap behind you', 'You are the zero line. Bars show how many map positions each competitor sits from you on your comparison keyword, latest report. Grey notes show where they were the report before.', inner, true);
    })();
    var trendPanelC = cardC('Rank over reports', 'Your map position and each competitor\'s, one point per report. Higher on the chart is better.', trendInnerC, true);
      var mxKeys = ['competitor_1_maps_rank_kw1','competitor_1_maps_rank_kw2','competitor_1_maps_rank_kw3','competitor_2_maps_rank_kw1','competitor_2_maps_rank_kw2','competitor_2_maps_rank_kw3','competitor_3_maps_rank_kw1','competitor_3_maps_rank_kw2','competitor_3_maps_rank_kw3'];
      var matrixC = '';
      if (latestC && mxKeys.some(function (k) { return k in latestC; })) {
        var mxKws = [mrC.target_keyword_1 || '', mrC.target_keyword_2 || '', mrC.target_keyword_3 || ''];
        var mxCols = [];
        for (var mi = 1; mi <= 3; mi++) { if (mxKws[mi - 1]) mxCols.push(mi); }
        var mxCell = function (v) { var n2 = num(v); return n2 ? '#' + n2 : '<span style="color:#8a8fa6">-</span>'; };
        var mxTh = 'padding:10px 8px;border-bottom:2px solid #ececf4;text-align:left;font-size:12px;color:#8a8fa6';
        var mxTd = 'padding:10px 8px;border-bottom:1px solid #f4f4f8';
        var mxHead = '<tr><th style="' + mxTh + '">Business</th>';
        mxCols.forEach(function (ci) { mxHead += '<th style="' + mxTh + '">' + escC(mxKws[ci - 1]) + '</th>'; });
        mxHead += '</tr>';
        var mxRows = '<tr><td style="' + mxTd + ';font-weight:700">' + escC(bizC) + '</td>';
        mxCols.forEach(function (ci) { mxRows += '<td style="' + mxTd + ';font-weight:700">' + mxCell(latestC['maps_rank_kw' + ci]) + '</td>'; });
        mxRows += '</tr>';
        compsC.forEach(function (c2) {
          var nm2 = escC(c2.name || c2.url);
          if (c2.url) { nm2 = '<a href="' + escC(c2.url) + '" target="_blank" rel="noopener" style="color:#0F0638">' + nm2 + '</a>'; }
          mxRows += '<tr><td style="' + mxTd + '">' + nm2 + '</td>';
          mxCols.forEach(function (ci) { mxRows += '<td style="' + mxTd + '">' + mxCell(latestC['competitor_' + c2.slot + '_maps_rank_kw' + ci]) + '</td>'; });
          mxRows += '</tr>';
        });
        matrixC = cardC('Rank matrix - every keyword', 'Google local map position for each tracked keyword you monitor, from your latest report' + (latestC.snapshot_date ? ', measured ' + latestC.snapshot_date : '') + '. Lower is better. A dash means that business was not in the top local results for that search.', '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13.5px;color:#0F0638">' + mxHead + mxRows + '</table></div>', true);
      }
      htmlC = '<style>.tmc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}.tmc-grid>.tmc-full{grid-column:1/-1}@media(max-width:900px){.tmc-grid{grid-template-columns:minmax(0,1fr)}}</style><div class="tmc-grid">'
        + verdictC + h2h + sovPanel + beatsPanel + whyPanel + duoC + gapC + matrixC + '</div>';
    }
    var elC = document.getElementById('competitors-content');
    if (elC) { elC.innerHTML = htmlC; } else { var scC = document.getElementById('screen-competitors'); if (scC) { var oldC = scC.querySelector('.honest-inject'); if (oldC) oldC.remove(); scC.insertAdjacentHTML('beforeend', '<div class="honest-inject">' + htmlC + '</div>'); } }
  }
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
      renderUpgradePrompt('screen-ai', 'AI Visibility', 'See how your business appears when people ask AI models about your category. Available on Agency.');
      return;
    }
    const checks = state.data.aiVisibilityChecks || state.data.ai_visibility_checks || [];
    var mrAI = state.data.masterRecord;
    var bizAI = mrAI.business_name || '';
    var kwNames = [mrAI.target_keyword_1 || '', mrAI.target_keyword_2 || '', mrAI.target_keyword_3 || ''];
    var escAI = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var normHL = function (s) { return String(s == null ? '' : s).toLowerCase().replace(/[\u2019\u02BC\u00B4]/g, "'"); };
    var normAI = function (s) { return normHL(s).replace(/\bavenue\b/g, 'ave'); };
    var pill = function (txt, bg, fg) { return '<span style="display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:600;background:' + bg + ';color:' + fg + '">' + txt + '</span>'; };
    var card = function (title, sub, inner, full) {
      return '<div class="' + (full ? 'tmv-full' : '') + '" style="background:#fff;border:1px solid #eceaf5;border-radius:14px;padding:18px 20px">'
        + (title ? '<div style="font-weight:700;color:#0F0638;font-size:15px">' + title + '</div>' : '')
        + (sub ? '<div style="font-size:12px;color:#8a8fa6;margin-top:3px;line-height:1.5">' + sub + '</div>' : '')
        + '<div style="margin-top:13px">' + inner + '</div></div>';
    };
    var donut = function (pct, big, small, color, box) {
      var r = 34, c = 2 * Math.PI * r;
      var p = Math.max(0, Math.min(100, pct));
      var off = c * (1 - p / 100);
      return '<svg width="' + box + '" height="' + box + '" viewBox="0 0 88 88" role="img">'
        + '<circle cx="44" cy="44" r="34" fill="none" stroke="#f1f0f7" stroke-width="9"></circle>'
        + '<circle cx="44" cy="44" r="34" fill="none" stroke="' + color + '" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 44 44)"></circle>'
        + '<text x="44" y="' + (small ? 42 : 50) + '" text-anchor="middle" font-size="19" font-weight="700" fill="#0F0638">' + big + '</text>'
        + (small ? '<text x="44" y="58" text-anchor="middle" font-size="9.5" fill="#8a8fa6">' + small + '</text>' : '')
        + '</svg>';
    };
    var htmlAI;
    if (!checks.length) {
      htmlAI = '<div class="empty-state"><i class="ti ti-brain"></i><p>Daily AI visibility checks are being set up for your account. Your first results appear within a day - no action needed on your side.</p></div>';
    } else {
      var byMD = {}, orderAI = [];
      checks.forEach(function (c) { var k = c.model + '|' + c.check_date; if (!byMD[k]) orderAI.push(k); byMD[k] = c; });
      var rowsAll = orderAI.map(function (k) { return byMD[k]; });
      var dates = [];
      rowsAll.forEach(function (c) { if (dates.indexOf(c.check_date) === -1) dates.push(c.check_date); });
      dates.sort();
      var todayD = dates[dates.length - 1];
      var prevD = dates.length > 1 ? dates[dates.length - 2] : null;
      var todayRows = rowsAll.filter(function (c) { return c.check_date === todayD; });
      var prevRows = prevD ? rowsAll.filter(function (c) { return c.check_date === prevD; }) : [];
      var ansOf = function (rows) { var a = []; rows.forEach(function (c) { [1, 2, 3].forEach(function (n) { var v = c['answer_kw' + n]; if (v) a.push({ t: v, k: n - 1, m: c.model }); }); }); return a; };
      var ansToday = ansOf(todayRows), ansPrev = ansOf(prevRows);
      var cntIn = function (list, name) { var nn = normAI(name); if (!nn) return 0; return list.filter(function (a) { return normAI(a.t).indexOf(nn) !== -1; }).length; };
      var ents = [];
      if (bizAI) ents.push({ n: bizAI, own: true });
      [mrAI.competitor_1_name, mrAI.competitor_2_name, mrAI.competitor_3_name].forEach(function (cn) { if (cn) ents.push({ n: cn, own: false }); });
      ents.forEach(function (en) { en.c = cntIn(ansToday, en.n); en.p = ansPrev.length ? cntIn(ansPrev, en.n) : null; });
      var meAI = ents.filter(function (en) { return en.own; })[0];
      var rivals = ents.filter(function (en) { return !en.own; }).slice().sort(function (a, b) { return b.c - a.c; });
      var namedModels = todayRows.filter(function (c) { return c.kw1_mentioned === 'yes' || c.kw2_mentioned === 'yes' || c.kw3_mentioned === 'yes'; }).length;
      var totalModels = todayRows.length;
      var kwCount = kwNames.filter(Boolean).length;
      var pctMe = ansToday.length && meAI ? Math.round(meAI.c / ansToday.length * 100) : null;
      var chg = [];
      todayRows.forEach(function (c) {
        var p = prevRows.filter(function (x) { return x.model === c.model; })[0];
        if (!p) return;
        [1, 2, 3].forEach(function (n) {
          var f = 'kw' + n + '_mentioned', kn = kwNames[n - 1];
          if (!kn) return;
          if (p[f] === 'yes' && c[f] === 'no') chg.push({ up: false, m: c.model, k: kn });
          if (p[f] === 'no' && c[f] === 'yes') chg.push({ up: true, m: c.model, k: kn });
        });
      });
      var st = pctMe === null ? { t: 'Measuring', b: '#f0f0f4', f: '#8a8fa6', c: '#8a8fa6' } : pctMe >= 70 ? { t: 'Strong position', b: '#e8f7e0', f: '#3f9c1c', c: '#3f9c1c' } : pctMe >= 40 ? { t: 'Mixed position', b: '#fff4e0', f: '#a86b12', c: '#d98b0f' } : { t: 'Weak position', b: '#fde8e8', f: '#c0392b', c: '#c0392b' };
      var headA = (totalModels && namedModels === totalModels ? 'All ' + totalModels + ' AI model' + (totalModels === 1 ? '' : 's') + ' name you' : namedModels + ' of ' + totalModels + ' AI models name you') + ' for at least one of your ' + kwCount + ' tracked keywords.';
      var subA = meAI && ansToday.length ? 'You are named in <b>' + meAI.c + ' of ' + ansToday.length + '</b> answers stored today.' : 'Answers start being stored from your next check.';
      if (meAI && ansToday.length && rivals.length && rivals[0].c > 0) subA += ' Your closest tracked rival, ' + escAI(rivals[0].n) + ', is named in ' + rivals[0].c + '.';
      var actA = chg.length
        ? (escAI(chg[0].m).toUpperCase() + (chg[0].up ? ' started naming you for "' + escAI(chg[0].k) + '". Nothing to do - this is movement in your favour.' : ' stopped naming you for "' + escAI(chg[0].k) + '". Watch it for a few days before acting; single-day moves are normal.'))
        : (prevD ? 'Nothing changed since ' + escAI(prevD) + '. No action needed today.' : 'This is your first check, so there is nothing to compare yet. We start tracking changes from tomorrow.');
      var verdict = '<div class="tmv-full" style="background:#fff;border:1px solid #eceaf5;border-radius:14px;padding:20px 22px">'
        + '<div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">'
        + (pctMe === null ? '' : '<div style="text-align:center;flex:0 0 auto">' + donut(pctMe, pctMe + '%', 'of answers', st.c, 104) + '<div style="font-size:11px;color:#8a8fa6;margin-top:4px">name your business</div></div>')
        + '<div style="flex:1;min-width:280px">'
        + '<div style="font-size:11px;letter-spacing:.08em;color:#8a8fa6;font-weight:600">AI VISIBILITY &middot; ' + escAI(todayD) + '</div>'
        + '<div style="font-size:22px;line-height:1.3;font-weight:700;margin:8px 0 7px;color:#0F0638">' + escAI(headA) + '</div>'
        + '<div style="font-size:13.5px;color:#5c5f75;line-height:1.6">' + subA + '</div>'
        + '<div style="margin-top:13px">' + pill(st.t, st.b, st.f) + (chg.length ? ' ' + pill(chg.length + ' change' + (chg.length === 1 ? '' : 's') + ' vs ' + escAI(prevD), '#f0f0f4', '#8a8fa6') : '') + '</div>'
        + '<div style="margin-top:14px;padding-top:12px;border-top:1px solid #f0f0f4;font-size:13px;color:#3f4157"><b>What to do:</b> ' + actA + '</div>'
        + '</div></div></div>';
      var ranked = ents.slice().sort(function (a, b) { return b.c - a.c; });
      var maxC = ranked.length ? Math.max.apply(null, ranked.map(function (en) { return en.c; })) : 0;
      var rowsB = ranked.map(function (en, i) {
        var p2 = ansToday.length ? Math.round(en.c / ansToday.length * 100) : 0;
        var w = maxC ? Math.round(en.c / maxC * 100) : 0;
        var d = en.p === null ? '<span style="color:#c9c9d6">first check</span>' : en.c > en.p ? '<span style="color:#3f9c1c;font-weight:700">&#9650; +' + (en.c - en.p) + '</span>' : en.c < en.p ? '<span style="color:#c0392b;font-weight:700">&#9660; ' + (en.c - en.p) + '</span>' : '<span style="color:#8a8fa6">no change</span>';
        return '<div style="margin-bottom:13px">'
          + '<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:13px;margin-bottom:5px">'
          + '<div style="color:#0F0638;' + (en.own ? 'font-weight:700' : '') + '"><span style="color:#c9c9d6;font-weight:700;margin-right:7px">' + (i + 1) + '</span>' + escAI(en.n) + (en.own ? ' ' + pill('you', '#0F0638', '#ffffff') : '') + '</div>'
          + '<div style="color:#5c5f75;white-space:nowrap"><b>' + p2 + '%</b> <span style="color:#a9aabb;font-size:11.5px">' + en.c + '/' + ansToday.length + '</span></div>'
          + '</div>'
          + '<div style="height:8px;background:#f4f4f8;border-radius:99px;overflow:hidden"><div style="height:8px;width:' + w + '%;background:' + (en.own ? '#0F0638' : '#c5c3dc') + ';border-radius:99px"></div></div>'
          + '<div style="font-size:11px;margin-top:4px">' + d + '</div>'
          + '</div>';
      }).join('');
      var lead = '';
      if (meAI && ranked.length > 1 && ansToday.length) {
        var second = ranked.filter(function (en) { return !en.own; })[0];
        if (second) { var gap = Math.round((meAI.c - second.c) / ansToday.length * 100); lead = gap > 0 ? 'You lead your closest tracked rival by <b>' + gap + ' percentage points</b>.' : gap === 0 ? 'You and ' + escAI(second.n) + ' are level.' : escAI(second.n) + ' is ahead of you by <b>' + Math.abs(gap) + ' percentage points</b>.'; }
      }
      var panelLeague = card('Who the AIs name most', 'Across ' + ansToday.length + ' answers about your ' + kwCount + ' keywords today. An answer counts once per business.', rowsB + (lead ? '<div style="font-size:12.5px;color:#3f4157;margin-top:4px;padding-top:11px;border-top:1px solid #f4f4f8">' + lead + '</div>' : '') + (ents.length < 2 ? '<div style="font-size:12px;color:#8a8fa6">Add competitor names to your profile to compare share of voice.</div>' : ''), false);
      var ringHtml = todayRows.map(function (c) {
        var measured = [1, 2, 3].filter(function (n) { return c['kw' + n + '_mentioned'] === 'yes' || c['kw' + n + '_mentioned'] === 'no'; }).length;
        var sc = typeof c.score === 'number' ? c.score : 0;
        var den = measured || kwCount;
        var p = den ? Math.round(sc / den * 100) : 0;
        var col = p >= 67 ? '#3f9c1c' : p >= 34 ? '#d98b0f' : '#c0392b';
        var missing = kwCount - measured;
        return '<div style="text-align:center">'
          + donut(p, sc + '/' + den, '', col, 80)
          + '<div style="font-size:11px;font-weight:700;letter-spacing:.05em;color:#0F0638;margin-top:3px">' + escAI(c.model).toUpperCase() + '</div>'
          + (missing > 0 ? '<div style="font-size:10px;color:#a86b12;line-height:1.35;margin-top:2px">' + missing + ' kw not returned</div>' : '<div style="font-size:10px;color:#8a8fa6;margin-top:2px">all ' + den + ' measured</div>')
          + '</div>';
      }).join('');
      var panelModels = card('Each AI model today', 'How many of your keywords each model names you for. A keyword a model did not return is left out of its total, not counted against you.', '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(78px,1fr));gap:12px">' + ringHtml + '</div>', false);
      var trendPts = dates.map(function (d) {
        var rws = rowsAll.filter(function (c) { return c.check_date === d; });
        var a = ansOf(rws);
        return { d: d, v: a.length ? Math.round(cntIn(a, bizAI) / a.length * 100) : null };
      }).filter(function (p) { return p.v !== null; });
      var trendInner;
      if (trendPts.length >= 2) {
        var W = 460, H = 120;
        var stepX = W / (trendPts.length - 1);
        var pts = trendPts.map(function (p, i) { return [i * stepX, H - (p.v / 100) * H]; });
        var dPath = pts.map(function (c, i) { return (i ? 'L' : 'M') + c[0].toFixed(1) + ' ' + c[1].toFixed(1); }).join(' ');
        var area = dPath + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';
        var dots = pts.map(function (c) { return '<circle cx="' + c[0].toFixed(1) + '" cy="' + c[1].toFixed(1) + '" r="3.5" fill="#0F0638"></circle>'; }).join('');
        var first = trendPts[0], last = trendPts[trendPts.length - 1];
        var delta = last.v - first.v;
        trendInner = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" style="width:100%;height:120px;display:block">'
          + '<path d="' + area + '" fill="#0F0638" opacity="0.07"></path>'
          + '<path d="' + dPath + '" fill="none" stroke="#0F0638" stroke-width="2.5" stroke-linejoin="round"></path>'
          + dots + '</svg>'
          + '<div style="display:flex;justify-content:space-between;font-size:11px;color:#8a8fa6;margin-top:6px"><span>' + escAI(first.d) + '</span><span>' + escAI(last.d) + '</span></div>'
          + '<div style="font-size:12.5px;color:#3f4157;margin-top:9px">You went from <b>' + first.v + '%</b> to <b>' + last.v + '%</b> of answers over ' + trendPts.length + ' checks' + (delta === 0 ? ', no net change.' : delta > 0 ? ', up ' + delta + ' points.' : ', down ' + Math.abs(delta) + ' points.') + '</div>';
      } else {
        trendInner = '<div style="height:120px;display:flex;align-items:center;justify-content:center;background:#faf9ff;border-radius:10px;color:#8a8fa6;font-size:12.5px;text-align:center;padding:0 18px">Your trend line appears after your second check. This is check ' + trendPts.length + '. We do not draw a line through a single point.</div>';
      }
      
    var vizDays = (function () {
      var m = {};
      rowsAll.forEach(function (r) {
        var d = r.check_date; if (!d) return;
        if (!m[d]) m[d] = { d: d, num: 0, den: 0, pm: {} };
        ['kw1_mentioned', 'kw2_mentioned', 'kw3_mentioned'].forEach(function (k) {
          var v = r[k];
          if (v === 'yes' || v === 'no') {
            m[d].den++; if (v === 'yes') m[d].num++;
            var mo = (r.model || '').toLowerCase();
            if (mo) { if (!m[d].pm[mo]) m[d].pm[mo] = { num: 0, den: 0 }; m[d].pm[mo].den++; if (v === 'yes') m[d].pm[mo].num++; }
          }
        });
      });
      return Object.keys(m).sort().map(function (k) { return m[k]; });
    })();
    var vizModels = (function () { var s = {}; rowsAll.forEach(function (r) { var mo = (r.model || '').toLowerCase(); if (mo) s[mo] = 1; }); return Object.keys(s).sort(); })();
    window.__vizData = { days: vizDays, models: vizModels };
    window.__vizState = { r: '7D', m: '' };
    window.__vizSet = function (k, v) { window.__vizState[k] = v; var el = document.getElementById('aiviz-body'); if (el) el.innerHTML = window.__vizBody(); };
    window.__vizBody = function () {
      var S = window.__vizState, D = window.__vizData, days = D.days, L = days.length;
      var defs = [
        { id: '7D', need: 2, take: 7 },
        { id: '30D', need: 8, take: 30 },
        { id: '90D', need: 31, take: 90 },
        { id: 'Month', need: 30, agg: 1 },
        { id: 'Year', need: 300, agg: 1 }
      ];
      var pills = defs.map(function (df) {
        var locked = L < df.need;
        var on = S.r === df.id;
        if (locked) {
          var pctFill = Math.min(100, Math.round(L / df.need * 100));
          return '<span title="Unlocks at ' + df.need + ' days of checks - you have ' + L + '" style="display:inline-block;padding:5px 12px;border-radius:16px;background:#f4f4f8;color:#b9bccb;font-size:12px;font-weight:700;margin-right:6px;cursor:default">' + df.id + ' &#128274;<span style="display:block;height:3px;border-radius:2px;background:#e3e4ee;margin-top:3px"><span style="display:block;height:3px;border-radius:2px;width:' + pctFill + '%;background:#b9bccb"></span></span></span>';
        }
        return '<span onclick="window.__vizSet(&quot;r&quot;,&quot;' + df.id + '&quot;)" style="display:inline-block;padding:5px 12px;border-radius:16px;cursor:pointer;font-size:12px;font-weight:700;margin-right:6px;' + (on ? 'background:#0F0638;color:#ffffff' : 'background:#f4f4f8;color:#0F0638') + '">' + df.id + '</span>';
      }).join('');
      var chips = [''].concat(D.models).map(function (mo) {
        var on = S.m === mo;
        var lbl = mo === '' ? 'ALL' : mo.toUpperCase();
        return '<span onclick="window.__vizSet(&quot;m&quot;,&quot;' + mo + '&quot;)" style="display:inline-block;padding:4px 10px;border-radius:14px;cursor:pointer;font-size:11px;font-weight:700;margin-right:6px;' + (on ? 'background:#E8400A;color:#ffffff' : 'background:#FFF3ED;color:#E8400A') + '">' + lbl + '</span>';
      }).join('');
      var df2 = null; defs.forEach(function (x) { if (x.id === S.r) df2 = x; });
      if (!df2 || L < df2.need) { df2 = defs[0]; S.r = '7D'; }
      var sel;
      if (df2.agg) {
        var mm = {};
        days.forEach(function (dy) {
          var key = dy.d.slice(0, 7);
          if (!mm[key]) mm[key] = { d: key, num: 0, den: 0, pm: {} };
          mm[key].num += dy.num; mm[key].den += dy.den;
          Object.keys(dy.pm).forEach(function (mo) { if (!mm[key].pm[mo]) mm[key].pm[mo] = { num: 0, den: 0 }; mm[key].pm[mo].num += dy.pm[mo].num; mm[key].pm[mo].den += dy.pm[mo].den; });
        });
        sel = Object.keys(mm).sort().map(function (k) { return mm[k]; });
        if (df2.id === 'Year') sel = sel.slice(-12);
      } else {
        sel = days.slice(-df2.take);
      }
      var pctOf = function (o) {
        if (S.m) { var p = o.pm[S.m]; return (p && p.den) ? Math.round(p.num / p.den * 100) : null; }
        return o.den ? Math.round(o.num / o.den * 100) : null;
      };
      var ptsV = sel.map(pctOf);
      var W2 = 520, H2 = 120, PAD = 8;
      var n = sel.length;
      var sx = n > 1 ? (W2 - PAD * 2) / (n - 1) : 0;
      var px = function (i) { return (PAD + i * sx).toFixed(1); };
      var py = function (v) { return (H2 - PAD - (v / 100) * (H2 - PAD * 2)).toFixed(1); };
      var path = '', dots = '', openP = false;
      ptsV.forEach(function (v, i) {
        if (v === null) { openP = false; return; }
        path += (openP ? ' L' : ' M') + px(i) + ',' + py(v); openP = true;
        dots += '<circle cx="' + px(i) + '" cy="' + py(v) + '" r="3" fill="' + (S.m ? '#E8400A' : '#0F0638') + '"></circle>';
      });
      var svg = '<svg viewBox="0 0 ' + W2 + ' ' + H2 + '" style="width:100%;height:130px"><path d="' + path.replace(/^ /, '') + '" fill="none" stroke="' + (S.m ? '#E8400A' : '#0F0638') + '" stroke-width="2"></path>' + dots + '</svg>';
      var lbls = '<div style="display:flex;justify-content:space-between;font-size:11px;color:#8a8fa6"><span>' + (sel.length ? sel[0].d : '') + '</span><span>' + (sel.length ? sel[sel.length - 1].d : '') + '</span></div>';
      var vals = ptsV.filter(function (v) { return v !== null; });
      var line2 = '';
      if (vals.length >= 2) line2 = '<div style="font-size:12.5px;color:#0F0638;margin-top:6px">' + (S.m ? S.m.toUpperCase() + ': ' : '') + 'from ' + vals[0] + '% to ' + vals[vals.length - 1] + '% across ' + vals.length + ' measured points in this range.</div>';
      else if (vals.length === 1) line2 = '<div style="font-size:12.5px;color:#8a8fa6;margin-top:6px">Only one measured point in this range so far.</div>';
      else line2 = '<div style="font-size:12.5px;color:#8a8fa6;margin-top:6px">No stored answers for this selection yet. Not shown rather than guessed.</div>';
      return '<div style="margin-bottom:8px">' + pills + '</div><div style="margin-bottom:10px">' + chips + '</div>' + svg + lbls + line2;
    };
    var panelViz = card('Your visibility over time', 'The share of stored answers that name your business. Pick a range - locked ranges open as your history grows.', '<div id="aiviz-body">' + window.__vizBody() + '</div>', true);
    var panelCards = (function () {
      var last7 = vizDays.slice(-7);
      var cardsH = vizModels.map(function (mo) {
        var num = 0, den = 0;
        last7.forEach(function (dy) { var p = dy.pm[mo]; if (p) { num += p.num; den += p.den; } });
        var pctM = den ? Math.round(num / den * 100) : null;
        var streak = 0;
        for (var i = vizDays.length - 1; i >= 0; i--) {
          var p2 = vizDays[i].pm[mo];
          if (p2 && p2.den > 0 && p2.num === p2.den) streak++; else break;
        }
        var strip = last7.slice(-5).map(function (dy) {
          var p3 = dy.pm[mo];
          var st = 'width:14px;height:6px;border-radius:3px;display:inline-block;margin-right:3px;';
          if (!p3 || !p3.den) return '<span style="' + st + 'border:1px dashed #b9bccb"></span>';
          if (p3.num === p3.den) return '<span style="' + st + 'background:#639922"></span>';
          if (p3.num > 0) return '<span style="' + st + 'background:#C0DD97"></span>';
          return '<span style="' + st + 'background:#E24B4A"></span>';
        }).join('');
        return { mo: mo, pct: pctM, num: num, den: den, streak: streak, strip: strip };
      });
      var worst = null;
      cardsH.forEach(function (c2) { if (c2.pct !== null && c2.pct < 100 && (worst === null || c2.pct < worst.pct)) worst = c2; });
      var inner = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px">' + cardsH.map(function (c2) {
        var foot;
        if (c2.den === 0) foot = '<div style="font-size:11px;color:#8a8fa6;margin-top:8px">No answers stored this week</div>';
        else if (worst && c2.mo === worst.mo) foot = '<div style="font-size:11px;color:#A32D2D;margin-top:8px;font-weight:700">Weakest model for you right now</div>';
        else if (c2.streak >= 2) foot = '<div style="font-size:11px;color:#3B6D11;margin-top:8px;font-weight:700">' + c2.streak + ' perfect days in a row</div>';
        else foot = '<div style="font-size:11px;color:#8a8fa6;margin-top:8px">&nbsp;</div>';
        return '<div style="background:#ffffff;border:1px solid #ececf4;border-radius:12px;padding:14px 16px">'
          + '<div style="font-size:13px;font-weight:700;color:#0F0638">' + escAI(c2.mo.toUpperCase()) + '</div>'
          + '<div style="font-size:22px;font-weight:700;color:#0F0638;margin:4px 0 2px">' + (c2.pct === null ? '<span style="color:#8a8fa6">no data</span>' : c2.pct + '%') + '</div>'
          + '<div style="font-size:11px;color:#8a8fa6;margin-bottom:8px">' + (c2.den ? c2.num + ' of ' + c2.den + ' stored answers name you, last 7 check days' : 'nothing returned in the last 7 check days') + '</div>'
          + '<div>' + c2.strip + '</div>' + foot + '</div>';
      }).join('') + '</div>';
      return card('How each AI treated you this week', 'Share of stored answers naming you over your last 7 check days. A model that returned nothing is shown as such, never counted against you.', inner, true);
    })();
    var panelTrend = card('Your visibility over time', 'The share of stored answers that name your business, one point per check day.', trendInner, false);
      var gaps = [];
      todayRows.forEach(function (c) {
        [1, 2, 3].forEach(function (n) {
          var kn = kwNames[n - 1];
          if (!kn) return;
          var v = c['kw' + n + '_mentioned'];
          if (v === 'no') gaps.push({ miss: true, m: c.model, k: kn });
          else if (v !== 'yes') gaps.push({ miss: false, m: c.model, k: kn });
        });
      });
      var gapsInner = gaps.length
        ? gaps.map(function (g) {
            return '<div style="display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-top:1px solid #f4f4f8">'
              + '<div style="width:8px;height:8px;border-radius:50%;background:' + (g.miss ? '#c0392b' : '#d6d5e0') + ';margin-top:5px;flex:0 0 auto"></div>'
              + '<div style="font-size:12.5px;color:#3f4157;line-height:1.5">' + (g.miss ? '<b>' + escAI(g.m).toUpperCase() + '</b> does not name you when asked about "' + escAI(g.k) + '"' : '<b>' + escAI(g.m).toUpperCase() + '</b> returned no answer for "' + escAI(g.k) + '", so it is not counted either way') + '</div></div>';
          }).join('') + '<div style="font-size:12px;color:#8a8fa6;margin-top:11px;padding-top:10px;border-top:1px solid #f4f4f8">Each red line is one place a customer could ask an AI and not hear about you.</div>'
        : '<div style="padding:16px;background:#f4fbf0;border-radius:10px;font-size:13px;color:#2f7a12">You are named by every model on every tracked keyword today. Nothing to fix.</div>';
      var panelGaps = card('Where you are missing', 'Every keyword and model combination where your name did not appear today.', gapsInner, false);
      var blockC = kwNames.map(function (kn, idx) {
        if (!kn) return '';
        var any = todayRows.some(function (c) { return c['answer_kw' + (idx + 1)]; });
        if (!any) return '';
        var lines = todayRows.map(function (c) {
          var raw = c['answer_kw' + (idx + 1)];
          var mentioned = c['kw' + (idx + 1) + '_mentioned'];
          var label = '<span style="display:inline-block;min-width:64px;font-size:11px;font-weight:700;color:#8a8fa6;letter-spacing:.04em">' + escAI(c.model).toUpperCase() + '</span>';
          if (!raw) return '<div style="padding:9px 0;border-top:1px solid #f4f4f8;font-size:13px;color:#8a8fa6">' + label + 'no answer stored for this keyword today</div>';
          var esc = escAI(raw);
          var body = esc;
          if (bizAI) {
            var hay = normHL(esc), nee = normHL(escAI(bizAI));
            var i = nee ? hay.indexOf(nee) : -1;
            if (i !== -1) body = esc.slice(0, i) + '<b style="background:#e8f7e0;color:#2f7a12;padding:1px 5px;border-radius:4px">' + esc.slice(i, i + nee.length) + '</b>' + esc.slice(i + nee.length);
          }
          var miss = mentioned === 'no' ? ' ' + pill('you are not named', '#fde8e8', '#c0392b') : '';
          return '<div style="padding:9px 0;border-top:1px solid #f4f4f8;font-size:13px;line-height:1.6;color:#3f4157">' + label + body + miss + '</div>';
        }).join('');
        return '<div style="background:#fcfcff;border:1px solid #f0eff8;border-radius:12px;padding:14px 16px">'
          + '<div style="display:inline-block;background:#f0eff8;border-radius:12px 12px 12px 4px;padding:8px 13px;font-size:13.5px;font-weight:600;color:#0F0638;margin-bottom:4px">' + escAI(kn) + '</div>'
          + lines + '</div>';
      }).filter(Boolean).join('');
      var panelAnswers = blockC ? card('What the AIs actually said about you today', 'The real answers we stored, one card per question. Your name is highlighted where it appears.', '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:14px;align-items:start">' + blockC + '</div>', true) : '';
      var tbl = rowsAll.slice(-40).reverse().map(function (c) {
        var chip = function (v) {
          if (v === 'yes') return '<span style="display:inline-block;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:600;background:#e8f7e0;color:#3f9c1c">yes</span>';
          if (v === 'no') return '<span style="display:inline-block;padding:2px 9px;border-radius:10px;font-size:11px;font-weight:600;background:#fde8e8;color:#c0392b">no</span>';
          return '<span style="display:inline-block;padding:2px 9px;border-radius:10px;font-size:11px;background:#f0f0f4;color:#8a8fa6">not returned</span>';
        };
        return '<tr><td style="padding:7px 9px;border-bottom:1px solid #f4f4f8">' + escAI(c.check_date) + '</td><td style="padding:7px 9px;border-bottom:1px solid #f4f4f8;font-weight:600">' + escAI(c.model) + '</td><td style="padding:7px 9px;border-bottom:1px solid #f4f4f8;text-align:center">' + chip(c.kw1_mentioned) + '</td><td style="padding:7px 9px;border-bottom:1px solid #f4f4f8;text-align:center">' + chip(c.kw2_mentioned) + '</td><td style="padding:7px 9px;border-bottom:1px solid #f4f4f8;text-align:center">' + chip(c.kw3_mentioned) + '</td><td style="padding:7px 9px;border-bottom:1px solid #f4f4f8;font-weight:700">' + (typeof c.score === 'number' ? c.score : '-') + '</td></tr>';
      }).join('');
      var kwHead = function (kn) { if (!kn) return '-'; var s2 = kn.length > 18 ? escAI(kn.slice(0, 17)) + '&#8230;' : escAI(kn); return '<span title="' + escAI(kn) + '">' + s2 + '</span>'; };
      var tableInner = '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13px;color:#0F0638"><thead><tr>'
        + '<th style="text-align:left;padding:6px 9px;font-size:10.5px;letter-spacing:.06em;color:#8a8fa6">DATE</th>'
        + '<th style="text-align:left;padding:6px 9px;font-size:10.5px;letter-spacing:.06em;color:#8a8fa6">MODEL</th>'
        + '<th style="padding:6px 9px;font-size:10.5px;letter-spacing:.06em;color:#8a8fa6">' + kwHead(kwNames[0]) + '</th>'
        + '<th style="padding:6px 9px;font-size:10.5px;letter-spacing:.06em;color:#8a8fa6">' + kwHead(kwNames[1]) + '</th>'
        + '<th style="padding:6px 9px;font-size:10.5px;letter-spacing:.06em;color:#8a8fa6">' + kwHead(kwNames[2]) + '</th>'
        + '<th style="text-align:left;padding:6px 9px;font-size:10.5px;letter-spacing:.06em;color:#8a8fa6">SCORE</th>'
        + '</tr></thead><tbody>' + tbl + '</tbody></table></div>'
        + '<div style="font-size:12px;color:#8a8fa6;margin-top:10px">More AI models are being added - a model without a verified data source is not shown rather than guessed.</div>';
      var panelTable = card('Every check, day by day', 'One row per AI model per day. yes = your business appeared in that answer.', tableInner, true);
      htmlAI = '<style>.tmv-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}.tmv-grid>.tmv-full{grid-column:1/-1}@media(max-width:900px){.tmv-grid{grid-template-columns:minmax(0,1fr)}}</style><div class="tmv-grid">'
        + verdict + panelLeague + panelModels + panelViz + panelGaps + panelAnswers + panelCards + '<div class="tmv-full" style="text-align:center;margin:4px 0 8px"><span id="aitable-btn" onclick="var e=document.getElementById(&quot;aitable-fold&quot;);var s=e.style.display===&quot;none&quot;;e.style.display=s?&quot;block&quot;:&quot;none&quot;;this.textContent=s?&quot;Hide the day by day detail&quot;:&quot;Show every check, day by day&quot;;" style="display:inline-block;padding:8px 18px;border-radius:20px;background:#f4f4f8;color:#0F0638;font-size:13px;font-weight:700;cursor:pointer">Show every check, day by day</span></div><div id="aitable-fold" class="tmv-full" style="display:none">' + panelTable + '</div>' + '</div>';
    }
    var elAI = document.getElementById('ai-content');
    if (elAI) { elAI.innerHTML = htmlAI; } else { var scAI = document.getElementById('screen-ai'); if (scAI) { var oldAI = scAI.querySelector('.honest-inject'); if (oldAI) oldAI.remove(); scAI.insertAdjacentHTML('beforeend', '<div class="honest-inject">' + htmlAI + '</div>'); } }
  }
  function renderSocial() {
    var rowsS = state.data.socialSnapshots || state.data.social_snapshots || [];
    var subIdS = (state.data.masterRecord && state.data.masterRecord.subscriber_id) || 'unknown';
    var escS = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
    var numS = function (v) { if (v === null || v === undefined || v === '') return null; var n = parseFloat(v); return isNaN(n) ? null : n; };
    var fmtS = function (n) { if (n === null) return '-'; if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M'; if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'K'; return String(n); };
    var cardS = function (title, sub, inner, full) { return '<div class="' + (full ? 'tms-full' : '') + '" style="background:#fff;border:1px solid #eceaf5;border-radius:14px;padding:18px 20px"><div style="font-weight:700;color:#0F0638;font-size:15px">' + title + '</div>' + (sub ? '<div style="font-size:12px;color:#8a8fa6;margin-top:3px;line-height:1.5">' + sub + '</div>' : '') + '<div style="margin-top:13px">' + inner + '</div></div>'; };
    var htmlSO;
    if (!rowsS.length) {
      htmlSO = '<div class="empty-state"><i class="ti ti-heart"></i><p>Social signal measurement is being set up for your account. It arrives with an upcoming monthly report - no action needed on your side.</p></div>';
    } else {
      var byP = {};
      rowsS.forEach(function (r) { var p = r.platform || 'unknown'; (byP[p] = byP[p] || []).push(r); });
      Object.keys(byP).forEach(function (p) {
        var m = {};
        byP[p].forEach(function (r) { var rn = numS(r.report_number) || 0; m[rn] = r; });
        byP[p] = Object.keys(m).map(function (k) { return parseFloat(k); }).sort(function (x, y) { return x - y; }).map(function (k) { return m[k]; });
      });
      var PLATS = [
        { key: 'instagram', name: 'Instagram', icon: 'ti-brand-instagram', fl: 'followers' },
        { key: 'youtube', name: 'YouTube', icon: 'ti-brand-youtube', fl: 'subscribers' },
        { key: 'tiktok', name: 'TikTok', icon: 'ti-brand-tiktok', fl: 'followers' },
        { key: 'facebook', name: 'Facebook', icon: 'ti-brand-facebook', fl: 'followers' },
        { key: 'linkedin', name: 'LinkedIn', icon: 'ti-brand-linkedin', fl: 'followers' },
        { key: 'x', name: 'X', icon: 'ti-brand-x', fl: 'followers' }
      ];
      var latestOf = function (p) { var arr = byP[p]; return arr && arr.length ? arr[arr.length - 1] : null; };
      var prevOf = function (p) { var arr = byP[p]; return arr && arr.length > 1 ? arr[arr.length - 2] : null; };
      var streakOf = function (p) {
        var arr = byP[p]; if (!arr || !arr.length) return 0;
        var n = 1;
        for (var i = arr.length - 1; i > 0; i--) { if ((numS(arr[i].report_number) || 0) - (numS(arr[i - 1].report_number) || 0) === 1) n++; else break; }
        return n;
      };
      var measured = PLATS.filter(function (P) { return latestOf(P.key); });

      var board = '';
      measured.forEach(function (P) {
        var L = latestOf(P.key), Pv = prevOf(P.key);
        var extra = '';
        if (P.key === 'youtube') {
          extra = fmtS(numS(L.video_count)) + ' videos \u00b7 ' + fmtS(numS(L.total_views)) + ' total views' + (L.subscribers_hidden === true ? ' \u00b7 subscriber count hidden by the channel' : '');
        } else if (P.key === 'instagram') {
          var bits = [];
          if (L.business_category) bits.push(escS(L.business_category));
          if (L.external_url) bits.push('link in bio');
          extra = bits.join(' \u00b7 ');
        }
        var chip = '';
        if (Pv && numS(L.followers) !== null && numS(Pv.followers) !== null) {
          var d = numS(L.followers) - numS(Pv.followers);
          var cc = d > 0 ? '#2f7a12' : (d < 0 ? '#c0392b' : '#8a8fa6');
          var arrow = d > 0 ? '\u25b2 +' + fmtS(d) : (d < 0 ? '\u25bc -' + fmtS(-d) : '\u25ac flat');
          chip = '<div style="font-size:10.5px;font-weight:700;color:' + cc + ';margin-top:2px">' + arrow + ' since last report</div>';
        }
        board += '<div style="display:flex;align-items:center;gap:14px;padding:12px 0;border-bottom:1px solid #f4f4f8"><i class="ti ' + P.icon + '" style="font-size:22px;color:#0F0638"></i><div style="flex:1;min-width:0"><a href="' + escS(L.profile_url) + '" target="_blank" rel="noopener" style="font-weight:700;color:#0F0638;font-size:13.5px;text-decoration:none">@' + escS(L.handle) + '</a>' + (extra ? '<div style="font-size:11.5px;color:#8a8fa6;margin-top:2px">' + extra + '</div>' : '') + '</div><div style="text-align:right"><div style="font-weight:700;color:#0F0638;font-size:17px">' + fmtS(numS(L.followers)) + '</div><div style="font-size:10.5px;color:#8a8fa6">' + P.fl + '</div>' + chip + '</div></div>';
      });
      var scoreCard = cardS('Where you live on social', 'Measured from your latest report. Platforms without a stored handle are not shown - never guessed.', board, true);

      var LAD = [1000, 5000, 10000, 50000, 100000, 500000, 1000000, 5000000, 10000000];
      var VLAD = [1000000, 5000000, 10000000, 50000000, 100000000];
      var firstDateAt = function (arr, field, th) {
        for (var i = 0; i < arr.length; i++) { if ((numS(arr[i][field]) || 0) >= th) return arr[i].snapshot_date || ''; }
        return '';
      };
      var medRows = '';
      measured.forEach(function (P) {
        var arr = byP[P.key], L = latestOf(P.key);
        var f = numS(L.followers);
        var chips = '';
        if (f !== null) {
          var earned = LAD.filter(function (t) { return f >= t; });
          earned.slice(-2).forEach(function (t) {
            chips += '<span style="display:inline-flex;align-items:center;gap:5px;background:#FFF3ED;border:1px solid #E8400A;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;color:#0F0638;margin-right:6px"><i class="ti ti-award" style="color:#E8400A"></i>' + fmtS(t) + ' ' + P.fl + '<span style="font-weight:400;color:#8a8fa6">measured ' + escS(firstDateAt(arr, 'followers', t)) + '</span></span>';
          });
        }
        if (P.key === 'youtube') {
          var tv = numS(L.total_views);
          if (tv !== null) {
            VLAD.filter(function (t) { return tv >= t; }).slice(-1).forEach(function (t) {
              chips += '<span style="display:inline-flex;align-items:center;gap:5px;background:#FFF3ED;border:1px solid #E8400A;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;color:#0F0638;margin-right:6px"><i class="ti ti-award" style="color:#E8400A"></i>' + fmtS(t) + ' views<span style="font-weight:400;color:#8a8fa6">measured ' + escS(firstDateAt(arr, 'total_views', t)) + '</span></span>';
            });
          }
        }
        var next = '';
        if (f !== null) {
          var nx = null;
          for (var j = 0; j < LAD.length; j++) { if (LAD[j] > f) { nx = LAD[j]; break; } }
          if (nx) {
            var pct = Math.min(99, Math.floor(f / nx * 100));
            next = '<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><div style="flex:1;background:#f4f4f8;border-radius:4px;height:8px"><div style="width:' + pct + '%;height:8px;border-radius:4px;background:#E8400A"></div></div><div style="font-size:10.5px;color:#8a8fa6;white-space:nowrap">' + pct + '% of the way to ' + fmtS(nx) + '</div></div>';
          }
        }
        medRows += '<div style="padding:10px 0;border-bottom:1px solid #f4f4f8"><div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><i class="ti ' + P.icon + '" style="color:#0F0638"></i><span style="font-size:12.5px;font-weight:700;color:#0F0638">' + P.name + '</span></div>' + (chips || '<span style="font-size:11.5px;color:#8a8fa6">First milestone at ' + fmtS(LAD[0]) + ' ' + P.fl + '.</span>') + next + '</div>';
      });
      var medalCard = cardS('Milestones', 'Earned the moment we measure you past a line. Dates are when Monitor first measured it, stated as such.', medRows, true);

      var comps = [];
      comps.push({ name: 'Presence', measured: true, pts: measured.length >= 2 ? 25 : 15, max: 25, note: measured.length + ' platform' + (measured.length === 1 ? '' : 's') + ' measured' });
      var anyPrev = measured.some(function (P) { return prevOf(P.key); });
      if (anyPrev) {
        var pos = 0, neg = 0;
        measured.forEach(function (P) { var L = latestOf(P.key), Pv = prevOf(P.key); if (L && Pv && numS(L.followers) !== null && numS(Pv.followers) !== null) { var d = numS(L.followers) - numS(Pv.followers); if (d > 0) pos++; if (d < 0) neg++; } });
        comps.push({ name: 'Growth', measured: true, pts: pos > 0 ? 25 : (neg > 0 ? 5 : 15), max: 25, note: pos + ' growing, ' + neg + ' shrinking' });
      } else {
        comps.push({ name: 'Growth', measured: false, note: 'needs two reports' });
      }
      var igFr = latestOf('instagram');
      var igLP = igFr && igFr.last_post_date ? new Date(igFr.last_post_date) : null;
      var daysSince = igLP && !isNaN(igLP.getTime()) ? Math.floor((Date.now() - igLP.getTime()) / 86400000) : null;
      if (daysSince !== null && daysSince >= 0) {
        comps.push({ name: 'Posting freshness', measured: true, pts: daysSince <= 14 ? 25 : (daysSince <= 45 ? 15 : 5), max: 25, note: 'last post ' + daysSince + 'd ago' });
      } else {
        comps.push({ name: 'Posting freshness', measured: false, note: 'not yet measured - excluded, never guessed' });
      }
      comps.push({ name: 'Audience quality', measured: false, note: 'not yet measured - excluded, never guessed' });
      var mComps = comps.filter(function (c) { return c.measured; });
      var scoreInner;
      if (mComps.length >= 2) {
        var earnedP = 0, maxP = 0;
        mComps.forEach(function (c) { earnedP += c.pts; maxP += c.max; });
        var sc = Math.round(100 * earnedP / maxP);
        var circ = 2 * Math.PI * 34;
        var dash = (sc / 100 * circ).toFixed(1);
        scoreInner = '<div style="display:flex;align-items:center;gap:18px"><svg viewBox="0 0 80 80" style="width:80px;height:80px;flex:none"><circle cx="40" cy="40" r="34" fill="none" stroke="#f4f4f8" stroke-width="8"></circle><circle cx="40" cy="40" r="34" fill="none" stroke="#E8400A" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + dash + ' ' + circ.toFixed(1) + '" transform="rotate(-90 40 40)"></circle><text x="40" y="46" text-anchor="middle" font-size="20" font-weight="700" fill="#0F0638">' + sc + '</text></svg><div style="flex:1">';
      } else {
        scoreInner = '<div style="display:flex;align-items:center;gap:18px"><div style="font-size:12.5px;color:#8a8fa6;max-width:200px">Your Social Score arrives with your second report. A score needs movement, and movement needs history.</div><div style="flex:1">';
      }
      var compList = '';
      comps.forEach(function (c) {
        compList += '<div style="display:flex;justify-content:space-between;padding:3px 0"><span style="font-size:11.5px;color:#3F4157">' + c.name + '</span><span style="font-size:11.5px;color:' + (c.measured ? '#0F0638' : '#8a8fa6') + ';font-weight:' + (c.measured ? '700' : '400') + '">' + (c.measured ? c.pts + '/' + c.max + ' \u00b7 ' + c.note : c.note) + '</span></div>';
      });
      var stChips = '';
      measured.forEach(function (P) {
        var st = streakOf(P.key);
        stChips += '<span style="display:inline-flex;align-items:center;gap:4px;background:#f4f4f8;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;color:#0F0638;margin:3px 6px 0 0"><i class="ti ti-flame" style="color:#E8400A"></i>' + P.name + ' ' + st + ' report' + (st === 1 ? '' : 's') + '</span>';
      });
      scoreInner += compList + '<div style="margin-top:6px">' + stChips + '</div></div></div>';
      var scoreRingCard = cardS('Social Score', 'Scored only from what was measured. Unmeasured signals are excluded from the math, not counted as zero.', scoreInner);

      var PALW = ['#E8400A', '#1D9E75', '#D4537E', '#D85A30', '#5DCAA5', '#F0997B'];
      var tot = 0;
      measured.forEach(function (P) { tot += numS(latestOf(P.key).followers) || 0; });
      var balInner;
      if (tot > 0) {
        var circ2 = 2 * Math.PI * 30;
        var off = 0, segs = '', legend = '';
        measured.forEach(function (P, ix) {
          var v = numS(latestOf(P.key).followers) || 0;
          var frac = v / tot;
          var col = PALW[ix % PALW.length];
          segs += '<circle cx="40" cy="40" r="30" fill="none" stroke="' + col + '" stroke-width="12" stroke-dasharray="' + (frac * circ2).toFixed(2) + ' ' + circ2.toFixed(2) + '" stroke-dashoffset="' + (-off).toFixed(2) + '" transform="rotate(-90 40 40)"></circle>';
          off += frac * circ2;
          var pctT = (frac * 100) >= 99.95 ? '100' : (frac * 100 < 0.1 ? '&lt;0.1' : (frac * 100).toFixed(1).replace('.0', ''));
          legend += '<div style="display:flex;align-items:center;gap:7px;padding:2px 0"><span style="width:9px;height:9px;border-radius:2px;background:' + col + ';display:inline-block"></span><span style="font-size:11.5px;color:#3F4157;flex:1">' + P.name + '</span><span style="font-size:11.5px;font-weight:700;color:#0F0638">' + pctT + '%</span></div>';
        });
        var domIx = -1, domFrac = 0;
        measured.forEach(function (P, ix) { var fr = (numS(latestOf(P.key).followers) || 0) / tot; if (fr > domFrac) { domFrac = fr; domIx = ix; } });
        var balNote = (measured.length > 1 && domFrac >= 0.8) ? '<div style="font-size:11.5px;color:#8a8fa6;margin-top:8px">You are ' + measured[domIx].name + '-first. Everything else is upside.</div>' : '';
        balInner = '<div style="display:flex;align-items:center;gap:16px"><svg viewBox="0 0 80 80" style="width:84px;height:84px;flex:none">' + segs + '</svg><div style="flex:1">' + legend + balNote + '</div></div>';
      } else {
        balInner = '<div style="font-size:12.5px;color:#8a8fa6">No follower counts measured yet.</div>';
      }
      var balCard = cardS('Where your audience lives', 'Share of your total measured audience, latest report per platform.', balInner);

      var growthInner = '', anyHist = false;
      measured.forEach(function (P) {
        var arr = byP[P.key];
        if (arr.length < 2) return;
        var first = numS(arr[0].followers), last = numS(arr[arr.length - 1].followers);
        if (first === null || last === null) return;
        anyHist = true;
        var d = last - first;
        var col = d > 0 ? '#2f7a12' : (d < 0 ? '#c0392b' : '#8a8fa6');
        var lbl = d === 0 ? 'flat' : (d > 0 ? '+' + fmtS(d) : '-' + fmtS(-d));
        growthInner += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f4f4f8"><div style="font-size:12.5px;color:#0F0638;font-weight:700">' + P.name + '</div><div style="font-size:12.5px;color:' + col + ';font-weight:700">' + lbl + ' across ' + arr.length + ' reports</div></div>';
      });
      if (!anyHist) growthInner = '<div style="font-size:12.5px;color:#8a8fa6;padding:6px 0">Growth draws itself once you have two reports with social data. Not shown rather than guessed.</div>';
      var growthCard = cardS('Follower growth', 'First stored report against the latest one, per platform.', growthInner);

      var igL = latestOf('instagram');
      var aqInner;
      if (igL && (numS(igL.human_score) !== null || numS(igL.avg_engagement_rate) !== null || numS(igL.bot_score) !== null)) {
        var aqRow = function (label, val, suffix) { return '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #f4f4f8"><div style="font-size:12.5px;color:#3F4157">' + label + '</div><div style="font-size:12.5px;font-weight:700;color:#0F0638">' + (val === null ? '-' : val + suffix) + '</div></div>'; };
        aqInner = aqRow('Human-like audience score', numS(igL.human_score), '') + aqRow('Bot score', numS(igL.bot_score), '') + aqRow('Average engagement rate', numS(igL.avg_engagement_rate), '%') + aqRow('Post timing variance', numS(igL.post_timing_variance), '');
      } else {
        aqInner = '<div style="font-size:12.5px;color:#8a8fa6;padding:6px 0">Audience quality could not be measured this month. Shown as absent, not guessed - very large accounts can take longer to analyze.</div>';
      }
      var aqHuman = igL ? numS(igL.human_score) : null;
      var aqBot = igL ? numS(igL.bot_score) : null;
      if (aqHuman !== null || aqBot !== null) {
        var hPct = aqHuman !== null ? Math.round(aqHuman * 100) : (aqBot !== null ? Math.round((1 - aqBot) * 100) : null);
        var gCol = hPct >= 85 ? '#2f7a12' : (hPct >= 60 ? '#a86b12' : '#c0392b');
        var gCirc = 2 * Math.PI * 30;
        var gDash = (hPct / 100 * gCirc).toFixed(1);
        var badge = hPct >= 85 ? '<div style="display:inline-flex;align-items:center;gap:5px;background:#e8f7e0;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;color:#2f7a12;margin-top:8px"><i class="ti ti-shield-check"></i>Audience behaves like real people</div>' : (hPct < 60 ? '<div style="display:inline-flex;align-items:center;gap:5px;background:#fde8e8;border-radius:999px;padding:3px 10px;font-size:11px;font-weight:700;color:#c0392b;margin-top:8px"><i class="ti ti-alert-triangle"></i>Worth a closer look</div>' : '');
        var er = numS(igL.avg_engagement_rate);
        aqInner = '<div style="display:flex;align-items:center;gap:18px"><svg viewBox="0 0 80 80" style="width:84px;height:84px;flex:none"><circle cx="40" cy="40" r="30" fill="none" stroke="#f4f4f8" stroke-width="10"></circle><circle cx="40" cy="40" r="30" fill="none" stroke="' + gCol + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + gDash + ' ' + gCirc.toFixed(1) + '" transform="rotate(-90 40 40)"></circle><text x="40" y="45" text-anchor="middle" font-size="17" font-weight="700" fill="#0F0638">' + hPct + '%</text></svg><div style="flex:1"><div style="font-size:12.5px;color:#0F0638;font-weight:700">Human-like audience</div><div style="font-size:11.5px;color:#8a8fa6;line-height:1.5;margin-top:2px">' + (aqBot !== null ? 'Bot-like signals ' + Math.round(aqBot * 100) + '%. ' : '') + (er !== null ? 'Engagement rate ' + (Math.round(er * 100) / 100) + '%.' : 'Engagement rate not measured.') + '</div>' + badge + '</div></div>';
      }
      var aqCard = cardS('Audience quality - Instagram', 'How real your audience behaves. Measured, never estimated.', aqInner);
      var pulseRows = '';
      measured.forEach(function (P) {
        var L3 = latestOf(P.key);
        var lp = L3 && L3.last_post_date ? new Date(L3.last_post_date) : null;
        if (!lp || isNaN(lp.getTime())) return;
        var dsp = Math.floor((Date.now() - lp.getTime()) / 86400000);
        if (dsp < 0) return;
        var pc = dsp <= 14 ? '#2f7a12' : (dsp <= 60 ? '#a86b12' : '#c0392b');
        var msg = dsp === 0 ? 'posted today' : (dsp === 1 ? 'posted yesterday' : 'latest measured post ' + dsp + ' days ago');
        if (dsp > 60) msg += ' - a quiet profile costs more trust than no profile';
        pulseRows += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f4f4f8"><span style="width:10px;height:10px;border-radius:50%;background:' + pc + ';display:inline-block"></span><div style="font-size:12.5px;font-weight:700;color:#0F0638;min-width:90px">' + P.name + '</div><div style="font-size:12px;color:#3F4157">' + msg + '</div></div>';
      });
      var pulseCard = cardS('Posting pulse', 'How recently each measured profile published. From the newest post timestamp in your report - never assumed.', pulseRows || '<div style="font-size:12.5px;color:#8a8fa6;padding:6px 0">Post dates arrive with your next report - the engine now measures them.</div>');

      window.__soGoal = function (p) {
        var inp = document.getElementById('so-goal-inp-' + p);
        if (!inp) return;
        var v = parseFloat(String(inp.value).replace(/[^0-9.]/g, ''));
        if (!isNaN(v) && v > 0) { lsSet('social_goal_' + subIdS + '_' + p, String(Math.round(v))); renderSocial(); }
      };
      window.__soGoalClear = function (p) { lsSet('social_goal_' + subIdS + '_' + p, ''); renderSocial(); };
      var goalRows = '';
      measured.forEach(function (P) {
        var L = latestOf(P.key), Pv = prevOf(P.key);
        var f = numS(L.followers);
        var g = numS(lsGet('social_goal_' + subIdS + '_' + P.key));
        var right;
        if (g && f !== null) {
          var pctG = Math.min(100, Math.floor(f / g * 100));
          var proj = '';
          if (f >= g) proj = 'Goal reached. Set a higher one.';
          else if (Pv && numS(Pv.followers) !== null) {
            var rate = f - numS(Pv.followers);
            proj = rate > 0 ? 'about ' + Math.ceil((g - f) / rate) + ' reports away at your measured pace (a projection, not a promise)' : 'no measured growth yet, so no projection';
          } else proj = 'projection appears after two reports';
          right = '<div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:11px;color:#8a8fa6;margin-bottom:3px"><span>' + fmtS(f) + ' of ' + fmtS(g) + '</span><span>' + pctG + '%</span></div><div style="background:#f4f4f8;border-radius:4px;height:8px"><div style="width:' + pctG + '%;height:8px;border-radius:4px;background:#E8400A"></div></div><div style="font-size:10.5px;color:#8a8fa6;margin-top:3px">' + proj + '</div></div><button onclick="__soGoalClear(\'' + P.key + '\')" style="background:transparent;border:0;color:#8a8fa6;font-size:11px;cursor:pointer;text-decoration:underline;padding:0">change</button>';
        } else {
          right = '<input id="so-goal-inp-' + P.key + '" placeholder="Target ' + P.fl + '" style="width:130px;padding:6px 10px;border:1px solid #eceaf5;border-radius:8px;font-size:12px;color:#0F0638;background:#fff"><button onclick="__soGoal(\'' + P.key + '\')" style="padding:6px 14px;border:0;border-radius:8px;background:#E8400A;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Set goal</button>';
        }
        goalRows += '<div style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid #f4f4f8"><div style="min-width:110px;display:flex;align-items:center;gap:7px"><i class="ti ' + P.icon + '" style="color:#0F0638"></i><span style="font-size:12.5px;font-weight:700;color:#0F0638">' + P.name + '</span></div>' + right + '</div>';
      });
      var goalCard = cardS('Your goals', 'Set a target per platform. Saved on this device. Progress is measured; the pace estimate is a projection and says so.', goalRows, true);

      var best = null;
      measured.forEach(function (P) { var L2 = latestOf(P.key); if (numS(L2.followers) !== null && (!best || numS(L2.followers) > best.f)) best = { name: P.name, f: numS(L2.followers) }; });
      var insight = best ? '<div class="tms-full" style="border-left:3px solid #E8400A;padding:8px 12px;background:#FFF3ED"><div style="font-size:12.5px;color:#0F0638;line-height:1.55">' + best.name + ' is your biggest measured audience at ' + fmtS(best.f) + ' ' + (best.name === 'YouTube' ? 'subscribers' : 'followers') + '.</div></div>' : '';
      var ladderCard = (function () {
          var planL = String((state.data.masterRecord && state.data.masterRecord.plan) || '').toLowerCase();
          if (planL !== 'agency') return '';
          var rawComp = (state.data.competitorSocial !== undefined) ? state.data.competitorSocial : state.data.competitor_social;
          var compWired = (rawComp !== undefined && rawComp !== null);
          var compAll = compWired ? rawComp : [];
          var ownIG = null;
          rowsS.forEach(function (r) {
            if (String(r.platform || '').toLowerCase() !== 'instagram') return;
            var rn = numS(r.report_number) || 0;
            if (!ownIG || rn >= (numS(ownIG.report_number) || 0)) ownIG = r;
          });
          var byC = {};
          compAll.forEach(function (r) {
            if (String(r.platform || '').toLowerCase() !== 'instagram') return;
            var key = String(r.competitor_label || r.handle || '');
            if (!key) return;
            var rn = numS(r.report_number) || 0;
            if (!byC[key] || rn >= (numS(byC[key].report_number) || 0)) byC[key] = r;
          });
          var comps = Object.keys(byC).map(function (k) { return byC[k]; });
          var LT = 'Follower ladder';
          var LS = 'Instagram following, you against your tracked competitors. Latest measured report.';
          if (!comps.length) {
            var absMsg = compWired
              ? 'No competitors are set on your account yet. Add up to three and their following appears here from the next report.'
              : 'Competitor tracking is not connected on this dashboard yet, so nothing has been measured. If you were expecting figures here, this is a setup issue rather than an empty month.';
            return cardS(LT, LS, '<div style="font-size:12.5px;color:#8a8fa6;padding:8px 0">' + absMsg + '</div>', true);
          }
          var measured = [], unmeasured = [];
          comps.forEach(function (r) {
            var f = numS(r.followers);
            var nm = String(r.competitor_label || r.handle || 'Competitor');
            if (f === null) unmeasured.push(nm); else measured.push({ name: nm, f: f, own: false });
          });
          var ownF = ownIG ? numS(ownIG.followers) : null;
          if (ownF !== null) measured.push({ name: 'You', f: ownF, own: true });
          if (!measured.length) {
            return cardS(LT, LS, '<div style="font-size:12.5px;color:#8a8fa6;padding:8px 0">None of your tracked competitors returned a follower count this month, so no ladder can be drawn. Nothing here is estimated.</div>', true);
          }
          measured.sort(function (a, b) { return b.f - a.f; });
          var maxF = measured[0].f || 1;
          var bars = measured.map(function (r) {
            var w = Math.max(6, Math.round((r.f / maxF) * 100));
            var bg = r.own ? '#E8400A' : '#cfd2e2';
            var tc = r.own ? '#ffffff' : '#0F0638';
            return '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">'
              + '<div style="min-width:130px;font-size:12.5px;color:#0F0638;font-weight:' + (r.own ? '700' : '400') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + escS(r.name) + '</div>'
              + '<div style="flex:1;background:#f7f7fb;border-radius:4px;height:18px"><div style="width:' + w + '%;height:18px;border-radius:4px;background:' + bg + ';display:flex;align-items:center;justify-content:flex-end;padding-right:6px;font-size:10px;color:' + tc + ';font-weight:700;min-width:56px;box-sizing:border-box">' + fmtS(r.f) + '</div></div></div>';
          }).join('');
          var note = unmeasured.length ? '<div style="font-size:11.5px;color:#b9bccb;margin-top:4px">Not measured this month: ' + escS(unmeasured.join(', ')) + '</div>' : '';
          var ins = '';
          if (ownF === null) {
            ins = '<div style="font-size:12.5px;color:#8a8fa6;margin-top:10px">Your own Instagram following was not measured this month, so no gap can be calculated.</div>';
          } else {
            var pos = 0;
            for (var i2 = 0; i2 < measured.length; i2++) { if (measured[i2].own) { pos = i2 + 1; break; } }
            var line;
            if (pos === 1) {
              line = measured.length > 1 ? 'You lead the measured set by ' + fmtS(ownF - measured[1].f) + ' followers.' : 'You are the only measured account this month.';
            } else {
              var ah = measured[pos - 2];
              line = 'You are ' + pos + ' of ' + measured.length + ' measured. ' + escS(ah.name) + ' is ' + fmtS(ah.f - ownF) + ' followers ahead.';
            }
            ins = '<div style="border-left:3px solid #E8400A;padding:8px 12px;background:#FFF3ED;margin-top:12px"><div style="font-size:12.5px;color:#0F0638;line-height:1.55">' + line + '</div></div>';
          }
          return cardS(LT, LS, bars + note + ins, true);
        })();
        htmlSO = '<style>.tms-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}.tms-grid>.tms-full{grid-column:1/-1}@media(max-width:900px){.tms-grid{grid-template-columns:minmax(0,1fr)}}</style><div class="tms-grid">' + scoreCard + medalCard + scoreRingCard + balCard + growthCard + aqCard + pulseCard + goalCard + ladderCard + insight + '</div>';
    }
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

  // ── RTL / BIDI SUPPORT (Hebrew, Arabic) ────────────────────────
  // Any text node that contains Hebrew or Arabic gets dir="auto" on its
  // parent element so the browser applies the Unicode bidi algorithm.
  // Mixed Hebrew and English lines stay readable and punctuation lands on
  // the correct side. Pure insertion: no existing render site is touched.
  const RTL_RE = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/;

  function applyBidi(node) {
    if (!node) return;
    const root = node.nodeType === 1 ? node : node.parentElement;
    if (!root || root.nodeType !== 1) return;
    if (!RTL_RE.test(root.textContent || '')) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let n;
    while ((n = walker.nextNode())) {
      if (!RTL_RE.test(n.nodeValue || '')) continue;
      const el = n.parentElement;
      if (!el || el.getAttribute('dir') === 'auto') continue;
      el.setAttribute('dir', 'auto');
      el.style.unicodeBidi = 'isolate';
    }
  }

  function startBidiWatcher() {
    applyBidi(document.body);
    if (typeof MutationObserver === 'undefined') return;
    const pending = [];
    let queued = false;
    function flush() {
      queued = false;
      const batch = pending.splice(0, pending.length);
      for (let i = 0; i < batch.length; i++) applyBidi(batch[i]);
    }
    const obs = new MutationObserver(function (records) {
      for (let i = 0; i < records.length; i++) {
        const r = records[i];
        if (r.type === 'characterData') { pending.push(r.target); continue; }
        for (let j = 0; j < r.addedNodes.length; j++) pending.push(r.addedNodes[j]);
      }
      if (pending.length && !queued) { queued = true; setTimeout(flush, 0); }
    });
    obs.observe(document.body, { childList: true, subtree: true, characterData: true });
  }

  // ── INIT ─────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', boot);
  document.addEventListener('DOMContentLoaded', startBidiWatcher);

})();
