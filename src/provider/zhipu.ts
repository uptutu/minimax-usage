import type { Provider } from './types.js';
import { isZhipuEndpoint } from '../config.js';

/** Stub: Zhipu BigModel coding plans have no public usage REST endpoint. */
export const zhipuProvider: Provider = {
  id: 'zhipu',
  displayName: 'Zhipu',
  matches: isZhipuEndpoint,
  fetch: async () => null,
};
