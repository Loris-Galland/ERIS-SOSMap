/*
 * Hook that detects vehicular crashes using the @capacitor/motion accelerometer.
 * Arms itself only when currentSpeedKmh exceeds CRASH_SPEED_THRESHOLD_KMH, then fires
 * onCrashDetected() and emits to riskEventBus when a massive impact spike is recorded.
 * Speed is provided by the caller (useRiskDetection exposes currentSpeedMs * 3.6).
 * Connects to riskEventBus so the AI risk engine receives CRASH_CONFIRMED events.
 */

import { useEffect, useRef } from 'react';
import { Motion } from '@capacitor/motion';
import { riskEventBus } from '../../risk/riskEventBus';

const CRASH_SPEED_THRESHOLD_KMH = 30;  // minimum speed in km/h to arm crash detection
const CRASH_IMPACT_THRESHOLD    = 40.0; // severe impact magnitude in m/s²

/*
// --- TEST VALUES ---
const CRASH_SPEED_THRESHOLD_KMH = 0;    
const CRASH_IMPACT_THRESHOLD    = 15.0;
 */

// Retrieve the last cached GPS position so the AI engine has a coordinate for the event
function getLastKnownPosition(): { lat: number; lng: number } {
  try {
    const cached = localStorage.getItem('sosmap_last_location');
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }
  return { lat: 0, lng: 0 };
}

interface UseCrashDetectionProps {
  currentSpeedKmh: number;
  onCrashDetected: () => void;
  isActive?: boolean;
}

export function useCrashDetection({ currentSpeedKmh, onCrashDetected, isActive = true }: UseCrashDetectionProps) {
  const isArmed = useRef<boolean>(false);

  // Arm or disarm detection based on current GPS speed
  useEffect(() => {
    if (currentSpeedKmh >= CRASH_SPEED_THRESHOLD_KMH) {
      isArmed.current = true;
    } else {
      isArmed.current = false;
    }
  }, [currentSpeedKmh]);

  // Listen to the accelerometer and trigger when armed + massive impact detected
  useEffect(() => {
    if (!isActive) return;

    let accelListener: { remove: () => void } | undefined;
    let isCancelled = false;

    const startMonitoring = async () => {
      try {
        const listener = await Motion.addListener('accel', (event) => {
          const { x, y, z } = event.accelerationIncludingGravity;
          const magnitude = Math.sqrt(x * x + y * y + z * z);

          if (!isFinite(magnitude) || magnitude < 0) return;

          if (isArmed.current && magnitude > CRASH_IMPACT_THRESHOLD) {
            // Crash confirmed — disarm immediately to prevent duplicate triggers
            isArmed.current = false;
            const pos = getLastKnownPosition();
            //riskEventBus.emitCrashDetected(pos.lat, pos.lng);
            onCrashDetected();
          }
        });

        if (isCancelled) {
          listener.remove;
        } else {
          accelListener = listener;
        }
      } catch (error) {
        console.warn('[ERIS] Accelerometer unavailable for crash detection', error);
      }
    };

    startMonitoring();

    return () => { 
      isCancelled = true;
      accelListener?.remove(); 
    };
  }, [isActive, onCrashDetected]);
}
