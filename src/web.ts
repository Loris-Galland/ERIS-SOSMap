import { WebPlugin } from '@capacitor/core';

import type { CapacitorErisSosmapPlugin } from './definitions';

export class CapacitorErisSosmapWeb extends WebPlugin implements CapacitorErisSosmapPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }
}
