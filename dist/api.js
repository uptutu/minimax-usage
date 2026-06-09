import { getApiKey } from './config.js';
import * as https from 'node:https';
const REQUEST_TIMEOUT_MS = 10_000;
export async function fetchTokenPlan() {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.error('[minimax-usage] No API key found (ANTHROPIC_AUTH_TOKEN not set)');
        return null;
    }
    return new Promise((resolve) => {
        let settled = false;
        const finish = (value) => {
            if (settled)
                return;
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
                    const json = JSON.parse(data);
                    if (json.base_resp?.status_code !== 0) {
                        console.error(`[minimax-usage] API error: ${json.base_resp?.status_msg}`);
                        finish(null);
                        return;
                    }
                    const generalModel = json.model_remains?.find(m => m.model_name === 'general');
                    finish(generalModel ?? null);
                }
                catch {
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
}
