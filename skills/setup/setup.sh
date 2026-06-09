#!/usr/bin/env bash
set -euo pipefail

PLUGIN_NAME="minimax-usage"
NO_OVERWRITE=0
PLUGIN_ROOT_ARG=""

info() {
  printf '[%s] %s\n' "$PLUGIN_NAME" "$*"
}

error() {
  printf '[%s] %s\n' "$PLUGIN_NAME" "$*" >&2
}

usage() {
  printf 'Usage: %s [--no-overwrite] [plugin-root]\n' "$0"
}

shell_quote() {
  printf "'"
  printf '%s' "$1" | sed "s/'/'\\\\''/g"
  printf "'"
}

resolve_runtime() {
  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  if command -v bun >/dev/null 2>&1; then
    command -v bun
    return 0
  fi

  return 1
}

for arg in "$@"; do
  case "$arg" in
    --no-overwrite)
      NO_OVERWRITE=1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ -n "$PLUGIN_ROOT_ARG" ]; then
        error "Unexpected argument: $arg"
        usage >&2
        exit 64
      fi
      PLUGIN_ROOT_ARG="$arg"
      ;;
  esac
done

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if [ -n "$PLUGIN_ROOT_ARG" ]; then
  PLUGIN_ROOT="$(cd -- "$PLUGIN_ROOT_ARG" && pwd -P)"
elif [ -f "$SCRIPT_DIR/../../dist/index.js" ]; then
  PLUGIN_ROOT="$(cd -- "$SCRIPT_DIR/../.." && pwd -P)"
else
  PLUGIN_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
fi

if [ ! -f "$PLUGIN_ROOT/dist/index.js" ]; then
  error "Built entrypoint not found: $PLUGIN_ROOT/dist/index.js"
  error "Run npm install && npm run build before installing this plugin."
  exit 1
fi

if [ -n "${CLAUDE_CONFIG_DIR:-}" ]; then
  CONFIG_DIR="$CLAUDE_CONFIG_DIR"
else
  CONFIG_DIR="${HOME:?HOME is not set}/.claude"
fi

RUNTIME="$(resolve_runtime || true)"
if [ -z "$RUNTIME" ]; then
  error "Node.js 18+ or Bun is required, but neither node nor bun was found in PATH."
  exit 1
fi

if [ "$(basename "$RUNTIME")" = "node" ]; then
  if ! "$RUNTIME" -e 'const major = Number(process.versions.node.split(".")[0]); process.exit(major >= 18 ? 0 : 1);'; then
    error "Node.js 18+ is required for this plugin."
    exit 1
  fi
fi

PLUGIN_CONFIG_DIR="$CONFIG_DIR/plugins/$PLUGIN_NAME"
WRAPPER_FILE="$PLUGIN_CONFIG_DIR/statusline.sh"
BACKUP_FILE="$PLUGIN_CONFIG_DIR/statusline.backup.json"
SETTINGS_FILE="$CONFIG_DIR/settings.json"

mkdir -p "$CONFIG_DIR" "$PLUGIN_CONFIG_DIR"

if [ ! -f "$SETTINGS_FILE" ] || [ ! -s "$SETTINGS_FILE" ]; then
  printf '{}\n' > "$SETTINGS_FILE"
fi

{
  printf '#!/usr/bin/env bash\n'
  printf 'set -euo pipefail\n'
  printf 'PLUGIN_NAME=%s\n' "$(shell_quote "$PLUGIN_NAME")"
  printf 'FALLBACK_PLUGIN_ROOT=%s\n' "$(shell_quote "$PLUGIN_ROOT")"
  cat <<'EOF'

resolve_runtime() {
  if [ -n "${MINIMAX_USAGE_RUNTIME:-}" ]; then
    if [ -x "$MINIMAX_USAGE_RUNTIME" ]; then
      printf '%s\n' "$MINIMAX_USAGE_RUNTIME"
      return 0
    fi

    if command -v "$MINIMAX_USAGE_RUNTIME" >/dev/null 2>&1; then
      command -v "$MINIMAX_USAGE_RUNTIME"
      return 0
    fi
  fi

  if command -v node >/dev/null 2>&1; then
    command -v node
    return 0
  fi

  if command -v bun >/dev/null 2>&1; then
    command -v bun
    return 0
  fi

  return 1
}

RUNTIME="$(resolve_runtime || true)"
if [ -z "$RUNTIME" ]; then
  printf 'MiniMax -\n'
  exit 0
fi

PLUGIN_ENTRY="$(
  MINIMAX_USAGE_FALLBACK_PLUGIN_ROOT="$FALLBACK_PLUGIN_ROOT" "$RUNTIME" -e '
const fs = require("fs");
const path = require("path");

const pluginName = "minimax-usage";
const configDir = process.env.CLAUDE_CONFIG_DIR || path.join(process.env.HOME || "", ".claude");
const candidates = [];

function safeList(dir) {
  try {
    return fs.readdirSync(dir);
  } catch {
    return [];
  }
}

function addRoot(root) {
  if (!root) return;

  const file = path.join(root, "dist", "index.js");
  if (!fs.existsSync(file)) return;

  let version = "0.0.0";
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, ".claude-plugin", "plugin.json"), "utf8"));
    if (typeof manifest.version === "string") version = manifest.version;
  } catch {}

  let mtime = 0;
  try {
    mtime = fs.statSync(file).mtimeMs;
  } catch {}

  candidates.push({ file, version, mtime });
}

