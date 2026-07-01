/*
 * Full-screen inactivity warning modal for the ERIS app.
 * Exports InactivityModal (default). Shown when the app detects no user movement
 * for an extended period. Plays a siren and counts down 30 seconds before
 * auto-calling onConfirmSOS. Uses react-i18next for localized strings.
 * Triggered by the inactivity detection hook in the SOS feature.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface InactivityModalProps {
  onCancel: () => void;
  onConfirmSOS: () => void;
}

export default function InactivityModal({ onCancel, onConfirmSOS }: InactivityModalProps) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState(30);

  useEffect(() => {
    // Play a siren to wake up the user
    const audio = new Audio('/siren.mp3');
    audio.loop = true;
    const playPromise = audio.play();
    playPromise.catch(() => console.log('Audio autoplay blocked'));

    // Vibrate heavily to get the user's attention
    if (navigator.vibrate) {
      navigator.vibrate([500, 200, 500, 200, 1000]);
    }

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
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            audio.pause();
            audio.currentTime = 0;
          })
          .catch(() => {});
      } else {
        audio.pause;
      }
    };
  }, [onConfirmSOS]);

  const progress = ((60 - countdown) / 60) * 100;

  return (
    <div className="fixed inset-0 z-[99999] bg-orange-900/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-300">
      <div className="w-24 h-24 bg-orange-500 rounded-full flex items-center justify-center animate-pulse mb-6 shadow-[0_0_50px_rgba(249,115,22,0.8)]">
        <span className="material-symbols-outlined text-white text-5xl">warning</span>
      </div>

      <h1 className="text-white text-3xl font-black text-center mb-2">{t('inactivity.title', 'ARE YOU THERE?')}</h1>
      <p className="text-orange-200 text-center mb-8">
        {t('inactivity.message', 'No movement detected for a long time. Auto-SOS in...')}
      </p>

      <div className="text-white text-8xl font-black mb-12 tabular-nums">{countdown}</div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={onCancel}
          className="w-full py-4 bg-white text-orange-600 font-bold rounded-2xl shadow-xl active:scale-95 transition-all text-lg"
        >
          {t('inactivity.imFine', "I'M FINE")}
        </button>

        <button
          onClick={onConfirmSOS}
          className="w-full py-4 bg-transparent border-2 border-orange-500 text-orange-300 font-bold rounded-2xl hover:bg-orange-500/20 active:scale-95 transition-all"
        >
          {t('inactivity.sendNow', 'SEND SOS NOW')}
        </button>
      </div>
    </div>
  );
}
