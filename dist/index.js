import { fetchTokenPlan } from './api.js';
import { render } from './render.js';
async function main() {
    // Always fetch fresh data to ensure accuracy
    const data = await fetchTokenPlan();
    render(data);
}
// Run main function
void main();
