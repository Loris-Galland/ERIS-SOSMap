/*
 * Full-screen emergency modal shown when a physical fall or vehicle crash is confirmed.
 * Plays a siren, counts down 15 seconds, then auto-dispatches SOS if the user doesn't cancel.
 * Accepts a `type` prop ('fall' | 'crash') to display the correct title and icon.
 * The countdown gives the user time to dismiss if the detection was a false positive.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface FallDetectionModalProps {
  onCancel: () => void;
  onConfirmSOS: () => void;
  type?: 'fall' | 'crash';
}

export default function FallDetectionModal({ onCancel, onConfirmSOS, type = 'fall' }: FallDetectionModalProps) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(15);

  const isCrash = type === 'crash';
  const icon    = isCrash ? 'car_crash' : 'personal_injury';
  const title   = isCrash
    ? t('crash.detectedTitle', 'CRASH DETECTED')
    : t('fall.detectedTitle', 'FALL DETECTED');
  const message = isCrash
    ? t('crash.detectedMessage', 'A vehicle crash was detected. An automatic SOS alert will be sent in...')
    : t('fall.detectedMessage', 'An automatic SOS alert will be sent with your location in...');

  useEffect(() => {
    const audio = new Audio('/siren.mp3');
    audio.loop = true;
    audio.play().catch(() => console.warn('[ERIS] Audio autoplay blocked by browser'));

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          audio.pause();
          onConfirmSOS();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(timer);
      audio.pause();
    };
  }, [onConfirmSOS]);

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
          onClick={onConfirmSOS}
          className="w-full py-4 bg-transparent border-2 border-red-500 text-red-300 font-bold rounded-2xl hover:bg-red-500/20 active:scale-95 transition-all"
        >
          {t('fall.sendNow', 'SEND SOS NOW')}
        </button>
      </div>
    </div>
  );
}
