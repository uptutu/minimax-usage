import * as https from 'node:https';
import * as querystring from 'node:querystring';
import type { KimiCredentials } from './credentials.js';
import { writeKimiCredentials } from './credentials.js';

const OAUTH_HOST = 'auth.kimi.com';
const CLIENT_ID = '17e5f671-d194-4dfb-9706-5516cb48c098';
const REFRESH_BUFFER_SEC = 300;
const REQUEST_TIMEOUT_MS = 8_000;

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type?: string;
}

interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

/**
 * Return a fresh `access_token`. If the stored token has >= 5 minutes of
 * lifetime left, it's returned as-is; otherwise we attempt a refresh-token
 * grant and persist the new credentials on success.
 */
export async function ensureFreshKimiToken(creds: KimiCredentials): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (creds.expires_at - now > REFRESH_BUFFER_SEC) {
    return creds.access_token;
  }

  const refreshed = await refreshAccessToken(creds.refresh_token);
  if (!refreshed) return null;
  const merged: KimiCredentials = { ...creds, ...refreshed };
  try {
    writeKimiCredentials(merged);
  } catch (e) {
    console.error('[minimax-usage] Failed to persist refreshed Kimi credentials:', (e as Error).message);
  }
  return merged.access_token;
}

/** Exchange a refresh_token for a new access_token. Returns `null` on any failure. */
export async function refreshAccessToken(refreshToken: string): Promise<Partial<KimiCredentials> | null> {
  const r = await postForm<TokenResponse>('/api/oauth/token', {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });
  if (!r || !r.access_token || !r.expires_in) return null;
  return {
    access_token: r.access_token,
    refresh_token: r.refresh_token ?? refreshToken,
    expires_at: Math.floor(Date.now() / 1000) + r.expires_in,
    scope: r.scope,
    token_type: r.token_type,
  };
}

/**
 * Start a device-code OAuth flow. The caller is expected to print
 * `user_code` and `verification_uri` to the user, then poll the token
 * endpoint separately. Not invoked from the statusline process — this is
 * exposed for the future `bin/kimi-login.ts` CLI tool.
 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse | null> {
  return postForm<DeviceCodeResponse>('/api/oauth/device_authorization', {
    client_id: CLIENT_ID,
  });
}

function postForm<T>(path: string, body: Record<string, string>): Promise<T | null> {
  const data = querystring.stringify(body);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (v: T | null): void => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    const req = https.request({
      hostname: OAUTH_HOST,
      port: 443,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(data),
        'Accept': 'application/json',
      },
    }, (res) => {
      let buf = '';
      res.on('data', chunk => buf += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          finish(null);
          return;
        }
        try {
          finish(JSON.parse(buf) as T);
        } catch {
          finish(null);
        }
      });
    });
    req.on('error', () => finish(null));
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('timeout')));
    req.write(data);
    req.end();
  });
}
