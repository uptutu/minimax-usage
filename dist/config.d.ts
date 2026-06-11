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
/** Kimi Coding Plan: api.kimi.com / *.kimi.com (accepts bare kimi.com). */
export declare function isKimiEndpoint(): boolean;
/** Alibaba Bailian / DashScope. */
export declare function isBailianEndpoint(): boolean;
/** Xiaomi MiMo. */
export declare function isMimoEndpoint(): boolean;
/** Volcengine ARK. */
export declare function isVolcengineEndpoint(): boolean;
/** Zhipu BigModel (open.bigmodel.cn). */
export declare function isZhipuEndpoint(): boolean;
/**
 * Credential directory: ${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/credentials
 *
 * Kept separate from the cache file so users can back up / wipe credentials
 * without touching the usage cache (and vice versa).
 */
export declare function getCredentialsDir(): string;
export { getConfigDir };
