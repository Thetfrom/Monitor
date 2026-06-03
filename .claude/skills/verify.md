# Verify — TAMEYO Monitor

Confirm the app serves correctly and has no obvious runtime issues.

## Steps

1. Start the server in the background:
   ```bash
   which serve 2>/dev/null || npm install -g serve
   serve /home/user/Monitor -p 3000 --no-clipboard &
   SERVER_PID=$!
   sleep 2
   ```

2. Check the HTML loads (HTTP 200):
   ```bash
   curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/
   ```

3. Check all JS and CSS files are reachable:
   ```bash
   for f in app.js logo.js mockData.js styles.css; do
     STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/$f)
     echo "$f: $STATUS"
   done
   ```

4. Scan source for common runtime red flags:
   ```bash
   grep -n "innerHTML\s*=" /home/user/Monitor/app.js | head -20
   grep -n "eval(" /home/user/Monitor/app.js
   grep -n "document\.write" /home/user/Monitor/app.js
   ```

5. Stop the server:
   ```bash
   kill $SERVER_PID 2>/dev/null || true
   ```

## Pass criteria
- All files return HTTP 200
- No `eval()` or `document.write()` calls
- Any `innerHTML` uses are reviewed for XSS risk
