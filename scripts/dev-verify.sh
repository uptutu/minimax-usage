#!/usr/bin/env bash
# dev-verify.sh — runs the §0 acceptance checklist from docs/refactor.md.
#
# Steps:
#   1. tsc --noEmit
#   2. npm run build
#   3. node --test (unit tests)
#   4. smoke: no env → header only, no usage row
#   5. smoke: minimax host → "MiniMax ─" line (token is fake, but pipeline must not crash)
#   6. smoke: kimi host  → "Kimi ─" line (no creds, missing → fallback)
#
# Exits non-zero on any failure. Designed for human dev-loop use; not
# required to pass on machines without network access to the providers.

set -euo pipefail
cd "$(dirname "$0")/.."

red()   { printf '\033[31m%s\033[0m\n' "$*"; }
green() { printf '\033[32m%s\033[0m\n' "$*"; }
hdr()   { printf '\n\033[1;34m▶ %s\033[0m\n' "$*"; }

hdr "1/6  tsc --noEmit"
npx tsc --noEmit && green "  ✓ typecheck clean"

hdr "2/6  npm run build"
npm run build >/dev/null && green "  ✓ dist/ built"

hdr "3/6  npm test (tsc + node --test)"
npm test 2>&1 | tail -20 && green "  ✓ tests pass"

hdr "4/6  smoke: no env → header only, no usage row"
unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN CLAUDE_CONFIG_DIR
out=$(echo '{}' | node dist/index.js 2>/dev/null || true)
echo "$out"
echo "$out" | grep -q 'Project' || { red "  ✗ Project header missing"; exit 1; }
echo "$out" | grep -qE 'MiniMax|Kimi|Bailian|MiMo|Volcengine|Zhipu' && { red "  ✗ unexpected usage row emitted"; exit 1; } || green "  ✓ no usage row on unknown host"

hdr "4b/6  smoke: unrecognised host → silent + explanatory log, no usage row"
out=$(env -i HOME="$HOME" PATH="$PATH" \
      ANTHROPIC_BASE_URL='https://api.anthropic.com' \
      CLAUDE_CONFIG_DIR="$(mktemp -d)" \
      node dist/index.js <<< '{}' 2>&1 || true)
echo "$out"
echo "$out" | grep -q 'Project' || { red "  ✗ Project header missing"; exit 1; }
echo "$out" | grep -qE 'Unrecognised ANTHROPIC_BASE_URL' || { red "  ✗ expected unrecognised-host log line"; exit 1; }
echo "$out" | grep -qE '5h|Minimax|Kimi|Bailian|MiMo|Volcengine|Zhipu' && { red "  ✗ usage row emitted on unrecognised host"; exit 1; } || green "  ✓ usage row hidden, log explains why"

hdr "4c/6  smoke: unrecognised host without trailing slash / path → still hidden"
out=$(env -i HOME="$HOME" PATH="$PATH" \
      ANTHROPIC_BASE_URL='https://llm-proxy.example.com' \
      CLAUDE_CONFIG_DIR="$(mktemp -d)" \
      node dist/index.js <<< '{}' 2>&1 || true)
echo "$out"
echo "$out" | grep -q 'Project' || { red "  ✗ Project header missing"; exit 1; }
echo "$out" | grep -qE 'Unrecognised ANTHROPIC_BASE_URL' || { red "  ✗ expected unrecognised-host log line"; exit 1; }
echo "$out" | grep -qE '5h|MiniMax|Kimi|Bailian|MiMo|Volcengine|Zhipu' && { red "  ✗ usage row emitted on private relay host"; exit 1; } || green "  ✓ private relay host is hidden"

hdr "4d/6  smoke: unrecognised host similar to known (e.g. kimi.com.evil.tld) → hidden"
out=$(env -i HOME="$HOME" PATH="$PATH" \
      ANTHROPIC_BASE_URL='https://kimi.com.evil.tld/coding' \
      CLAUDE_CONFIG_DIR="$(mktemp -d)" \
      node dist/index.js <<< '{}' 2>&1 || true)
echo "$out"
echo "$out" | grep -qE 'Unrecognised ANTHROPIC_BASE_URL' || { red "  ✗ expected unrecognised-host log line"; exit 1; }
echo "$out" | grep -qE '5h|Kimi' && { red "  ✗ lookalike host bypassed Kimi detector"; exit 1; } || green "  ✓ lookalike host blocked"

hdr "5/6  smoke: minimax host → provider picked, no crash, missing key path"
out=$(env -i HOME="$HOME" PATH="$PATH" \
      ANTHROPIC_BASE_URL='https://www.minimaxi.com/anthropic' \
      CLAUDE_CONFIG_DIR="$(mktemp -d)" \
      node dist/index.js <<< '{}' 2>&1 || true)
echo "$out"
# With no API key the provider logs an error and returns null; the HUD
# must render the project header but no usage row, and must NOT crash.
echo "$out" | grep -q 'Project' || { red "  ✗ Project header missing"; exit 1; }
echo "$out" | grep -qE 'API key|No API key' || { red "  ✗ expected missing-key log line"; exit 1; }
echo "$out" | grep -qE '5h' && { red "  ✗ usage row emitted despite missing key"; exit 1; } || green "  ✓ no usage row when key missing (graceful fallback)"

hdr "5b/6  smoke: minimax host + fake key → API error path, graceful fallback"
out=$(env -i HOME="$HOME" PATH="$PATH" \
      ANTHROPIC_BASE_URL='https://www.minimaxi.com/anthropic' \
      ANTHROPIC_AUTH_TOKEN='fake-key-for-shape-test' \
      CLAUDE_CONFIG_DIR="$(mktemp -d)" \
      node dist/index.js <<< '{}' 2>&1 || true)
echo "$out"
echo "$out" | grep -q 'Project' || { red "  ✗ Project header missing"; exit 1; }
echo "$out" | grep -qE 'API error|login fail' || { red "  ✗ expected API error log line"; exit 1; }
green "  ✓ MiniMax provider reached the network and degraded gracefully"

hdr "6/6  smoke: kimi host → Kimi row visible, no creds → fallback"
out=$(env -i HOME="$HOME" PATH="$PATH" \
      ANTHROPIC_BASE_URL='https://api.kimi.com/coding' \
      CLAUDE_CONFIG_DIR="$(mktemp -d)" \
      node dist/index.js <<< '{}' 2>&1 || true)
echo "$out"
echo "$out" | grep -qE 'Kimi' || { red "  ✗ Kimi row missing"; exit 1; }
green "  ✓ Kimi row rendered (no creds → fallback placeholder)"

green "\nAll verification steps passed."
