import type { MiniMaxConfig } from './types.js';
declare function getConfigDir(): string;
export declare function loadConfig(): MiniMaxConfig;
export declare function getApiKey(): string | null;
/**
 * Detect whether the active Claude Code session is pointed at a MiniMax
 * endpoint. Reads `ANTHROPIC_BASE_URL` and matches its hostname against
 * MiniMax's known domains (`minimaxi.com`, `minimax.com`).
 *
 * Returns `false` when the env var is unset, malformed, or points at any
 * other host. The MiniMax HUD line should be hidden in those cases — both
 * the network call and the rendered line are gated on this.
 */
export declare function isMinimaxEndpoint(): boolean;
export { getConfigDir };
