/*
 * Hook that monitors device inactivity using the @capacitor/motion accelerometer.
 * Tracks micro-movements via delta comparison against the previous accelerometer vector;
 * calls onInactivityDetected() if no movement is recorded for INACTIVITY_TIME_LIMIT (30 minutes).
 * Exports useInactivityMonitoring with a resetTimer() utility to restart the timer from the app shell.
 * Connects to the SOS feature to trigger a safety check when the user stops moving for too long.
 */
import { useEffect, useRef } from 'react';
import { Motion } from '@capacitor/motion';

const INACTIVITY_TIME_LIMIT = 1800000; 
const MOVEMENT_THRESHOLD = 0.5; 

export function useInactivityMonitoring(onInactivityDetected: () => void, isActive: boolean = true) {
  const lastMovementTime = useRef<number>(Date.now());
  const lastVector = useRef<{x: number, y: number, z: number} | null>(null);
  const isAlerting = useRef<boolean>(false);

  useEffect(() => {
    let accelListener: any;
    let checkInterval: any;

    const startMonitoring = async () => {
      if (!isActive) return;

      try {
        // Listen to micro-movements of the phone
        accelListener = await Motion.addListener('accel', (event) => {
          const { x, y, z } = event.accelerationIncludingGravity;

          if (lastVector.current) {
            const deltaX = Math.abs(x - lastVector.current.x);
            const deltaY = Math.abs(y - lastVector.current.y);
            const deltaZ = Math.abs(z - lastVector.current.z);

            // If the phone was tilted or moved slightly, reset the inactivity timer
            if (deltaX > MOVEMENT_THRESHOLD || deltaY > MOVEMENT_THRESHOLD || deltaZ > MOVEMENT_THRESHOLD) {
              lastMovementTime.current = Date.now();
            }
          }

          lastVector.current = { x, y, z };
        });

        // Regularly check if the inactivity time limit has been exceeded
        checkInterval = setInterval(() => {
          const timeSinceLastMove = Date.now() - lastMovementTime.current;
          
          if (timeSinceLastMove > INACTIVITY_TIME_LIMIT && !isAlerting.current) {
            console.log(`[INACTIVITY] No movement detected for ${INACTIVITY_TIME_LIMIT / 1000} seconds.`);
            isAlerting.current = true;
            onInactivityDetected();
          }
        }, 5000);

      } catch (e) {
        console.warn("[INACTIVITY] Unable to start monitoring", e);
      }
    };

    startMonitoring();

    return () => {
      if (accelListener) accelListener.remove();
      if (checkInterval) clearInterval(checkInterval);
    };
  }, [isActive, onInactivityDetected]);

  const resetTimer = () => {
    lastMovementTime.current = Date.now();
    isAlerting.current = false;
  };

  return { resetTimer };
}