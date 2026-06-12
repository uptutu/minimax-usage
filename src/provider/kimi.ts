import type { Provider, NormalizedUsage } from './types.js';
import { isKimiEndpoint } from '../config.js';
import { toEpochMs } from '../time.js';
import { readKimiCredentials } from './kimi/credentials.js';
import { ensureFreshKimiToken } from './kimi/oauth.js';
import * as https from 'node:https';

const REQUEST_TIMEOUT_MS = 10_000;
const KIMI_API_HOST = 'api.kimi.com';
const KIMI_USAGES_PATH = '/coding/v1/usages';

/**
 * User-Agent string the Kimi usage endpoint accepts. Sourced from the
 * openusage client; if the backend ever tightens its allow-list, swap
 * this for a UA that 200s against `curl -A` in production.
 */
const ALLOWED_USER_AGENT = 'OpenUsage/1.0';

interface KimiUsageDetail {
  limit: number | string;
  used: number | string;
  remaining: number | string;
  resetTime: string;
}

interface KimiApiResponse {
  usage?: KimiUsageDetail;
  limits?: Array<{
    window: { duration: number; timeUnit: string };
    detail: KimiUsageDetail;
  }>;
}

/** Pick the single `detail` block to render. Prefers the top-level `usage`
 *  field, otherwise falls back to the longest-duration window in `limits`. */
export function pickDetail(json: KimiApiResponse): KimiUsageDetail | null {
  if (json.usage) return json.usage;

  const order: Record<string, number> = { DAY: 4, HOUR: 3, MINUTE: 2, SECOND: 1 };
  const sorted = [...(json.limits ?? [])].sort(
    (a, b) => (order[b.window.timeUnit] ?? 0) - (order[a.window.timeUnit] ?? 0)
  );
  return sorted[0]?.detail ?? null;
}

/** Convert a Kimi usage detail block to the shared NormalizedUsage shape. */
export function detailToNormalized(
  detail: KimiUsageDetail,
  providerId: 'kimi'
): NormalizedUsage {
  const limit = Number(detail.limit);
  const used = Number(detail.used);
  const remaining = Number(detail.remaining);

  const intervalRemainingPercent = Number.isFinite(limit) && limit > 0
    ? Math.max(0, Math.min(100, (remaining / limit) * 100))
    : null;

  // T-004: Kimi 5h 固定窗口,从 resetTime 推 start
  const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
  const intervalEnd = toEpochMs(detail.resetTime);
  const intervalStart = intervalEnd !== null ? intervalEnd - FIVE_HOURS_MS : null;

  return {
    intervalRemainingPercent,
    intervalResetMs: intervalEnd,
    intervalWindowStartMs: intervalStart,
    weeklyRemainingPercent: null,
    weeklyResetMs: null,
    weeklyWindowStartMs: null,
    weeklyBoostPermille: 1000,
    providerId,
  };
}

async function fetchKimiUsage(): Promise<NormalizedUsage | null> {
  if (!isKimiEndpoint()) return null;

  const creds = readKimiCredentials();
  if (!creds) {
    console.error('[minimax-usage] Kimi credentials missing at credentials/kimi.json');
    return null;
  }

  const token = await ensureFreshKimiToken(creds);
  if (!token) {
    console.error('[minimax-usage] Kimi OAuth token unavailable');
    return null;
  }

  return new Promise<NormalizedUsage | null>((resolve) => {
    let settled = false;
    const finish = (v: NormalizedUsage | null): void => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    const req = https.request({
      hostname: KIMI_API_HOST,
      port: 443,
      path: KIMI_USAGES_PATH,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'User-Agent': ALLOWED_USER_AGENT,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`[minimax-usage] Kimi API ${res.statusCode}: ${data.substring(0, 200)}`);
          finish(null);
          return;
        }
        try {
          const json = JSON.parse(data) as KimiApiResponse;
          const detail = pickDetail(json);
          finish(detail ? detailToNormalized(detail, 'kimi') : null);
        } catch {
          console.error('[minimax-usage] Kimi JSON parse error');
          finish(null);
        }
      });
    });

    req.on('error', (e) => {
      console.error('[minimax-usage] Kimi network error:', e.message);
      finish(null);
    });
    req.setTimeout(REQUEST_TIMEOUT_MS, () => req.destroy(new Error('timeout')));
    req.end();
  });
}

export const kimiProvider: Provider = {
  id: 'kimi',
  displayName: 'Kimi',
  matches: isKimiEndpoint,
  fetch: fetchKimiUsage,
};
