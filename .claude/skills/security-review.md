# Security Review — TAMEYO Monitor

Focused security audit for this vanilla JS + Wix backend SPA.

## Checks to run

### 1. XSS via innerHTML
```bash
grep -n "innerHTML" /home/user/Monitor/app.js | grep -v "//.*innerHTML"
```
For each hit: verify the value is either static HTML, a number, or explicitly sanitized. User-controlled strings must never be assigned to `innerHTML` directly.

### 2. eval / dangerous sinks
```bash
grep -En "eval\(|new Function\(|document\.write\(|setTimeout\(['\"]" /home/user/Monitor/app.js
```
Any match is a critical finding.

### 3. Hardcoded secrets or API keys
```bash
grep -En "(api[_-]?key|secret|token|password)\s*[=:]" /home/user/Monitor/app.js /home/user/Monitor/wix/backend/subscriberLookup.jsw -i
```
Secrets belong in Wix Secrets Manager or environment variables, never in source.

### 4. Wix backend — exposed data
Read `wix/backend/subscriberLookup.jsw` and verify:
- The function only returns data the caller is authorized to see
- No full subscriber record is returned when only a subset is needed
- Wix `wix-data` queries use `.eq("memberId", context.memberId)` or equivalent to scope results

### 5. External URLs
```bash
grep -n "http" /home/user/Monitor/app.js | grep -v "//\|localhost\|tameyogroup\|wix\|tabler"
```
Review any unexpected external domains.

## Severity scale
- **Critical**: eval, innerHTML with user input, exposed secrets
- **High**: unscoped Wix data queries, missing auth checks
- **Medium**: unnecessary data exposure, overly broad CORS
- **Low**: console.log with sensitive data, verbose error messages
