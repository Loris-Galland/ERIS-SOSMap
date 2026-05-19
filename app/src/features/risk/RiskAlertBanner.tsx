/*
 * Floating overlay banner displayed when the AI risk engine detects a dangerous pattern.
 * Appears at the bottom of the screen (z-[9999]) over any active tab.
 * HIGH-severity events show a countdown: when it expires the app navigates to the ALERTS tab.
 * The user can dismiss the alert ("I'm OK") or manually trigger SOS navigation at any time.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RiskEvent } from './types';

interface RiskAlertBannerProps {
  event: RiskEvent | null;
  onDismiss: () => void;
  onSendSOS: () => void; // navigates to ALERTS tab; caller handles acknowledgeAsSOS
}

// Map a risk level to its Tailwind colour tokens — all class strings must be static for Tailwind purging
const LEVEL_STYLES: Record<string, { bg: string; border: string; icon: string; iconColor: string; barColor: string }> = {
  HIGH:   { bg: 'bg-eris-danger/15',  border: 'border-eris-danger/40',  icon: 'emergency', iconColor: 'text-eris-danger',  barColor: 'bg-eris-danger'  },
  MEDIUM: { bg: 'bg-eris-alert/15',   border: 'border-eris-alert/40',   icon: 'warning',   iconColor: 'text-eris-alert',   barColor: 'bg-eris-alert'   },
  LOW:    { bg: 'bg-eris-primary/10', border: 'border-eris-primary/30', icon: 'info',      iconColor: 'text-eris-primary', barColor: 'bg-eris-primary' },
};

export default function RiskAlertBanner({ event, onDismiss, onSendSOS }: RiskAlertBannerProps) {
  const { t } = useTranslation();
  const [countdown, setCountdown] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start or reset the countdown whenever a new HIGH event arrives
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (!event || !event.autoSOSDelay) {
      setCountdown(null);
      return;
    }

    setCountdown(event.autoSOSDelay);

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev === null || prev <= 1) {
          clearInterval(timerRef.current!);
          onSendSOS(); // auto-navigate to ALERTS when countdown expires
          return null;
        }
        return prev - 1;
      });
    }, 1_000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [event?.id]); // re-run only when a new event is issued

  if (!event) return null;

  const styles = LEVEL_STYLES[event.level] ?? LEVEL_STYLES.MEDIUM;
  const progress = countdown != null && event.autoSOSDelay
    ? ((event.autoSOSDelay - countdown) / event.autoSOSDelay) * 100
    : 0;

  return (
    <div className="fixed bottom-24 left-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div
        className={`
          relative rounded-2xl p-4 shadow-2xl overflow-hidden
          border ${styles.bg} ${styles.border}
          [.theme-contrasted_&]:!bg-gray-900 [.theme-contrasted_&]:!border-white
        `}
      >
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${styles.bg} border ${styles.border}`}>
            <span className={`material-symbols-outlined text-xl ${styles.iconColor}`}
              style={{ fontVariationSettings: "'FILL' 1" }}>
              {styles.icon}
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-eris-text font-bold text-sm leading-snug">
              {t(event.titleKey)}
            </p>
            <p className="text-eris-text-muted text-xs mt-0.5 leading-snug">
              {t(event.descKey)}
            </p>
          </div>

          {/* Risk score badge */}
          <span className="text-[10px] font-bold text-eris-text-subtle bg-eris-surface/60 rounded-full px-2 py-0.5 shrink-0">
            {event.score}/100
          </span>
        </div>

        {/* Countdown label */}
        {countdown != null && (
          <p className="text-[11px] font-semibold text-eris-text-muted text-center mb-2 tracking-wide">
            {t('risk.autoSOS', { seconds: countdown })}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={onDismiss}
            className="flex-1 py-2.5 rounded-xl border border-eris-border/60 text-eris-text-muted text-xs font-bold
                       hover:text-eris-text hover:border-eris-border transition-colors active:scale-95
                       [.theme-contrasted_&]:!border-white [.theme-contrasted_&]:!text-white"
          >
            {t('risk.iAmOk')}
          </button>

          <button
            onClick={onSendSOS}
            className="flex-1 py-2.5 rounded-xl bg-eris-danger text-white text-xs font-bold
                       flex items-center justify-center gap-1.5 active:scale-95 transition-transform
                       shadow-lg shadow-red-900/20 [.theme-contrasted_&]:!bg-white [.theme-contrasted_&]:!text-black"
          >
            <span className="material-symbols-outlined text-sm">emergency_share</span>
            {t('risk.sendSOS')}
          </button>
        </div>

        {/* Animated countdown progress bar (HIGH events only) */}
        {countdown != null && (
          <div className="absolute bottom-0 left-0 h-1 w-full bg-eris-border/30">
            <div
              className={`h-full ${styles.barColor} transition-all duration-1000 ease-linear`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
