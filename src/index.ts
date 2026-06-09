import { fetchTokenPlan } from './api.js';
import { getCached, setCached } from './cache.js';
import { render } from './render.js';

interface StdinData {
  model?: {
    id?: string;
    display_name?: string;
  } | null;
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

const CACHE_KEY = 'token-plan';

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

  const cached = getCached(CACHE_KEY);
  if (cached) {
    render(cached, stdinData);
    return;
  }

  const data = await fetchTokenPlan();
  if (data) {
    setCached(CACHE_KEY, data);
  }

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
