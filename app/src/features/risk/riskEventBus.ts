/*
 * Lightweight singleton event bus for cross-feature risk signal sharing.
 * Decouples detection features (Auto Fall, Crash) from the AI Risk engine:
 * each detector calls emit*(), and the AI engine reacts without a direct import.
 *
 * Usage from detection hooks:
 *   import { riskEventBus } from '@/features/risk/riskEventBus';
 *   riskEventBus.emitFallDetected(lat, lng);
 *   riskEventBus.emitCrashDetected(lat, lng);
 */

type EventHandler = (lat: number, lng: number) => void;

let fallHandler:  EventHandler | null = null;
let crashHandler: EventHandler | null = null;

export const riskEventBus = {
  // Register the AI engine fall handler — called once by useRiskDetection on mount
  onFallDetected: (handler: EventHandler) => { fallHandler = handler; },

  // Broadcast a fall event — called by useFallDetection when fall is confirmed
  emitFallDetected: (lat: number, lng: number) => { fallHandler?.(lat, lng); },

  // Register the AI engine crash handler — called once by useRiskDetection on mount
  onCrashDetected: (handler: EventHandler) => { crashHandler = handler; },

  // Broadcast a crash event — called by useCrashDetection when crash is confirmed
  emitCrashDetected: (lat: number, lng: number) => { crashHandler?.(lat, lng); },

  // Unregister all handlers on unmount to avoid stale closures
  clearHandlers: () => { fallHandler = null; crashHandler = null; },
};
