import { useEffect, useRef } from 'react';
import { Motion } from '@capacitor/motion';

// Adjustable thresholds 
const FALL_THRESHOLD_LOW = 4.0;   // Free fall 
const FALL_THRESHOLD_HIGH = 25.0; // Violent impact against the ground
const IMMOBILITY_TIME = 2000;     // Milliseconds to wait to verify immobility

export function useFallDetection(onFallDetected: () => void, isActive: boolean = true) {
  const fallState = useRef<'normal' | 'falling' | 'impact'>('normal');
  const impactTime = useRef<number>(0);

  useEffect(() => {
    let accelListener: any;

    const startMonitoring = async () => {
      if (!isActive) return;

      try {
        // We directly start listening to the sensor
        accelListener = await Motion.addListener('accel', (event) => {
          // Calculate the magnitude of the acceleration vector
          const { x, y, z } = event.accelerationIncludingGravity;
          const magnitude = Math.sqrt(x*x + y*y + z*z);

          // ─── FALL STATE MACHINE ───

          if (fallState.current === 'normal' && magnitude < FALL_THRESHOLD_LOW) {
            // 1. Detection of altitude loss
            fallState.current = 'falling';

            setTimeout(() => {
              if (fallState.current === 'falling') fallState.current = 'normal';
            }, 2000);
          } 
          else if (fallState.current === 'falling' && magnitude > FALL_THRESHOLD_HIGH) {
            //Detection of violent impact
            fallState.current = 'impact';
            impactTime.current = Date.now();
          } 
          else if (fallState.current === 'impact') {
            //Verification of immobility after the impact
            const timeSinceImpact = Date.now() - impactTime.current;
            
            if (timeSinceImpact > IMMOBILITY_TIME) {
              // The person hasn't moved for 2 seconds after the impact
              onFallDetected();
              fallState.current = 'normal'; // Reset state
            } else if (magnitude > 15) {
              // Movement detected right after impact: likely just a jump or tossing the phone
              fallState.current = 'normal';
            }
          }
        });
      } catch (e) {
        console.warn("[ERIS] Unable to start fall detection", e);
      }
    };

    startMonitoring();

    return () => {
      // Clean up the listener when the component unmounts
      if (accelListener) accelListener.remove();
    };
  }, [isActive, onFallDetected]);
}