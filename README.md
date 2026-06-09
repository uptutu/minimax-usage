# minimax-usage

Display MiniMax token plan remaining usage in Claude Code HUD.

Shows your MiniMax API token usage limits directly in the Claude Code status bar, including:
- **5-hour interval** usage with total quota
- **7-day weekly** usage with total quota (including boost)
- **Color-coded** progress bars (green > 50%, yellow 20-50%, red < 20%)

## Output Format

```
Context │ ctx ██░░░░░░░░ 15%
MiniMax │ 5h  █░░░░░░░░░ 3% (100%) ⟳ 3h59m │ 7d █░░░░░░░░░ 6% (150%) ⟳ 5d22h
```

- `Context` - Current context window usage (when available)
- `5h` - Five-hour usage window (base 100% quota)
- `7d` - Seven-day weekly window (may include boost, e.g., 150%)
- Progress bar shows usage with color coding
- Percentages shown: used% (total%)
- Reset time with `⟳` symbol (format: `XdXh` or `XhXm`)

## Features

- **Usage-based display**: Shows consumed percentage, remaining shown as dim
- **Color-coded bars**: Green (>50% remaining), Yellow (20-50%), Red (<20%)
- **Boost support**: Accounts for quota boosts (e.g., 150% total quota)
- **Total quota display**: Shows both used amount and total quota for each interval
- **Reset countdown**: Shows time remaining until 5h and 7d quota reset with `⟳` symbol
- **Context tracking**: Displays context window compression progress
- **Minimum bar display**: Always shows at least 1 block for low usage values

## Requirements

- Node.js 18+ or Bun
- Claude Code with HUD support

## Installation

```bash
# Install via marketplace
/plugin marketplace add PureLo/minimax-usage
/plugin install minimax-usage@minimax-plugins

# Or install directly
/plugin install PureLo/minimax-usage
```

## StatusLine Conflict

Claude Code's `statusLine.command` only supports **one** command. If you already have another statusline plugin configured, you have two options:

**Option 1: Use pipe to combine commands**
```bash
# Edit ~/.claude/settings.json manually
"statusLine": {
  "command": "other-plugin | minimax-usage"
}
```

**Option 2: Choose one plugin**
Replace the existing statusline with `minimax-usage` if MiniMax usage is your priority.

## Configuration

The plugin automatically reads the `ANTHROPIC_AUTH_TOKEN` environment variable for authentication. No additional configuration needed if Claude Code is already configured with your MiniMax API key.

## API Data

The plugin calls MiniMax API endpoint:

```
GET https://www.minimaxi.com/v1/token_plan/remains
Authorization: Bearer <API_KEY>
```

Response fields used:
- `current_interval_remaining_percent` - 5-hour window remaining percentage
- `current_weekly_remaining_percent` - 7-day window remaining percentage
- `weekly_boost_permille` - Boost amount (e.g., 1500 = 150% quota)

## Project Structure

```
minimax-usage/
├── .claude-plugin/
│   ├── plugin.json          # Plugin manifest
│   └── marketplace.json     # Marketplace definition
├── src/
│   ├── index.ts           # Entry point
│   ├── api.ts             # MiniMax API calls
│   ├── config.ts          # Config loading
│   ├── types.ts           # TypeScript interfaces
│   └── render.ts          # Output formatting with color support
├── commands/
│   └── setup.md           # Setup instructions
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

**No output displayed?**
- Verify `ANTHROPIC_AUTH_TOKEN` environment variable is set
- Check Claude Code status bar is enabled
- Try `/reload-plugins` or restart Claude Code

**API errors?**
- Ensure your API key has access to the token plan API
- Check network connectivity to `www.minimaxi.com`

## License

MIT