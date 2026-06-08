import { fetchTokenPlan } from './api.js';
import { render } from './render.js';

async function main(): Promise<void> {
  // Always fetch fresh data to ensure accuracy
  const data = await fetchTokenPlan();
  render(data);
}

// Run main function
void main();