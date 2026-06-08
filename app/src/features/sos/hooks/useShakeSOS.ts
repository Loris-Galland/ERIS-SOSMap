/*
 * Hook that detects energetic device shaking and dispatches an SOS after a 5-second countdown.
 * Uses @capacitor/motion to track rapid directional force changes; requires minShakeCount
 * back-and-forth movements within timeWindow milliseconds to trigger.
 * Exports useShakeSOS with startListening/stopListening controls and cancelSOS for the banner UI.
 * Connects to sosService for dispatch, ShakeSOSBanner for the countdown overlay, and SosSection
 * for the user-facing on/off preference stored in localStorage.
 */
import { useEffect, useRef, useState } from 'react';
import { Motion } from '@capacitor/motion';
import { type PluginListenerHandle } from '@capacitor/core';
import { dispatchSOS } from '../../../services/sosService';
import { useAudioRecording } from '../../audio/hooks/useAudioRecording';

interface ShakeConfig {
  threshold: number;       // Acceleration force needed to count as a shake (G-force/standard is ~15-25)
  minShakeCount: number;   // Number of back-and-forth movements required
  timeWindow: number;      // Max timeframe (ms) to complete the required shakes
  cooldown: number;        // Prevent accidental multiple triggers (ms)
}

export const useShakeSOS = (
  userId: string,
  getPosition: () => { lat: number; lng: number; alt: number },
  getBatteryLevel: () => number = () => 100,
  config: ShakeConfig = { 
    threshold: 12,        // Standardized G-force threshold baseline
    minShakeCount: 6,     // Requires 6 energetic back-and-forth direction switches
    timeWindow: 2000,     // Must complete all movements within a 2-second window
    cooldown: 10000      
  }
) => {
  const [isListening, setIsListening] = useState<boolean>(false);
  const motionListenerRef = useRef<PluginListenerHandle | null>(null);
  
  // ─── INTERNAL COUNTDOWN STATE ───
  const [isCounting, setIsCounting] = useState<boolean>(false);
  const [countdown, setCountdown] = useState<number>(5);
  const timerRef = useRef<any | null>(null);

  // High-Frequency Hardware Tracking References
  const lastXRef = useRef<number>(0);
  const lastYRef = useRef<number>(0);
  const lastZRef = useRef<number>(0);
  const shakeCountRef = useRef<number>(0);
  const lastDirectionChangeRef = useRef<number>(0);
  const firstShakeTimeRef = useRef<number>(0);
  
  // State control locks
  const hasTriggeredRef = useRef<boolean>(false);
  const onCooldownRef = useRef<boolean>(false);

  // Initialize the audio recorder
  const { startRecording, stopRecording, cancelRecording, linkAudioToAlert } = useAudioRecording(userId);

  const startListening = async () => {
    if (motionListenerRef.current) return;

    const isEnabled = localStorage.getItem('eris_shake_sos_enabled') === 'true'; // Defaults to true
    if (!isEnabled) {
      console.log('[SHAKE HOOK] Initialization bypassed: Feature disabled in settings.');
      return;
    }

    try {
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        if (permission !== 'granted') {
          console.error('[SHAKE HOOK] Accelerometer permission denied');
          return;
        }
      }
      setIsListening(true);

      // Listen at high frequency to accurately catch vector direction changes
      motionListenerRef.current = await Motion.addListener('accel', (event) => {
        if (onCooldownRef.current || isCounting || hasTriggeredRef.current) return; 

        const { x, y, z } = event.acceleration;
        const currentTime = Date.now();

        // Detect if the physical movement vector inverted rapidly (a real shake)
        const deltaX = x - lastXRef.current;
        const deltaY = y - lastYRef.current;
        const deltaZ = z - lastZRef.current;
        
        // Compute total instantaneous directional force
        const force = Math.sqrt(deltaX * deltaX + deltaY * deltaY + deltaZ * deltaZ);

        if (force > config.threshold) {
          // Prevent counting a single long slide as multiple shakes (debounce individual spikes by 80ms)
          if (currentTime - lastDirectionChangeRef.current > 80) {
            
            if (shakeCountRef.current === 0) {
              firstShakeTimeRef.current = currentTime;
            }

            // Verify if we are within the legal sequence timeframe window
            if (currentTime - firstShakeTimeRef.current < config.timeWindow) {
              shakeCountRef.current += 1;
              lastDirectionChangeRef.current = currentTime;

              if (shakeCountRef.current >= config.minShakeCount) {
                triggerCountdown();
              }
            } else {
              // Window expired; reset tracking naturally without instant-triggering
              shakeCountRef.current = 1;
              firstShakeTimeRef.current = currentTime;
              lastDirectionChangeRef.current = currentTime;
            }
          }
        }

        lastXRef.current = x; 
        lastYRef.current = y; 
        lastZRef.current = z;
      });
    } catch (err) {
      console.error('[SHAKE HOOK] Failed to initialize hardware sensors', err);
    }
  };

  const stopListening = async () => {
    if (motionListenerRef.current) {
      await motionListenerRef.current.remove();
      motionListenerRef.current = null;
    }
    setIsListening(false);
    //cancelSOS();
  };

  // ─── COUNTDOWN LOGIC ───
  const triggerCountdown = () => {
    hasTriggeredRef.current = true;
    shakeCountRef.current = 0;
    
    setCountdown(5);
    setIsCounting(true);
    startRecording('shake');
  };

  // Manage the countdown tick second by second
  useEffect(() => {
    if (!isCounting) return;

    if (countdown > 0) {
      timerRef.current = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else {
      setIsCounting(false);
      executeSOSDispatch();
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isCounting, countdown]);

  const executeSOSDispatch = async () => {
    console.log('[SHAKE HOOK] Countdown reached zero, dispatching single SOS...');
    onCooldownRef.current = true;

    try {
      const position = getPosition();
      const battery = getBatteryLevel();

      const result = await dispatchSOS(
        userId, 
        position, 
        battery, 
        'Automated emergency SOS triggered by device shake hardware event.',
        {
          incidentType: 'OTHER',
          victimCount: 1,
          triggerSource: 'SHAKE'
        }
      );

      if (result && (result as any).supabaseId) {
         linkAudioToAlert((result as any).supabaseId);
      }
    } catch (error) {
      console.error('[SHAKE HOOK] Automatic dispatch workflow failed', error);
    } finally {
      setTimeout(() => { 
        hasTriggeredRef.current = false;
        onCooldownRef.current = false; 
        console.log('[SHAKE HOOK] Cooldown expired. Shake-to-SOS is now active and ready again.');
      }, config.cooldown);
    }
  };

  const cancelSOS = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    
    setIsCounting(false);
    setCountdown(5);
    cancelRecording();
    
    hasTriggeredRef.current = false;
    onCooldownRef.current = false; 
    console.log('[SHAKE HOOK] SOS pipeline intercepted and aborted by the user.');
  };

  useEffect(() => {
    return () => { 
      if (timerRef.current) clearTimeout(timerRef.current); 
    };
  }, []);

  return { 
    isListening, 
    startListening, 
    stopListening, 
    isCounting,   
    countdown,    
    cancelSOS    
  };
};