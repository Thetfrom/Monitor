# Code Review — TAMEYO Monitor

Project-aware code review focused on this vanilla JS SPA's patterns.

## What to review

### Screen management (`app.js`)
- Screen transitions: every `showScreen()` call should hide all siblings correctly
- Each screen's init function should guard against double-initialization
- Event listeners should be registered once, not re-registered on each screen visit

### Wix bridge (`wix/` directory)
- `wix/backend/subscriberLookup.jsw` — check for proper error handling on Wix Data queries
- `wix/pages/MyDashboard.js` — verify `$w.onReady` wraps all DOM access; no top-level side effects
- Ensure auth errors are forwarded to the SPA's `auth_error` handler

### Data layer (`mockData.js`)
- Mock data shapes must match what `app.js` destructures — check for key name mismatches
- Verify mock data covers all edge cases: empty arrays, null values, zero counts

### CSS (`styles.css`)
- Check for `.hidden` class consistency — the SPA uses this to toggle screens
- No inline styles added directly via `element.style` that bypass the class system

## How to run
Read `app.js` fully, then `wix/pages/MyDashboard.js`, then `wix/backend/subscriberLookup.jsw`.
Report findings grouped by: **Bugs**, **Security**, **UX/Logic**, **Cleanup**.
