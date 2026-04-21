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
    userId: string 
  }): Promise<{ success: boolean; transmissionMethod: string }> {
    
    console.log('WEB MOCK - Emergency Triggered:', options);
    
    return { success: true, transmissionMethod: 'WEB_SIMULATION' };
  }
}