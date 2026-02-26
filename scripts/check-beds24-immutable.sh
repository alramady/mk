#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# CI Guardrail: Beds24 SDK Immutability Check
# ─────────────────────────────────────────────────────────────
# This script MUST run in every PR/CI pipeline.
# It fails the build if ANY file under packages/beds24-sdk/ has changed.
#
# Usage:
#   npm run check:beds24-immutable
#   # or directly:
#   bash scripts/check-beds24-immutable.sh
# ─────────────────────────────────────────────────────────────

set -euo pipefail

PROTECTED_PATH="packages/beds24-sdk/"
BASE_REF="${BASE_REF:-origin/main}"

echo "🔒 Beds24 SDK Immutability Check"
echo "   Protected path: ${PROTECTED_PATH}"
echo "   Comparing against: ${BASE_REF}"
echo ""

# Detect changed files under the protected path
CHANGED_FILES=$(git diff --name-only "${BASE_REF}"...HEAD -- "${PROTECTED_PATH}" 2>/dev/null || true)

if [ -n "$CHANGED_FILES" ]; then
  echo "❌ FAILURE: Changes detected in protected Beds24 SDK!"
  echo ""
  echo "The following files were modified:"
  echo "$CHANGED_FILES" | while read -r f; do echo "  • $f"; done
  echo ""
  echo "RULE: packages/beds24-sdk/** is IMMUTABLE."
  echo "No changes are permitted to the Beds24 SDK, including:"
  echo "  - src/auth/* (client, token-manager)"
  echo "  - src/proxy/* (admin-proxy)"
  echo "  - src/wrappers/* (bookings, guests, inventory, properties)"
  echo "  - src/__tests__/*"
  echo ""
  echo "If you need to extend Beds24 functionality, create a new module"
  echo "outside the SDK package."
  exit 1
fi

echo "✅ No changes detected under ${PROTECTED_PATH}"
echo "   Beds24 SDK is intact."
exit 0
