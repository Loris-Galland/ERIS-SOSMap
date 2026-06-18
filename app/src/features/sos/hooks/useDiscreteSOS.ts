/*
 * Hook that listens for discrete (silent) SOS gestures and dispatches an SOS after a 5-second countdown.
 * Supports two trigger methods configurable from SosSection: quad_tap (4 rapid screen taps)
 * and device_flip (3 face-down phone flips detected via DeviceOrientationEvent).
 * Exports useDiscreteSOS; connects to sosService for dispatch and DiscreteSOSBanner for the countdown UI.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { dispatchSOS } from '../../../services/sosService';
import { useAudioRecording } from '../../audio/hooks/useAudioRecording';

type DiscreteTriggerMethod = 'none' | 'quad_tap' | 'device_flip';

interface useDiscreteSOS {
  userId: string;
  userPosition: { lat: number; lng: number; alt: number };
  isActive: boolean;
}

export function useDiscreteSOS({ userId, userPosition, isActive }: useDiscreteSOS) {
  const [isCounting, setIsCounting] = useState(false);
  const [countdown, setCountdown] = useState(5);
  
  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read the user's preferred method from settings
  const [triggerMethod, setTriggerMethod] = useState<DiscreteTriggerMethod>(
    (localStorage.getItem('eris_discrete_sos_method') as DiscreteTriggerMethod) || 'none'
  );

  // Initialize the audio recorder
  const { startRecording, stopRecording, cancelRecording, linkAudioToAlert } = useAudioRecording(userId);

  // Listen for the custom event we dispatched from SensorsSection
  useEffect(() => {
    const handlePrefChange = () => {
      setTriggerMethod((localStorage.getItem('eris_discrete_sos_method') as DiscreteTriggerMethod) || 'none');
    };
    window.addEventListener('eris-discrete-preference-changed', handlePrefChange);
    return () => window.removeEventListener('eris-discrete-preference-changed', handlePrefChange);
  }, []);

  const executeSOS = useCallback(async () => {
    setIsCounting(false);
    if (navigator.vibrate) navigator.vibrate([500]); 
    console.log('Silent discrete SOS dispatched');

    // Dispatch the SOS with the new explicit triggerSource
    const result = await dispatchSOS(
      userId, 
      userPosition, 
      100, 
      'Silent Discrete SOS', 
      { 
        incidentType: 'OTHER', 
        victimCount: 1, 
        triggerSource: 'DISCRETE' 
      }
    );

    if (result && (result as any).supabaseId) {
      linkAudioToAlert((result as any).supabaseId);
    }
  }, [userId, userPosition, startRecording]);

  const startCountdown = useCallback(() => {
    if (isCounting) return;

    // Subtle haptic feedback to acknowledge the gesture (Short double vibration)
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]); 
    
    startRecording('discrete');

    setIsCounting(true);
    setCountdown(5);

    countdownInterval.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval.current!);
          executeSOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isCounting, executeSOS]);

  const cancelSOS = useCallback(() => {
    if (countdownInterval.current) clearInterval(countdownInterval.current);
    setIsCounting(false);
    setCountdown(5);
    tapCount.current = 0; // Reset taps

    cancelRecording();
  }, []);

  useEffect(() => {
    // Suspend listeners if already counting or disabled
    if (!isActive || triggerMethod === 'none' || isCounting) return;

    // ─── METHOD 1: QUADRUPLE TAP ───
    const handleGlobalClick = (e: TouchEvent) => {
      if (triggerMethod !== 'quad_tap') return;

      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'BUTTON'].includes(target.tagName)) return;

      tapCount.current += 1;
      if (tapTimer.current) clearTimeout(tapTimer.current);

      if (tapCount.current >= 4) {
        tapCount.current = 0;
        startCountdown();
      } else {
        tapTimer.current = setTimeout(() => {
          tapCount.current = 0; // Reset if they stop tapping
        }, 1500); 
      }
    };

    // ─── METHOD 2: DEVICE MOTION (Face Down Flip) ───
    let flipCount = 0;
    let isFaceDown = false;
    let flipTimer: ReturnType<typeof setTimeout> | null = null;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (triggerMethod !== 'device_flip') return;

      const beta = event.beta;
      const currentlyFaceDown = (beta !== null && (beta > 150 || beta < -150));

      if (currentlyFaceDown && !isFaceDown) {
        isFaceDown = true;
        flipCount += 1;
        if (flipTimer) clearTimeout(flipTimer);

        if (flipCount >= 3) {
          flipCount = 0;
          startCountdown();
        } else {
          flipTimer = setTimeout(() => {
            flipCount = 0;
          }, 4000);
        }
      } else if (!currentlyFaceDown) {
        isFaceDown = false;
      }
    };

    if (triggerMethod === 'quad_tap') {
      window.addEventListener('touchstart', handleGlobalClick);
    } else if (triggerMethod === 'device_flip') {
      window.addEventListener('deviceorientation', handleOrientation);
    }

    return () => {
      window.removeEventListener('touchstart', handleGlobalClick);
      window.removeEventListener('deviceorientation', handleOrientation);
      if (tapTimer.current) clearTimeout(tapTimer.current);
      if (flipTimer) clearTimeout(flipTimer);
    };
  }, [isActive, triggerMethod, isCounting, startCountdown]);

  useEffect(() => {
    return () => {
      if (countdownInterval.current) clearInterval(countdownInterval.current);
    };
  }, []);

  return { isCounting, countdown, cancelSOS };
}