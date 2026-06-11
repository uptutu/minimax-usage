import type { Provider } from './types.js';
import { isBailianEndpoint } from '../config.js';

/** Stub: no public usage REST endpoint for DashScope/Bailian coding plans. */
export const bailianProvider: Provider = {
  id: 'bailian',
  displayName: 'Bailian',
  matches: isBailianEndpoint,
  fetch: async () => null,
};