function semver(value) {
  const match = String(value).match(/^(\\d+)\\.(\\d+)\\.(\\d+)(?:[-+].*)?$/);
  return match ? match.slice(1, 4).map(Number) : null;
}

function compareCandidates(left, right) {
  const leftVersion = semver(left.version);
  const rightVersion = semver(right.version);

  if (leftVersion && rightVersion) {
    for (let index = 0; index < 3; index += 1) {
      if (leftVersion[index] !== rightVersion[index]) {
        return leftVersion[index] - rightVersion[index];
      }
    }
  }

  return left.mtime - right.mtime;
}

addRoot(process.env.MINIMAX_USAGE_FALLBACK_PLUGIN_ROOT);

const cacheDir = path.join(configDir, "plugins", "cache");
for (const marketplace of safeList(cacheDir)) {
  const pluginDir = path.join(cacheDir, marketplace, pluginName);
  for (const version of safeList(pluginDir)) {
    addRoot(path.join(pluginDir, version));
  }
}

candidates.sort(compareCandidates);
process.stdout.write(candidates.length > 0 ? candidates[candidates.length - 1].file : "");
'
)"

if [ -z "$PLUGIN_ENTRY" ]; then
  printf 'MiniMax -\n'
  exit 0
fi

exec "$RUNTIME" "$PLUGIN_ENTRY"
EOF
} > "$WRAPPER_FILE"

chmod +x "$WRAPPER_FILE"

STATUSLINE_COMMAND="bash $(shell_quote "$WRAPPER_FILE")"

SETTINGS_FILE="$SETTINGS_FILE" \
STATUSLINE_COMMAND="$STATUSLINE_COMMAND" \
BACKUP_FILE="$BACKUP_FILE" \
NO_OVERWRITE="$NO_OVERWRITE" \
"$RUNTIME" -e '
const fs = require("fs");

const settingsFile = process.env.SETTINGS_FILE;
const statusLineCommand = process.env.STATUSLINE_COMMAND;
const backupFile = process.env.BACKUP_FILE;
const noOverwrite = process.env.NO_OVERWRITE === "1";

let settings = {};
try {
  const raw = fs.readFileSync(settingsFile, "utf8");
  settings = raw.trim() ? JSON.parse(raw) : {};
} catch (error) {
  console.error(`[minimax-usage] Failed to read ${settingsFile}: ${error.message}`);
  process.exit(1);
}

const existing = settings.statusLine;
const existingCommand = existing && typeof existing.command === "string" ? existing.command : "";
const alreadyConfigured = existingCommand.includes("minimax-usage/statusline.sh");

if (existing && !alreadyConfigured && noOverwrite) {
  console.log("[minimax-usage] statusLine already configured:");
  console.log(JSON.stringify(existing, null, 2));
  process.exit(3);
}

if (existing && !alreadyConfigured) {
  fs.writeFileSync(backupFile, `${JSON.stringify(existing, null, 2)}\n`);
  console.log(`[minimax-usage] Existing statusLine saved to ${backupFile}`);
}

settings.statusLine = {
  type: "command",
  command: statusLineCommand,
  refreshInterval: 60
};

fs.writeFileSync(settingsFile, `${JSON.stringify(settings, null, 2)}\n`);
console.log(`[minimax-usage] statusLine configured in ${settingsFile}`);
'

info "Status line wrapper installed at $WRAPPER_FILE"
info "Run /reload-plugins or restart Claude Code to apply plugin changes."
