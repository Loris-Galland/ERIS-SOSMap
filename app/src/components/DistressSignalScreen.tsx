/*
 * Full-screen distress beacon component for the ERIS app.
 * Exports DistressSignalScreen (default), which activates a siren audio loop
 * and a hardware flashlight strobe when toggled by the user or by the physical
 * volume buttons. Uses @capgo/capacitor-flash for native flashlight access.
 * Consumed by the SOS feature as a last-resort visual/audio signalling tool.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { CapacitorFlash } from '@capgo/capacitor-flash';
import { useTranslation } from 'react-i18next';

interface DistressSignalScreenProps {
  onClose: () => void;
}

export default function DistressSignalScreen({ onClose }: DistressSignalScreenProps) {
  const { t } = useTranslation();
  const [isActive, setIsActive] = useState(false);

  // Refs to hold instances without triggering re-renders
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const strobeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flashStateRef = useRef(false);
  const isActiveRef = useRef(isActive);

  // Keep ref in sync with state for the event listener
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // Initialize audio object once on mount
  useEffect(() => {
    audioRef.current = new Audio('/siren.mp3');
    audioRef.current.loop = true;

    return () => {
      stopBeacon();
    };
  }, []);

  const stopBeacon = async () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    if (strobeIntervalRef.current) {
      clearInterval(strobeIntervalRef.current);
      strobeIntervalRef.current = null;
    }

    if (Capacitor.isNativePlatform()) {
      try {
        await CapacitorFlash.switchOff();
      } catch (error) {
        console.error('[ERIS] Flashlight stop error', error);
      }
    }
  };

  const toggleBeacon = useCallback(async () => {
    const newState = !isActiveRef.current;
    setIsActive(newState);

    if (newState) {
      // Start audio
      if (audioRef.current) {
        audioRef.current.play().catch((e) => console.warn('[ERIS] Audio autoplay prevented', e));
      }

      // Start hardware strobe effect
      if (Capacitor.isNativePlatform()) {
        try {
          const hasFlash = await CapacitorFlash.isAvailable();
          if (hasFlash.value) {
            strobeIntervalRef.current = setInterval(async () => {
              flashStateRef.current = !flashStateRef.current;
              if (flashStateRef.current) {
                await CapacitorFlash.switchOn({ intensity: 1.0 });
              } else {
                await CapacitorFlash.switchOff();
              }
            }, 300);
          }
        } catch (error) {
          console.error('[ERIS] Flashlight init error', error);
        }
      } else {
        console.log('[ERIS-WEB] Strobe active (Simulated)');
      }
    } else {
      await stopBeacon();
    }
  }, []);

  // Hardware Volume Buttons Listener
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === 'VolumeUp' ||
        event.key === 'VolumeDown' ||
        event.key === 'AudioVolumeUp' ||
        event.key === 'AudioVolumeDown'
      ) {
        event.preventDefault();
        toggleBeacon();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleBeacon]);

  return (
    <div
      className={`absolute inset-0 z-[5000] flex flex-col w-full overflow-y-auto font-sans pb-24 pt-4 px-4 transition-colors duration-300 ${
        isActive ? 'bg-eris-danger' : 'bg-eris-bg'
      }`}
    >
      {/* Header */}
      <header className="mb-8 mt-2 flex items-center justify-between">
        <button
          onClick={onClose}
          className="w-10 h-10 bg-eris-surface-alt/60 border border-eris-border/50 rounded-full flex items-center justify-center text-eris-text-muted hover:text-eris-text active:scale-95 transition-all z-10"
        >
          <span className="material-symbols-outlined text-xl">arrow_back</span>
        </button>
        <h2 className="text-eris-text font-bold text-xl tracking-tight">{t('beacon.title')}</h2>
        <div className="w-10 h-10"></div>
      </header>

      {/* Main Content */}
      <section className="flex flex-col items-center justify-center flex-1">
        {/* Hardware Button Hint */}
        <div className="bg-eris-surface-alt/80 border border-eris-border rounded-2xl p-4 mb-12 flex items-center gap-3 max-w-xs z-10">
          <span className="material-symbols-outlined text-eris-primary text-3xl">volume_up</span>
          <p className="text-eris-text-muted text-xs font-medium leading-relaxed">
            {t('beacon.volumeHintBefore')}{' '}
            <strong className="text-eris-text">{t('beacon.volumeHintBold')}</strong>{' '}
            {t('beacon.volumeHintAfter')}
          </p>
        </div>

        {/* Big Toggle Button */}
        <button
          onClick={toggleBeacon}
          className={`relative flex flex-col items-center justify-center gap-3 z-10 select-none rounded-full overflow-hidden transition-all duration-300 shadow-2xl ${
            isActive
              ? 'animate-pulse bg-white text-eris-danger [.theme-contrasted_&]:!bg-black [.theme-contrasted_&]:!text-white scale-105'
              : 'bg-eris-danger text-eris-text [.theme-light_&]:text-white hover:bg-eris-danger'
          }`}
          style={{ width: 220, height: 220, border: '6px solid rgba(255,255,255,0.1)' }}
        >
          <span
            className={`material-symbols-outlined text-7xl ${isActive ? '[.theme-contrasted_&]:!text-white' : ''}`}
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            {isActive ? 'notifications_active' : 'flashlight_on'}
          </span>

          <span
            className={`font-bold text-xl text-center px-4 leading-tight tracking-wide whitespace-pre-line ${isActive ? '[.theme-contrasted_&]:!text-white' : ''}`}
          >
            {isActive ? t('beacon.beaconOn') : t('beacon.tapToActivate')}
          </span>
        </button>
      </section>
    </div>
  );
}
