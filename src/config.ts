import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import type { MiniMaxConfig } from './types.js';

const DEFAULT_CONFIG: MiniMaxConfig = {
  refreshIntervalMs: 60_000,
};

function getConfigDir(): string {
  const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR
    ?? path.join(os.homedir(), '.claude');
  return path.join(claudeConfigDir, 'plugins', 'minimax-usage');
}

function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

export function loadConfig(): MiniMaxConfig {
  const configPath = getConfigPath();

  try {
    if (!fs.existsSync(configPath)) {
      return DEFAULT_CONFIG;
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const userConfig = JSON.parse(content) as Partial<MiniMaxConfig>;
    const refreshIntervalMs = typeof userConfig.refreshIntervalMs === 'number'
      && Number.isFinite(userConfig.refreshIntervalMs)
      && userConfig.refreshIntervalMs > 0
      ? userConfig.refreshIntervalMs
      : DEFAULT_CONFIG.refreshIntervalMs;

    return {
      refreshIntervalMs,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function getApiKey(): string | null {
  return process.env.ANTHROPIC_AUTH_TOKEN ?? null;
}

/**
 * Detect whether the active Claude Code session is pointed at a MiniMax
 * endpoint. Reads `ANTHROPIC_BASE_URL` and matches its hostname against
 * MiniMax's known domains (`minimaxi.com`, `minimax.com`).
 *
 * Returns `false` when the env var is unset, malformed, or points at any
 * other host. The MiniMax HUD line should be hidden in those cases — both
 * the network call and the rendered line are gated on this.
 */
export function isMinimaxEndpoint(): boolean {
  const raw = process.env.ANTHROPIC_BASE_URL;
  if (!raw || typeof raw !== 'string') return false;
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === 'minimaxi.com'
      || host === 'minimax.com'
      || host.endsWith('.minimaxi.com')
      || host.endsWith('.minimax.com');
  } catch {
    return false;
  }
}

export { getConfigDir };
