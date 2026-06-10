import { fetchTokenPlan } from './api.js';
import { getCached, setCached } from './cache.js';
import { isMinimaxEndpoint } from './config.js';
import { deriveContextUsage } from './context.js';
import { render } from './render.js';
const CACHE_KEY = 'token-plan';
async function main() {
    // Read stdin from Claude Code
    let stdinData = {};
    try {
        const stdin = await readStdin();
        if (stdin) {
            stdinData = JSON.parse(stdin);
        }
    }
    catch {
        // Ignore stdin errors
    }
    const resolved = resolveContextUsage(stdinData);
    // Only fetch and cache the MiniMax quota when the active session is
    // actually pointed at a MiniMax endpoint. For third-party hosts, skip
    // the network call and cache I/O entirely — the HUD will simply not
    // render the MiniMax line.
    const isMinimax = isMinimaxEndpoint();
    let data = null;
    if (isMinimax) {
        const cached = getCached(CACHE_KEY);
        if (cached) {
            render(cached, resolved, isMinimax);
            return;
        }
        data = await fetchTokenPlan();
        if (data) {
            setCached(CACHE_KEY, data);
        }
    }
    render(data, resolved, isMinimax);
}
/**
 * Resolve the context-used percentage with a fallback chain:
 *   1. stdin.context_window.used_percentage  — most accurate, from Claude Code
 *   2. stdin.context_window.current_usage    — computed from token counts
 *   3. transcript_path JSONL                  — parsed locally when stdin lacks it
 *
 * Returns a new StdinData with `context_window.used_percentage` populated
 * when resolvable, or left null when it isn't — render() treats null as
 * "no data, hide the line".
 */
function resolveContextUsage(stdinData) {
    const cw = stdinData.context_window;
    let usedPct = null;
    if (cw) {
        if (typeof cw.used_percentage === 'number'
            && Number.isFinite(cw.used_percentage)) {
            usedPct = cw.used_percentage;
        }
        else if (cw.current_usage) {
            const u = cw.current_usage;
            const total = (u.input_tokens ?? 0) +
                (u.cache_creation_input_tokens ?? 0) +
                (u.cache_read_input_tokens ?? 0);
            if (typeof cw.context_window_size === 'number'
                && cw.context_window_size > 0) {
                usedPct = (total / cw.context_window_size) * 100;
            }
        }
    }
    if (usedPct === null) {
        const transcriptPath = stdinData.transcript_path ?? null;
        if (transcriptPath) {
            // Fall back to a sensible default window size when `context_window`
            // is missing from stdin (some Claude Code versions / first-turn
            // states omit it). 200k is the most common Sonnet/Opus window;
            // models with larger windows will still report via path 1 above.
            const windowSize = cw?.context_window_size ?? 200_000;
            if (windowSize > 0) {
                // transcript may exist but contain no usage yet (fresh session,
                // or a session whose prior turns were all tool/error events).
                // Treat "no usage block found" as 0 tokens rather than hiding
                // the line — a 0% reading is strictly more informative than
                // nothing.
                const usage = deriveContextUsage(transcriptPath);
                const totalTokens = usage?.totalTokens ?? 0;
                usedPct = (totalTokens / windowSize) * 100;
            }
        }
    }
    return {
        ...stdinData,
        context_window: {
            ...(cw ?? {}),
            used_percentage: usedPct,
        },
    };
}
function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
    });
}
// Run main function
void main();
