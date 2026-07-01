/*
 * Full-screen emergency modal shown when a fall or vehicle crash is detected.
 * Exports FallDetectionModal (default). Plays a siren and counts down 15 seconds,
 * then auto-calls onConfirmSOS unless the user cancels. Accepts a 'fall' | 'crash' type
 * prop to adjust the title and icon. Uses react-i18next for localized strings.
 * Triggered by the fall/crash detection logic in the SOS feature.
 */

import { useEffect, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';

// 1. GLOBAL VARIABLE: This guarantees only one siren can EVER exist,
// even if React Strict Mode double-renders the component.
let activeSiren: HTMLAudioElement | null = null;

interface FallDetectionModalProps {
  onConfirmSOS: (isTimeout: boolean) => void;
  onCancel: () => void;
  type?: 'fall' | 'crash';
}

export default function FallDetectionModal({ onCancel, onConfirmSOS, type = 'fall' }: FallDetectionModalProps) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(15);

  const isCrash = type === 'crash';
  const icon = isCrash ? 'car_crash' : 'personal_injury';
  const title = isCrash ? t('crash.detectedTitle', 'CRASH DETECTED') : t('fall.detectedTitle', 'FALL DETECTED');
  const message = isCrash
    ? t('crash.detectedMessage', 'A vehicle crash was detected. An automatic SOS alert will be sent in...')
    : t('fall.detectedMessage', 'An automatic SOS alert will be sent with your location in...');

  // Keep a fresh reference to onConfirmSOS
  const onConfirmRef = useRef(onConfirmSOS);
  useEffect(() => {
    onConfirmRef.current = onConfirmSOS;
  }, [onConfirmSOS]);

  useEffect(() => {
    // 2. Kill any ghost audio tracks before starting a new one
    if (activeSiren) {
      activeSiren.pause();
      activeSiren.removeAttribute('src');
    }

    // 3. Create the new audio and assign it to the global variable
    const audio = new Audio('/siren.mp3');
    audio.loop = true;
    activeSiren = audio;

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => console.warn('[ERIS] Audio autoplay blocked by browser'));
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);

          if (activeSiren) {
            activeSiren.pause();
            activeSiren.removeAttribute('src');
            activeSiren = null;
          }

          onConfirmRef.current(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);

      // 4. Safely destroy the global audio track when the modal closes
      if (activeSiren) {
        activeSiren.pause();
        activeSiren.removeAttribute('src');
        activeSiren.load();
        activeSiren = null;
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[99999] bg-red-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
      <div className="w-24 h-24 bg-red-500 rounded-full flex items-center justify-center animate-pulse mb-6 shadow-[0_0_50px_rgba(239,68,68,0.8)]">
        <span className="material-symbols-outlined text-white text-5xl">{icon}</span>
      </div>

      <h1 className="text-white text-3xl font-black text-center mb-2">{title}</h1>
      <p className="text-red-200 text-center mb-8">{message}</p>

      <div className="text-white text-8xl font-black mb-12 tabular-nums">{countdown}</div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={onCancel}
          className="w-full py-4 bg-white text-red-600 font-bold rounded-2xl shadow-xl active:scale-95 transition-all text-lg"
        >
          {t('fall.imFine', "I'M FINE — CANCEL")}
        </button>

        <button
          onClick={() => onConfirmRef.current(false)}
          className="w-full py-4 bg-transparent border-2 border-red-500 text-red-300 font-bold rounded-2xl hover:bg-red-500/20 active:scale-95 transition-all"
        >
          {t('fall.sendNow', 'SEND SOS NOW')}
        </button>
      </div>
    </div>
  );
}
