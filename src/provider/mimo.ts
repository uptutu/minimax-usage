import type { Provider } from './types.js';
import { isMimoEndpoint } from '../config.js';

/** Stub: Xiaomi MiMo has no public coding-plan usage endpoint. */
export const mimoProvider: Provider = {
  id: 'mimo',
  displayName: 'MiMo',
  matches: isMimoEndpoint,
  fetch: async () => null,
};
