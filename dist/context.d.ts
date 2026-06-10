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
 * Returns null when the file is missing, unreadable, or has no assistant
 * entries with usage yet (fresh session). When a usage block is found,
 * the resulting total — including 0 — is returned so the caller can
 * display `0%` rather than hiding the line.
 */
export declare function deriveContextUsage(transcriptPath: string | null | undefined): ContextUsage | null;
