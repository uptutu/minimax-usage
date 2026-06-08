import { fetchTokenPlan } from './api.js';
import { getCached, setCached } from './cache.js';
import { render } from './render.js';
const CACHE_KEY = 'token_plan';
async function main() {
    // Try to get cached data first
    let data = getCached(CACHE_KEY);
    // If no cached data, fetch from API
    if (data === null) {
        data = await fetchTokenPlan();
        setCached(CACHE_KEY, data);
    }
    render(data);
}
// Run main function
void main();
