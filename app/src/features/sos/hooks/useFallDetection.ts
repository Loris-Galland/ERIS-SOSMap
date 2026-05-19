/*
 * Detects physical falls using the device accelerometer via @capacitor/motion.
 * Implements a three-phase state machine: free-fall → impact → immobility.
 * When a fall is confirmed it calls onFallDetected() AND emits to riskEventBus
 * so the AI risk engine can corroborate the event with GPS behavioral data.
 */

import { useEffect, useRef } from 'react';
import { Motion } from '@capacitor/motion';
import { riskEventBus } from '../../risk/riskEventBus';

// Magnitude thresholds — accelerationIncludingGravity in m/s²
const FALL_THRESHOLD_LOW  = 4.0;   // below this = free-fall phase
const FALL_THRESHOLD_HIGH = 25.0;  // above this after free-fall = impact
const IMMOBILITY_TIME     = 2000;  // ms of immobility required to confirm fall

// Retrieve the last cached GPS position so the AI engine has a coordinate for the event
function getLastKnownPosition(): { lat: number; lng: number } {
  try {
    const cached = localStorage.getItem('sosmap_last_location');
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }
  return { lat: 0, lng: 0 };
}

export function useFallDetection(onFallDetected: () => void, isActive: boolean = true) {
  const fallState  = useRef<'normal' | 'falling' | 'impact'>('normal');
  const impactTime = useRef<number>(0);

  useEffect(() => {
    if (!isActive) return;

    let accelListener: { remove: () => void } | undefined;

    // Start listening to the native accelerometer sensor
    const startMonitoring = async () => {
      try {
        accelListener = await Motion.addListener('accel', (event) => {
          const { x, y, z } = event.accelerationIncludingGravity;
          const magnitude = Math.sqrt(x * x + y * y + z * z);

          if (fallState.current === 'normal' && magnitude < FALL_THRESHOLD_LOW) {
            // Phase 1 — free-fall detected, wait for impact within 2 s
            fallState.current = 'falling';
            setTimeout(() => {
              if (fallState.current === 'falling') fallState.current = 'normal';
            }, 2000);

          } else if (fallState.current === 'falling' && magnitude > FALL_THRESHOLD_HIGH) {
            // Phase 2 — violent impact recorded
            fallState.current = 'impact';
            impactTime.current = Date.now();

          } else if (fallState.current === 'impact') {
            const timeSinceImpact = Date.now() - impactTime.current;

            if (timeSinceImpact > IMMOBILITY_TIME) {
              // Phase 3 — person hasn't moved since impact: confirmed fall
              const pos = getLastKnownPosition();
              riskEventBus.emitFallDetected(pos.lat, pos.lng);
              onFallDetected();
              fallState.current = 'normal';

            } else if (magnitude > 15) {
              // Strong movement right after impact — likely a phone toss, not a real fall
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
        console.warn('[ERIS] Accelerometer unavailable for fall detection', e);
        console.warn("[ERIS] Unable to start fall detection", e);
      }
    };

    startMonitoring();

    return () => {
      accelListener?.remove();
    };
  }, [isActive, onFallDetected]);
}
      // Clean up the listener when the component unmounts
      if (accelListener) accelListener.remove();
    };
  }, [isActive, onFallDetected]);
}
