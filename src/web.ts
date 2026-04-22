import { WebPlugin } from '@capacitor/core';
import type { CapacitorErisSosmapPlugin } from './definitions';

export class CapacitorErisSosmapWeb extends WebPlugin implements CapacitorErisSosmapPlugin {
  async echo(options: { value: string }): Promise<{ value: string }> {
    console.log('ECHO', options);
    return options;
  }

  async triggerEmergency(options: {
    latitude: number;
    longitude: number;
    userId: string;
  }): Promise<{ success: boolean; transmissionMethod: string }> {
    
    console.log('[ERIS-WEB] Emergency triggered:', options);
 
    if (navigator.onLine) {
      console.log('[ERIS-WEB] Network detected -> INTERNET transmission');
      return { success: true, transmissionMethod: 'INTERNET' };
    }
 
    // Simulate the 4-second hardware fallback from the native plugins
    console.log('[ERIS-WEB] No network → simulating Wi-Fi hardware fallback (4s)...');
    await new Promise<void>((resolve) => setTimeout(resolve, 4000));
    console.log('[ERIS-WEB] Hardware fallback complete -> WIFI_HARDWARE_FALLBACK');
    return { success: true, transmissionMethod: 'WIFI_HARDWARE_FALLBACK' };
  }
}