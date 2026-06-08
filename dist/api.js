import { getApiKey } from './config.js';
import * as https from 'node:https';
const API_URL = 'https://www.minimaxi.com/v1/token_plan/remains';
export async function fetchTokenPlan() {
    const apiKey = getApiKey();
    if (!apiKey) {
        console.log('[minimax-usage] No API key found (ANTHROPIC_AUTH_TOKEN not set)');
        return null;
    }
    return new Promise((resolve) => {
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
                    console.log(`[minimax-usage] API error: ${res.statusCode}, body: ${data.substring(0, 200)}`);
                    resolve(null);
                    return;
                }
                try {
                    const json = JSON.parse(data);
                    if (json.base_resp?.status_code !== 0) {
                        console.log(`[minimax-usage] API error: ${json.base_resp?.status_msg}`);
                        resolve(null);
                        return;
                    }
                    const generalModel = json.model_remains?.find(m => m.model_name === 'general');
                    resolve(generalModel ?? null);
                }
                catch {
                    console.log('[minimax-usage] JSON parse error:', data.substring(0, 200));
                    resolve(null);
                }
            });
        });
        req.on('error', (error) => {
            console.log('[minimax-usage] Network error:', error.message);
            resolve(null);
        });
        req.end();
    });
}
