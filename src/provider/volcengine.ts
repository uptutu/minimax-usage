import type { Provider } from './types.js';
import { isVolcengineEndpoint } from '../config.js';

/**
 * Stub: Volcengine ARK only exposes a prepaid cash-balance endpoint, not a
 * coding-plan quota. See `docs/provider-hud-integration.md` §4 for the
 * future credit-balance HUD.
 */
export const volcengineProvider: Provider = {
  id: 'volcengine',
  displayName: 'Volcengine',
  matches: isVolcengineEndpoint,
  fetch: async () => null,
};
