import { WebPlugin } from '@capacitor/core';
import type { CapacitorErisSosmapPlugin } from './definitions';

type DeviceMotionEventWithPermission = typeof DeviceMotionEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>;
};

export class CapacitorErisSosmapWeb extends WebPlugin implements CapacitorErisSosmapPlugin {
  private motionHandler: ((e: DeviceMotionEvent) => void) | null = null;
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

  async startMeshNetwork(): Promise<void> {
    console.warn('[ERIS-WEB] startMeshNetwork simulé : Le Mesh nécessite un vrai téléphone.');
  }

  async stopMeshNetwork(): Promise<void> {
    console.log('[ERIS-WEB] stopMeshNetwork simulé');
  }

  async broadcastMeshMessage(options: { message: string }): Promise<void> {
    console.warn('[ERIS-WEB] Message envoyé dans le vide (Web) :', options.message);
  }

  // Request DeviceMotion permission (required on iOS 13+ browsers) and start listening
  async startMotionMonitoring(): Promise<void> {
    const DME = DeviceMotionEvent as DeviceMotionEventWithPermission;
    if (typeof DME.requestPermission === 'function') {
      const permission = await DME.requestPermission();
      if (permission !== 'granted') {
        console.warn('[ERIS-WEB] DeviceMotion permission denied');
        return;
      }
    }

    this.motionHandler = (e: DeviceMotionEvent) => {
      const a  = e.acceleration;
      if (!a) return;
      const ax = a.x ?? 0;
      const ay = a.y ?? 0;
      const az = a.z ?? 0;
      const r  = e.rotationRate;
      this.notifyListeners('onMotionData', {
        ax,
        ay,
        az,
        gx:        r?.alpha ?? 0,
        gy:        r?.beta  ?? 0,
        gz:        r?.gamma ?? 0,
        magnitude: Math.sqrt(ax * ax + ay * ay + az * az),
        timestamp: Date.now(),
      });
    };

    window.addEventListener('devicemotion', this.motionHandler);
  }

  // Remove the DeviceMotion listener and release the handler reference
  async stopMotionMonitoring(): Promise<void> {
    if (this.motionHandler) {
      window.removeEventListener('devicemotion', this.motionHandler);
      this.motionHandler = null;
    }
  }
}