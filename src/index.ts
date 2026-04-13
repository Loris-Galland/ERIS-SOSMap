import { registerPlugin } from '@capacitor/core';

import type { CapacitorErisSosmapPlugin } from './definitions';

const CapacitorErisSosmap = registerPlugin<CapacitorErisSosmapPlugin>('CapacitorErisSosmap', {
  web: () => import('./web').then((m) => new m.CapacitorErisSosmapWeb()),
});

export * from './definitions';
export { CapacitorErisSosmap };
