#!/bin/bash

SETTINGS_FILE="$HOME/.claude/settings.json"
STATUSLINE_CMD="bash -c 'plugin_dir=\$(ls -d \"\${CLAUDE_CONFIG_DIR:-\$HOME/.claude}\"/plugins/cache/minimax-usage/minimax-usage/*/ 2>/dev/null | awk -F/ '\''{print \$(NF-1) \"\\t\" \$(0)}'\'' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-); exec \"/home/lo/.nvm/versions/node/v24.4.1/bin/node\" \"\${plugin_dir}dist/index.js\"'"

# Check if settings.json exists
if [ ! -f "$SETTINGS_FILE" ]; then
  echo "[minimax-usage] settings.json not found at $SETTINGS_FILE"
  exit 1
fi

# Check if statusLine already exists
if grep -q '"statusLine"' "$SETTINGS_FILE"; then
  echo "[minimax-usage] statusLine already configured"
  echo "Current configuration:"
  grep -A2 '"statusLine"' "$SETTINGS_FILE"
  echo ""
  read -p "Overwrite existing statusLine? (y/N): " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    echo "[minimax-usage] Setup cancelled"
    exit 0
  fi
fi

# Update settings.json
node -e "
const fs = require('fs');
const settings = JSON.parse(fs.readFileSync('$SETTINGS_FILE', 'utf8'));
settings.statusLine = {
  type: 'command',
  command: '$STATUSLINE_CMD'
};
fs.writeFileSync('$SETTINGS_FILE', JSON.stringify(settings, null, 2));
console.log('[minimax-usage] statusLine configured successfully');
"