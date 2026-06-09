---
description: Configure the Claude Code status line to display MiniMax usage.
disable-model-invocation: true
argument-hint: "[--no-overwrite]"
---

Run the bundled setup script for this plugin:

```bash
"${CLAUDE_SKILL_DIR}/setup.sh" $ARGUMENTS
```

Report whether the status line was configured successfully. If the script reports that another status line already exists, show the existing command and tell the user to rerun `/minimax-usage:setup` without `--no-overwrite` to replace it.
