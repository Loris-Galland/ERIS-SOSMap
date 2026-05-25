import type { PluginListenerHandle } from '@capacitor/core';

// Raw accelerometer + gyroscope sample emitted by the native motion monitor at ~5 Hz
export interface MotionData {
  ax: number;        // linear acceleration X m/s² (gravity removed)
  ay: number;        // linear acceleration Y m/s²
  az: number;        // linear acceleration Z m/s²
  gx: number;        // gyroscope X rad/s
  gy: number;        // gyroscope Y rad/s
  gz: number;        // gyroscope Z rad/s
  magnitude: number; // sqrt(ax²+ay²+az²) — primary signal for fall detection
  timestamp: number; // ms since epoch
}

export interface CapacitorErisSosmapPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;

  // Trigger the native emergency process
  triggerEmergency(options: { latitude: number; longitude: number; userId: string }): Promise<{ success: boolean; transmissionMethod: string }>;

  startMeshNetwork(): Promise<void>;
  stopMeshNetwork(): Promise<void>;
  broadcastMeshMessage(options: { message: string }): Promise<void>;

  // Start streaming accelerometer + gyroscope data via the onMotionData listener
  startMotionMonitoring(): Promise<void>;

  // Stop the motion monitor and release hardware resources
  stopMotionMonitoring(): Promise<void>;

  addListener(
    eventName: 'onMeshMessageReceived',
    listenerFunc: (data: { message: string }) => void
  ): Promise<PluginListenerHandle>;

  addListener(
    eventName: 'onMotionData',
    listenerFunc: (data: MotionData) => void
  ): Promise<PluginListenerHandle>;
}
