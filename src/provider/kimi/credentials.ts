import * as fs from 'node:fs';
import * as path from 'node:path';
import { getCredentialsDir } from '../../config.js';

/**
 * Shape of the Kimi OAuth token file persisted under
 * `${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/credentials/kimi.json`.
 */
export interface KimiCredentials {
  access_token: string;
  refresh_token: string;
  /** Unix epoch seconds */
  expires_at: number;
  scope?: string;
  token_type?: string;
}

const CREDS_FILENAME = 'kimi.json';

function getCredsPath(): string {
  return path.join(getCredentialsDir(), CREDS_FILENAME);
}

/** Read and validate the on-disk Kimi credentials. Returns null on any I/O or shape error. */
export function readKimiCredentials(): KimiCredentials | null {
  const credsPath = getCredsPath();
  try {
    if (!fs.existsSync(credsPath)) return null;
    const content = fs.readFileSync(credsPath, 'utf-8');
    const j = JSON.parse(content) as Partial<KimiCredentials>;
    if (!j.access_token || !j.refresh_token || typeof j.expires_at !== 'number') {
      return null;
    }
    return j as KimiCredentials;
  } catch {
    return null;
  }
}

/** Persist the Kimi credentials. The credentials directory is created on demand and the file is written with 0600 permissions. */
export function writeKimiCredentials(c: KimiCredentials): void {
  fs.mkdirSync(getCredentialsDir(), { recursive: true });
  fs.writeFileSync(getCredsPath(), JSON.stringify(c, null, 2), { mode: 0o600 });
}
