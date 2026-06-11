import { selectProvider } from './provider/index.js';
import { getCached, setCached } from './cache.js';
import { deriveContextUsage } from './context.js';
import { renderProvider, render } from './render.js';
import type { StdinData } from './types.js';
import type { NormalizedUsage } from './provider/types.js';

async function main(): Promise<void> {
  let stdinData: StdinData = {};
  try {
    const stdin = await readStdin();
    if (stdin) stdinData = JSON.parse(stdin) as StdinData;
  } catch {
    // Ignore stdin errors — fallback headers are still safe to render.
  }

  const resolved = resolveContextUsage(stdinData);

  const provider = selectProvider();
  if (!provider) {
    // No recognised endpoint: render header only (no usage row).
    renderProvider(null, resolved);
    return;
  }

  const cacheKey = `usage:${provider.id}`;
  const cached = getCached<NormalizedUsage>(cacheKey);
  if (cached) {
    renderProvider(cached, resolved);
    return;
  }

  let data: NormalizedUsage | null = null;
  try {
    data = await provider.fetch();
  } catch (e) {
    console.error(`[minimax-usage] ${provider.id} fetch threw:`, (e as Error).message);
  }
  if (data) setCached(cacheKey, data);
  renderProvider(data, resolved);
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
function resolveContextUsage(stdinData: StdinData): StdinData {
  const cw = stdinData.context_window;
  let usedPct: number | null = null;

  if (cw) {
    if (
      typeof cw.used_percentage === 'number'
      && Number.isFinite(cw.used_percentage)
    ) {
      usedPct = cw.used_percentage;
    } else if (cw.current_usage) {
      const u = cw.current_usage;
      const total =
        (u.input_tokens ?? 0) +
        (u.cache_creation_input_tokens ?? 0) +
        (u.cache_read_input_tokens ?? 0);
      if (
        typeof cw.context_window_size === 'number'
        && cw.context_window_size > 0
      ) {
        usedPct = (total / cw.context_window_size) * 100;
      }
    }
  }

  if (usedPct === null) {
    const transcriptPath = stdinData.transcript_path ?? null;
    if (transcriptPath) {
      const windowSize = cw?.context_window_size ?? 200_000;
      if (windowSize > 0) {
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

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

// Re-export the legacy `render` so any external consumer that still imports
// it from `./index.js` keeps working.
export { render };

void main();
