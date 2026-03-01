#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# check-no-proprietary.sh — CI Guard
#
# Fails the build if proprietary/external-AI-platform strings
# appear in runtime code paths.
# Documentation and this script itself are excluded.
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

# Build the pattern file dynamically so this script itself stays clean
PATTERN_FILE=$(mktemp)
trap 'rm -f "$PATTERN_FILE"' EXIT

# Encode patterns as base64 to avoid self-matching
# Each line below decodes to a prohibited string pattern
echo "bWFudXMuYWk=" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "bWFudXMuaW0=" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "bWFudXMuY29tcHV0ZXI=" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "bWFudXMtc2Rr" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "bWFudXMtYWdlbnQ=" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "QG1hbnVzLw==" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "TUFOVVNFQVBJ" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "bWFudXMtdGVsZW1ldHJ5" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "bWFudXNjZG4=" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "dml0ZS1wbHVnaW4tbWFudXM=" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "TWFudXNEaWFsb2c=" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "Zm9yZ2VBcGlVcmw=" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "Zm9yZ2VBcGlLZXk=" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"
echo "QlVJTFRfSU5fRk9SR0U=" | base64 -d >> "$PATTERN_FILE" && echo >> "$PATTERN_FILE"

# Directories to scan (runtime code only)
SCAN_DIRS=(
  "server/"
  "client/"
  "shared/"
  "drizzle/"
  "services/"
  "apps/"
  "packages/"
)

echo "Scanning for proprietary references in runtime code..."
echo ""

FOUND=0

while IFS= read -r pattern; do
  [ -z "$pattern" ] && continue
  for dir in "${SCAN_DIRS[@]}"; do
    if [ -d "$dir" ]; then
      MATCHES=$(grep -rni "$pattern" "$dir" \
        --include="*.ts" \
        --include="*.tsx" \
        --include="*.js" \
        --include="*.jsx" \
        --include="*.json" \
        --include="*.css" \
        --include="*.html" \
        --exclude-dir="node_modules" \
        --exclude-dir="dist" \
        --exclude-dir="build" \
        --exclude-dir=".git" \
        2>/dev/null || true)

      if [ -n "$MATCHES" ]; then
        echo -e "${RED}FAIL: Found '$pattern' in:${NC}"
        echo "$MATCHES" | head -20
        echo ""
        FOUND=1
      fi
    fi
  done
done < "$PATTERN_FILE"

if [ "$FOUND" -eq 1 ]; then
  echo -e "${RED}══════════════════════════════════════════════${NC}"
  echo -e "${RED}  FAIL: Proprietary references found in code  ${NC}"
  echo -e "${RED}══════════════════════════════════════════════${NC}"
  exit 1
else
  echo -e "${GREEN}No proprietary references found — all clear.${NC}"
  exit 0
fi
