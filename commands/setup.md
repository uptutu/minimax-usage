# minimax-usage setup

This plugin automatically reads the `ANTHROPIC_AUTH_TOKEN` environment variable to authenticate with the MiniMax API.

## Installation Steps

1. Build the plugin:
   ```bash
   npm run build
   ```

2. Install the plugin in Claude Code:
   ```
   /plugin install minimax-usage
   ```

3. During installation, if you already have another statusLine plugin configured, you'll be prompted to overwrite it. Choose `Yes` to replace it with minimax-usage.

4. Reload plugins to apply changes:
   ```
   /reload-plugins
   ```

## StatusLine Conflict

If you already have another HUD/statusLine plugin installed, you can manually configure the statusLine in `~/.claude/settings.json`:

```json
"statusLine": {
  "type": "command",
  "command": "bash -c 'plugin_dir=$(ls -d \"${CLAUDE_CONFIG_DIR:-$HOME/.claude}\"/plugins/cache/minimax-usage/minimax-usage/*/ 2>/dev/null | awk -F/ '{print $(NF-1) \"\\t\" $(0)}' | sort -t. -k1,1n -k2,2n -k3,3n -k4,4n | tail -1 | cut -f2-); exec \"/home/lo/.nvm/versions/node/v24.4.1/bin/node\" \"${plugin_dir}dist/index.js\"'"
}
```

Note: Claude Code's `statusLine.command` only supports **one** command. You cannot combine multiple HUD plugins using pipe (`|`).

## Configuration

You can optionally create a config file at `~/.claude/plugins/minimax-usage/config.json`:

```json
{
  "refreshIntervalMs": 60000
}
```

The default refresh interval is 60 seconds.