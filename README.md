# minimax-usage

Display MiniMax token plan remaining usage in Claude Code HUD.

Shows your MiniMax API token usage limits directly in the Claude Code status bar, including:
- **5-hour interval** usage percentage
- **7-day weekly** usage percentage

## Output Format

```
MiniMax │ 5h ██████████ 97% │ 7d ██████████ 96%
```

- `5h` - Five-hour usage window
- `7d` - Seven-day weekly window
- Progress bar shows remaining percentage (█ = filled, ░ = empty)

## Requirements

- Node.js 18+ or Bun
- Claude Code with HUD support

## Installation

```bash
# Build the plugin
npm install
npm run build

# Install via Claude Code command
/plugin install minimax-usage
```

Or manually copy to your Claude plugins directory:

```bash
cp -r . ~/.claude/plugins/cache/minimax-usage/
```

## Configuration

The plugin automatically reads the `ANTHROPIC_AUTH_TOKEN` environment variable for authentication. No additional configuration needed if Claude Code is already configured with your MiniMax API key.

### Optional Config File

Create `~/.claude/plugins/minimax-usage/config.json` to customize:

```json
{
  "refreshIntervalMs": 60000
}
```

- `refreshIntervalMs` - How often to fetch new data (default: 60000ms / 60 seconds)

## API Data

The plugin calls MiniMax API endpoint:

```
GET https://www.minimaxi.com/v1/token_plan/remains
Authorization: Bearer <API_KEY>
```

Response fields used:
- `current_interval_remaining_percent` - 5-hour window remaining percentage
- `current_weekly_remaining_percent` - 7-day window remaining percentage

## Project Structure

```
minimax-usage/
├── .claude-plugin/
│   └── plugin.json          # Plugin manifest
├── src/
│   ├── index.ts           # Entry point (called every ~300ms by Claude Code)
│   ├── api.ts # MiniMax API calls
│   ├── cache.ts           # In-memory caching (60s TTL)
│   ├── config.ts          # Config loading
│   ├── types.ts           # TypeScript interfaces
│   └── render.ts # Output formatting
├── commands/
│   └── setup.md          # Setup instructions
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

**No output displayed?**
- Verify `ANTHROPIC_AUTH_TOKEN` environment variable is set
- Check Claude Code status bar is enabled
- Try restarting Claude Code

**API errors?**
- Ensure your API key has access to the token plan API
- Check network connectivity to `www.minimaxi.com`

## License

MIT