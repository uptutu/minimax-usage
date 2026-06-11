import type { Provider } from './types.js';
import { minimaxProvider } from './minimax.js';
import { kimiProvider } from './kimi.js';
import { bailianProvider } from './bailian.js';
import { mimoProvider } from './mimo.js';
import { volcengineProvider } from './volcengine.js';
import { zhipuProvider } from './zhipu.js';

/**
 * Order-sensitive registry — the first provider whose `matches()` returns
 * `true` wins. MiniMax must precede Kimi (and the rest) for historical
 * compatibility, even though their host namespaces don't currently overlap.
 */
const REGISTRY: readonly Provider[] = [
  minimaxProvider,
  kimiProvider,
  bailianProvider,
  mimoProvider,
  volcengineProvider,
  zhipuProvider,
];

/**
 * Pick the provider that should service the active Claude Code session,
 * based on `ANTHROPIC_BASE_URL`. Returns `null` when the endpoint is not
 * recognised — renderers fall back to the header-only HUD line in that case.
 */
export function selectProvider(): Provider | null {
  return REGISTRY.find(p => p.matches()) ?? null;
}
