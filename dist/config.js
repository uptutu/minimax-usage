import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
const DEFAULT_CONFIG = {
    refreshIntervalMs: 60_000,
};
function getConfigDir() {
    const claudeConfigDir = process.env.CLAUDE_CONFIG_DIR
        ?? path.join(os.homedir(), '.claude');
    return path.join(claudeConfigDir, 'plugins', 'minimax-usage');
}
function getConfigPath() {
    return path.join(getConfigDir(), 'config.json');
}
export function loadConfig() {
    const configPath = getConfigPath();
    try {
        if (!fs.existsSync(configPath)) {
            return DEFAULT_CONFIG;
        }
        const content = fs.readFileSync(configPath, 'utf-8');
        const userConfig = JSON.parse(content);
        const refreshIntervalMs = typeof userConfig.refreshIntervalMs === 'number'
            && Number.isFinite(userConfig.refreshIntervalMs)
            && userConfig.refreshIntervalMs > 0
            ? userConfig.refreshIntervalMs
            : DEFAULT_CONFIG.refreshIntervalMs;
        return {
            refreshIntervalMs,
        };
    }
    catch {
        return DEFAULT_CONFIG;
    }
}
export function getApiKey() {
    return process.env.ANTHROPIC_AUTH_TOKEN ?? null;
}
export { getConfigDir };
