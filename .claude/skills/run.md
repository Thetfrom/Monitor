# Run — TAMEYO Monitor

Serve the app locally so you can preview it in a browser.

## Steps

1. Check if `serve` is available, install if not:
   ```bash
   which serve 2>/dev/null || npm install -g serve
   ```

2. Start the server from the project root:
   ```bash
   cd /home/user/Monitor
   serve . -p 3000 --no-clipboard
   ```

3. The app will be available at http://localhost:3000

## Notes
- This is a vanilla JS SPA — no build step needed, files are served as-is
- The app loads mock data from `mockData.js` when not running inside Wix
- `index.html` is the entry point; routing is handled in `app.js` via screen visibility toggling
- Press Ctrl+C to stop the server
