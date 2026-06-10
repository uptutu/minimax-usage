import * as fs from 'node:fs';

export interface ContextUsage {
  /** Sum of `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`
   *  from the most recent assistant `message_start` event in the transcript.
   *  This equals the total context window occupancy for that turn. */
  totalTokens: number;
}

/**
 * Derive current context usage from a Claude Code session transcript.
 *
 * The transcript is a JSONL file. Each `assistant` entry (Claude Code's
 * wrapped form) carries a `message.usage` block whose
 * `input_tokens + cache_creation_input_tokens + cache_read_input_tokens`
 * equals the current context size for that turn (system prompt + full
 * conversation + tool results, with the cache-aware breakdown).
 *
 * We keep the latest such usage we see, which represents the most recent
 * assistant turn — i.e. the current context state. Note: Claude Code can
 * dual-log the same API response 2-3 times in a row, but since we take the
 * LAST entry (not the sum), this is harmless.
 *
 * Returns null when the file is missing, unreadable, has no assistant
 * entries with usage yet (fresh session), or the latest usage is all zeros.
 */
export function deriveContextUsage(
  transcriptPath: string | null | undefined
): ContextUsage | null {
  if (!transcriptPath) return null;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(transcriptPath);
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.size === 0) return null;

  let content: string;
  try {
    content = fs.readFileSync(transcriptPath, 'utf-8');
  } catch {
    return null;
  }

  type UsageShape = {
    input_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };

  let lastUsage: UsageShape | null = null;

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let entry: any;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      continue;
    }

    // Claude Code transcripts use `type: "assistant"`. Some legacy/raw-API
    // transcripts use `type: "message_start"`. Both carry a `usage` block
    // on the message object.
    if (
      (entry?.type === 'assistant' || entry?.type === 'message_start')
      && entry?.message?.usage
    ) {
      lastUsage = entry.message.usage as UsageShape;
    }
  }

  if (!lastUsage) return null;

  const input = lastUsage.input_tokens ?? 0;
  const create = lastUsage.cache_creation_input_tokens ?? 0;
  const read = lastUsage.cache_read_input_tokens ?? 0;
  const total = input + create + read;

  return total > 0 ? { totalTokens: total } : null;
}
