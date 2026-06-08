import { fetchTokenPlan } from './api.js';
import { render } from './render.js';

interface StdinData {
  context_window?: {
    context_window_size?: number;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } | null;
    used_percentage?: number | null;
    remaining_percentage?: number | null;
  } | null;
}

async function main(): Promise<void> {
  // Read stdin from Claude Code
  let stdinData: StdinData = {};
  try {
    const stdin = await readStdin();
    if (stdin) {
      stdinData = JSON.parse(stdin) as StdinData;
    }
  } catch {
    // Ignore stdin errors
  }

  // Always fetch fresh data to ensure accuracy
  const data = await fetchTokenPlan();
  render(data, stdinData);
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.on('data', chunk => data += chunk);
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

// Run main function
void main();