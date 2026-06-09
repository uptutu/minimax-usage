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

export { getConfigDir };
