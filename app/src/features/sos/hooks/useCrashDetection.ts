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

    return () => {
      if (accelListener) accelListener.remove();
    };
  }, [isActive, onCrashDetected]);
}