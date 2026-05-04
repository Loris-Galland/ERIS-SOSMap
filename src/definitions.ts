import type { PluginListenerHandle } from '@capacitor/core';

export interface CapacitorErisSosmapPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;

  // Trigger the native emergency process
  triggerEmergency(options: { latitude: number; longitude: number; userId: string }): Promise<{ success: boolean; transmissionMethod: string }>;

  startMeshNetwork(): Promise<void>;
  stopMeshNetwork(): Promise<void>;
  broadcastMeshMessage(options: { message: string }): Promise<void>;

  addListener(
    eventName: 'onMeshMessageReceived',
    listenerFunc: (data: { message: string }) => void
  ): Promise<PluginListenerHandle>;
  
}
