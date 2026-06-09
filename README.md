# minimax-usage

Display MiniMax token plan remaining usage in Claude Code HUD.

Shows your MiniMax API token usage limits directly in the Claude Code status bar, including:
- **Current model** used by Claude Code
- **5-hour interval** usage with total quota
- **7-day weekly** usage with total quota (including boost)
- **Color-coded** progress bars (green > 50%, yellow 20-50%, red < 20%)

## Output Format

```
Model   │ MiniMax-M3
Context │ ctx ██░░░░░░░░ 15%
MiniMax │ 5h  █░░░░░░░░░ 3% (100%) ⟳ 3h59m │ 7d █░░░░░░░░░ 6% (150%) ⟳ 5d22h
```

- `Model` - Current Claude Code model display name (when available)
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
- **Model display**: Shows the active Claude Code model from status line input
- **Context tracking**: Displays context window compression progress
- **Minimum bar display**: Always shows at least 1 block for low usage values

## Requirements

- Node.js 18+ or Bun
- Claude Code with HUD support

## Installation

```bash
# Add the GitHub-hosted marketplace, then install the plugin
/plugin marketplace add PureLo/minimax-usage
/plugin install minimax-usage@minimax-plugins
```

## Setup

After installation, run the automated setup:

```
/minimax-usage:setup
```

This will:
1. Configure `${CLAUDE_CONFIG_DIR:-~/.claude}/settings.json`
2. Install a portable status line wrapper under `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/`
3. Back up an existing status line to `statusline.backup.json` before replacing it
4. Guide you to reload plugins

To inspect an existing status line without replacing it:

```
/minimax-usage:setup --no-overwrite
```

## StatusLine Conflict

Claude Code's `statusLine.command` only supports **one** command. If you already have another statusline plugin configured:

**Choose one plugin**
Replace the existing statusline with `minimax-usage` if MiniMax usage is your priority.

Note: Pipe (`|`) does not work for combining HUD plugins because they are long-running commands that continuously output.

## Configuration

The status line reads the `ANTHROPIC_AUTH_TOKEN` environment variable for MiniMax API authentication. Make sure this variable is exported in the environment that launches Claude Code.

You can optionally create a config file at `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/config.json`:

```json
{
  "refreshIntervalMs": 60000
}
```

The default API cache refresh interval is 60 seconds.

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
├── skills/
│   └── setup/
│       ├── SKILL.md      # /minimax-usage:setup command
│       └── setup.sh      # Automated setup script
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

**No output displayed?**
- Verify `ANTHROPIC_AUTH_TOKEN` environment variable is set
- Verify Node.js 18+ or Bun is available in Claude Code's PATH
- Check Claude Code status bar is enabled
- Try `/reload-plugins` or restart Claude Code

**API errors?**
- Ensure your API key has access to the token plan API
- Check network connectivity to `www.minimaxi.com`

## License

MIT
