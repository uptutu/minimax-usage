import { fetchTokenPlan } from './api.js';
import { render } from './render.js';
async function main() {
    // Read stdin from Claude Code
    let stdinData = {};
    try {
        const stdin = await readStdin();
        if (stdin) {
            stdinData = JSON.parse(stdin);
        }
    }
    catch {
        // Ignore stdin errors
    }
    // Always fetch fresh data to ensure accuracy
    const data = await fetchTokenPlan();
    render(data, stdinData);
}
function readStdin() {
    return new Promise((resolve, reject) => {
        let data = '';
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => resolve(data));
        process.stdin.on('error', reject);
    });
}
// Run main function
void main();
