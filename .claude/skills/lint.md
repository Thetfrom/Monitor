# Lint — TAMEYO Monitor

Run ESLint across the JavaScript source files.

## Steps

1. Ensure ESLint is available:
   ```bash
   which eslint 2>/dev/null || npm install -g eslint
   ```

2. The project uses ESLint v9 flat config — `eslint.config.js` is already committed at the project root.

3. Run ESLint on all JS source files:
   ```bash
   eslint /home/user/Monitor/app.js /home/user/Monitor/logo.js /home/user/Monitor/mockData.js
   ```

## What to look for
- `no-undef` warnings: variables used before definition or missing globals
- `no-unused-vars`: dead code candidates
- `eqeqeq` errors: `==` instead of `===` (type coercion bugs)
- `no-eval` errors: security risk — must fix
