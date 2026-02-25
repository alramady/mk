#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# check-no-proprietary.sh — CI Guard
#
# Fails the build if proprietary strings appear in runtime code
# paths. Documentation and this script itself are excluded.
#
# Usage:
#   ./scripts/check-no-proprietary.sh
#
# Exit codes:
#   0 — clean
#   1 — proprietary references found
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Patterns to search for (case-insensitive)
PATTERNS=(
  "manus\.ai"
  "manus\.im"
  "manus\.computer"
  "manus-sdk"
  "manus-agent"
  "@manus/"
  "MANUS_API"
  "manus-telemetry"
)

# Directories to scan (runtime code only)
SCAN_DIRS=(
  "services/"
  "apps/"
  "packages/"
)

# Files/dirs to exclude from scan
EXCLUDE_PATTERNS=(
  "*/node_modules/*"
  "*/.git/*"
  "*/dist/*"
  "*/build/*"
  "*/docs/*"
  "*/scripts/check-no-proprietary.sh"
  "*/.manus-logs/*"
  "*/README.md"
  "*/.env*"
)

echo "🔍 Scanning for proprietary references in runtime code..."
echo ""

FOUND=0

for pattern in "${PATTERNS[@]}"; do
  # Build grep exclude args
  EXCLUDE_ARGS=""
  for excl in "${EXCLUDE_PATTERNS[@]}"; do
    EXCLUDE_ARGS="$EXCLUDE_ARGS --exclude-dir=$(dirname "$excl" 2>/dev/null || echo "$excl")"
  done

  for dir in "${SCAN_DIRS[@]}"; do
    if [ -d "$dir" ]; then
      # Use grep with exclusions
      MATCHES=$(grep -rni "$pattern" "$dir" \
        --include="*.ts" \
        --include="*.tsx" \
        --include="*.js" \
        --include="*.jsx" \
        --include="*.json" \
        --include="*.css" \
        --exclude-dir="node_modules" \
        --exclude-dir="dist" \
        --exclude-dir="build" \
        --exclude-dir=".git" \
        2>/dev/null || true)

      if [ -n "$MATCHES" ]; then
        echo -e "${RED}❌ Found '$pattern' in:${NC}"
        echo "$MATCHES" | head -20
        echo ""
        FOUND=1
      fi
    fi
  done
done

if [ "$FOUND" -eq 1 ]; then
  echo -e "${RED}══════════════════════════════════════════════${NC}"
  echo -e "${RED}  FAIL: Proprietary references found in code  ${NC}"
  echo -e "${RED}══════════════════════════════════════════════${NC}"
  exit 1
else
  echo -e "${GREEN}✅ No proprietary references found — all clear.${NC}"
  exit 0
fi
