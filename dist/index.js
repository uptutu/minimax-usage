import { fetchTokenPlan } from './api.js';
import { getCached, setCached } from './cache.js';
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
    const cached = getCached(CACHE_KEY);
    if (cached) {
        render(cached, resolved);
        return;
    }
    const data = await fetchTokenPlan();
    if (data) {
        setCached(CACHE_KEY, data);
    }
    render(data, resolved);
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
            if (total > 0
                && typeof cw.context_window_size === 'number'
                && cw.context_window_size > 0) {
                usedPct = (total / cw.context_window_size) * 100;
            }
        }
    }
    if (usedPct === null) {
        const usage = deriveContextUsage(stdinData.transcript_path ?? null);
        const windowSize = cw?.context_window_size;
        if (usage
            && typeof windowSize === 'number'
            && windowSize > 0) {
            usedPct = (usage.totalTokens / windowSize) * 100;
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
