/*
 * Detects vehicle crashes using the device accelerometer via @capacitor/motion.
 * Arms detection only when the user is travelling above CRASH_SPEED_THRESHOLD_KMH,
 * then fires when a massive impact spike is recorded (CRASH_IMPACT_THRESHOLD m/s²).
 * When a crash is confirmed it calls onCrashDetected() AND emits to riskEventBus
 * so the AI risk engine can register the CRASH_CONFIRMED pattern.
 *
 * Adapted from the colleague's feature/AutoFallDetection useCrashDetection hook.
 * Speed input comes from useRiskDetection (currentSpeedMs × 3.6 → km/h).
 */

import { useEffect, useRef } from 'react';
import { Motion } from '@capacitor/motion';
import { riskEventBus } from '../../risk/riskEventBus';

const CRASH_SPEED_THRESHOLD_KMH = 30;  // minimum speed in km/h to arm crash detection
const CRASH_IMPACT_THRESHOLD    = 40.0; // severe impact magnitude in m/s²

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
import { useEffect, useRef } from 'react';
import { Motion } from '@capacitor/motion';

const CRASH_SPEED_THRESHOLD_KMH = 30; // Minimum speed in km/h to arm crash detection
const CRASH_IMPACT_THRESHOLD = 40.0;  // Severe impact threshold in m/s² 

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

    const startMonitoring = async () => {
      try {
  // Arm detection only if the user is riding above the speed threshold
  useEffect(() => {
    if (currentSpeedKmh >= CRASH_SPEED_THRESHOLD_KMH) {
      if (!isArmed.current) {
        console.log(`[CRASH DETECTION] System armed. Riding speed: ${currentSpeedKmh.toFixed(1)} km/h`);
        isArmed.current = true;
      }
    } else {
      if (isArmed.current) {
        console.log(`[CRASH DETECTION] System disarmed. Speed dropped below threshold: ${currentSpeedKmh.toFixed(1)} km/h`);
        isArmed.current = false;
      }
    }
  }, [currentSpeedKmh]);

  useEffect(() => {
    let accelListener: any;

    const startMonitoring = async () => {
      if (!isActive) return;

      try {
        // Listen to the accelerometer vector magnitudes
        accelListener = await Motion.addListener('accel', (event) => {
          const { x, y, z } = event.accelerationIncludingGravity;
          const magnitude = Math.sqrt(x * x + y * y + z * z);

          if (!isFinite(magnitude) || magnitude < 0) return;

          if (isArmed.current && magnitude > CRASH_IMPACT_THRESHOLD) {
            // Crash confirmed — disarm immediately to prevent duplicate triggers
            isArmed.current = false;
            const pos = getLastKnownPosition();
            riskEventBus.emitCrashDetected(pos.lat, pos.lng);
            onCrashDetected();
          }
        });
      } catch (error) {
        console.warn('[ERIS] Accelerometer unavailable for crash detection', error);
          // Trigger crash sequence only if system is armed (riding fast) and impact is massive
          if (isArmed.current && magnitude > CRASH_IMPACT_THRESHOLD) {
            console.log(`[CRASH DETECTION] CRASH CRITERIA MET! Impact: ${magnitude.toFixed(1)} m/s²`);
            onCrashDetected();
            isArmed.current = false;
          }
        });
      } catch (error) {
        console.warn("[CRASH DETECTION] Accelerometer sensor not available:", error);
      }
    };

    startMonitoring();

    return () => { accelListener?.remove(); };
  }, [isActive, onCrashDetected]);
}
    return () => {
      if (accelListener) accelListener.remove();
    };
  }, [isActive, onCrashDetected]);
}
