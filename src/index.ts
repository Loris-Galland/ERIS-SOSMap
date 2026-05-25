/*
 * Entry point for the capacitor-eris-sosmap plugin package.
 * Registers the plugin with Capacitor under the name 'CapacitorErisSosmap',
 * lazily loading the web fallback implementation when running in a browser.
 * Re-exports all public types from definitions.ts so consumers need only one
 * import path: `import { CapacitorErisSosmap } from 'capacitor-eris-sosmap'`.
 */
import { registerPlugin } from '@capacitor/core';

import type { CapacitorErisSosmapPlugin } from './definitions';

const CapacitorErisSosmap = registerPlugin<CapacitorErisSosmapPlugin>('CapacitorErisSosmap', {
  web: () => import('./web').then((m) => new m.CapacitorErisSosmapWeb()),
});

export * from './definitions';
export { CapacitorErisSosmap };
