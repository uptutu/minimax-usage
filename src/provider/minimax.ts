import type { Provider, NormalizedUsage } from './types.js';
import { isMinimaxEndpoint, getApiKey } from '../config.js';
import { toEpochMs } from '../time.js';
import * as https from 'node:https';

const REQUEST_TIMEOUT_MS = 10_000;

interface MiniMaxRemain {
  model_name: string;
  current_interval_total_count: number;
  current_interval_usage_count: number;
  current_interval_remaining_percent: number;
  current_weekly_total_count: number;
  current_weekly_usage_count: number;
  current_weekly_remaining_percent: number;
  weekly_boost_permille: number;
  end_time: number;
  weekly_end_time: number;
}

interface MiniMaxResponse {
  model_remains: MiniMaxRemain[];
  base_resp: {
    status_code: number;
    status_msg: string;
  };
}

/**
 * Fetch and normalise the active session's MiniMax token-plan usage.
 * Returns `null` for any failure mode (wrong host, missing key, network,
 * non-zero status, JSON parse error).
 */
async function fetchMinimaxUsage(): Promise<NormalizedUsage | null> {
  if (!isMinimaxEndpoint()) return null;

  const apiKey = getApiKey();
  if (!apiKey) {
    console.error('[minimax-usage] No API key found (ANTHROPIC_AUTH_TOKEN not set)');
    return null;
  }

  const remain = await new Promise<MiniMaxRemain | null>((resolve) => {
    let settled = false;
    const finish = (value: MiniMaxRemain | null): void => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const req = https.request({
      hostname: 'www.minimaxi.com',
      port: 443,
      path: '/v1/token_plan/remains',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': '*/*',
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.error(`[minimax-usage] API error: ${res.statusCode}, body: ${data.substring(0, 200)}`);
          finish(null);
          return;
        }

        try {
          const json = JSON.parse(data) as MiniMaxResponse;
          if (json.base_resp?.status_code !== 0) {
            console.error(`[minimax-usage] API error: ${json.base_resp?.status_msg}`);
            finish(null);
            return;
          }

          const generalModel = json.model_remains?.find(m => m.model_name === 'general');
          finish(generalModel ?? null);
        } catch {
          console.error('[minimax-usage] JSON parse error:', data.substring(0, 200));
          finish(null);
        }
      });
    });

    req.on('error', (error) => {
      console.error('[minimax-usage] Network error:', error.message);
      finish(null);
    });

    req.setTimeout(REQUEST_TIMEOUT_MS, () => {
      req.destroy(new Error('Request timed out'));
    });

    req.end();
  });

  if (!remain) return null;

  return {
    intervalRemainingPercent: remain.current_interval_remaining_percent,
    intervalResetMs: toEpochMs(remain.end_time),
    weeklyRemainingPercent: remain.current_weekly_remaining_percent,
    weeklyResetMs: toEpochMs(remain.weekly_end_time),
    weeklyBoostPermille: remain.weekly_boost_permille,
    providerId: 'minimax',
  };
}

export const minimaxProvider: Provider = {
  id: 'minimax',
  displayName: 'MiniMax',
  matches: isMinimaxEndpoint,
  fetch: fetchMinimaxUsage,
};
