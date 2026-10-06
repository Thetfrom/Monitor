// Page: My Dashboard (/my-dashboard) — "Open My Dashboard" button handler
// File: pages/MyDashboard.token.js
//
// This REPLACES the click handler that builds the #d=<base64 payload> link.
// Keep the page's existing elements; only the button code changes.
//
// SETUP:
// 1. Add backend/dashboardToken.jsw (same folder in this repo) to the site.
// 2. In the page code for /my-dashboard, find the "Open My Dashboard" button's
//    onClick (it queries the collections and base64-encodes them into the URL).
//    Delete that handler and paste this file in its place.
// 3. Replace '#btnOpenDashboard' below with the button's real element ID.
// 4. Publish. Then in app.js set ACCEPT_LEGACY_FRAGMENT = false and push, so
//    every old #d= link ever shared stops working.

import wixLocation from 'wix-location';
import { mintDashboardToken } from 'backend/dashboardToken.jsw';

$w.onReady(function () {
  $w('#btnOpenDashboard').onClick(async () => {
    const btn = $w('#btnOpenDashboard');
    const originalLabel = btn.label;
    btn.disable();
    btn.label = 'Opening…';
    try {
      const res = await mintDashboardToken();
      if (res.ok) {
        // Same tab keeps the member session intact; use wixLocation.to(res.url, '_blank')
        // if the dashboard should open beside the member page instead.
        wixLocation.to(res.url);
        return;
      }
      if (res.reason === 'no_account') {
        wixLocation.to('https://thetfrom.github.io/Monitor/#noaccount');
        return;
      }
      wixLocation.to('/account/my-account'); // not signed in
    } catch (e) {
      console.error('mintDashboardToken failed', e);
      btn.label = originalLabel;
      btn.enable();
    }
  });
});
