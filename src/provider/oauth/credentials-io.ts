/**
 * T-006 OAuth credentials I/O — generic, provider-agnostic.
 *
 * Handles on-disk persistence of access/refresh tokens. The HTTP half of
 * OAuth (device-code flow, token exchange) lives in the per-provider
 * `oauth.ts` modules and is out of scope for this slice.
 *
 * File path: ${CLAUDE_CONFIG_DIR:-~/.claude}/plugins/minimax-usage/credentials/<providerId>.json
 * File mode: 0o600 on POSIX (silently ignored on Windows).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getCredentialsDir } from '../../config.js';

export interface OAuthCredentials {
    access_token: string;
    refresh_token: string;
    expires_at: number;  // epoch seconds
    scope?: string;
    token_type?: string;
}

export function credentialsPath(providerId: string): string {
    return path.join(getCredentialsDir(), `${providerId}.json`);
}

export function readCredentials(providerId: string): OAuthCredentials | null {
    const p = credentialsPath(providerId);
    try {
        if (!fs.existsSync(p)) return null;
        const content = fs.readFileSync(p, 'utf-8');
        const j = JSON.parse(content);
        if (!j.access_token || !j.refresh_token || typeof j.expires_at !== 'number') return null;
        return j as OAuthCredentials;
    } catch {
        return null;
    }
}

export function writeCredentials(providerId: string, c: OAuthCredentials): void {
    fs.mkdirSync(getCredentialsDir(), { recursive: true });
    fs.writeFileSync(credentialsPath(providerId), JSON.stringify(c, null, 2), { mode: 0o600 });
}

export function deleteCredentials(providerId: string): void {
    const p = credentialsPath(providerId);
    if (fs.existsSync(p)) fs.unlinkSync(p);
}

export function isExpiredSoon(creds: OAuthCredentials, nowSec: number, bufferSec = 300): boolean {
    return creds.expires_at - nowSec <= bufferSec;
}
