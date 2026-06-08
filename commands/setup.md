# minimax-usage setup

This plugin automatically reads the `ANTHROPIC_AUTH_TOKEN` environment variable to authenticate with the MiniMax API.

## Setup Steps

1. Build the plugin:
   ```bash
   npm run build
   ```

2. Install the plugin in Claude Code:
   ```
   /plugin install minimax-usage
   ```

3. The plugin will automatically register itself in your `settings.json` and start displaying token usage.

## Configuration

You can optionally create a config file at `~/.claude/plugins/minimax-usage/config.json`:

```json
{
  "refreshIntervalMs": 60000
}
```

The default refresh interval is 60 seconds.