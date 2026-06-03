#!/bin/bash
set -euo pipefail

# Only run in remote Claude Code web sessions
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

# Install dev tools for this vanilla JS project
npm install -g serve eslint 2>/dev/null || true
