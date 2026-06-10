import * as fs from 'node:fs';
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
export function deriveContextUsage(transcriptPath) {
    if (!transcriptPath)
        return null;
    let stat;
    try {
        stat = fs.statSync(transcriptPath);
    }
    catch {
        return null;
    }
    if (!stat.isFile() || stat.size === 0)
        return null;
    let content;
    try {
        content = fs.readFileSync(transcriptPath, 'utf-8');
    }
    catch {
        return null;
    }
    let lastUsage = null;
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed)
            continue;
        let entry;
        try {
            entry = JSON.parse(trimmed);
        }
        catch {
            continue;
        }
        // Claude Code transcripts use `type: "assistant"`. Some legacy/raw-API
        // transcripts use `type: "message_start"`. Both carry a `usage` block
        // on the message object.
        //
        // Skip API-error placeholder entries: when an API call fails, Claude
        // Code logs a synthetic `assistant` event with `isApiErrorMessage: true`
        // and a non-empty `error` field, carrying all-zero usage. Treating that
        // as the "most recent" usage would clobber a valid prior reading and
        // make `Context` disappear.
        if (entry?.isApiErrorMessage === true)
            continue;
        if (typeof entry?.error === 'string' && entry.error.length > 0)
            continue;
        if ((entry?.type === 'assistant' || entry?.type === 'message_start')
            && entry?.message?.usage) {
            lastUsage = entry.message.usage;
        }
    }
    if (!lastUsage)
        return null;
    const input = lastUsage.input_tokens ?? 0;
    const create = lastUsage.cache_creation_input_tokens ?? 0;
    const read = lastUsage.cache_read_input_tokens ?? 0;
    return { totalTokens: input + create + read };
}
