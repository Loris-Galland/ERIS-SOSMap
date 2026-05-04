import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../db/supabaseClient';
import { dispatchSOS, flushRetryQueue, revokeSOS } from '../services/sosService'; // Added revokeSOS
import { db } from '../db/localDb';
import { useLiveQuery } from 'dexie-react-hooks';
import SOSHistoryScreen from './SosHistoryScreen';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { useTranslation } from 'react-i18next';

// Types
interface Coords {
  lat: string;
  lon: string;
  alt: string;
}

interface RawPosition {
  lat: number;
  lng: number;
  alt: number;
}

// Main Component
export default function AlertScreen() {
  const { t } = useTranslation();
  const [holding, setHolding] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const [coords, setCoords] = useState<Coords>({
    lat: '0.0000° N',
    lon: '0.0000° E',
    alt: '0 m',
  });

  // States added for backend logic
  const [rawPosition, setRawPosition] = useState<RawPosition>({ lat: 0, lng: 0, alt: 0 });
  const [isSending, setIsSending] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'warning' | 'error' | null>(null);

  // States for Grace Period (Cancellation)
  const [isGracePeriod, setIsGracePeriod] = useState<boolean>(false);
  const [lastAlertIds, setLastAlertIds] = useState<{ supabase?: string; local?: number } | null>(null);

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // Added Grace Timer
  const HOLD_DURATION = 3000;

  // Live count of queued offline alerts from Dexie
  const queuedCount = useLiveQuery(() => db.sosQueue.where('status').equals('queued').count(), [], 0);

  // Native Capacitor GPS Watcher
  useEffect(() => {
    let watchId: string;

    const startWatch = async () => {
      // Check and request permissions first
      let permStatus = await Geolocation.checkPermissions();
      if (permStatus.location !== 'granted') {
        permStatus = await Geolocation.requestPermissions();
      }

      // Start native watcher if authorized
      if (permStatus.location === 'granted') {
        watchId = await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 10000 }, (pos, err) => {
          if (pos) {
            setCoords({
              lat: `${pos.coords.latitude.toFixed(4)}° N`,
              lon: `${pos.coords.longitude.toFixed(4)}° E`,
              alt: `${Math.round(pos.coords.altitude ?? 0)} m`,
            });
            setRawPosition({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              alt: pos.coords.altitude ?? 0,
            });
          }
          if (err) console.error('GPS Watch Error:', err);
        });
      }
    };

    startWatch();

    // Cleanup on unmount
    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, []);

  // Fetch user ID once from local session to avoid network requests when offline
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  // Auto-sync when network is restored
  useEffect(() => {
    const handleOnline = () => {
      console.log('Réseau de retour ! Lancement de la synchronisation auto...');
      flushRetryQueue();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (graceTimerRef.current) clearTimeout(graceTimerRef.current);
    };
  }, []);

  // Function to cancel the alert during the grace period
  const handleCancelAlert = async () => {
    if (graceTimerRef.current) clearTimeout(graceTimerRef.current);

    if (lastAlertIds) {
      await revokeSOS(lastAlertIds.supabase, lastAlertIds.local);
    }

    setIsGracePeriod(false);
    setSent(false);
    setLastAlertIds(null);
    setStatusMessage(t('alert.cancelMessage'));
    setStatusType('error');

    setTimeout(() => {
      setStatusMessage(null);
      setStatusType(null);
    }, 3000);
  };

  // Fallback SMS function for offline mode
  const sendFallbackSMS = () => {
    const googleMapsLink = `https://maps.google.com/?q=${rawPosition.lat},${rawPosition.lng}`;
    const message = encodeURIComponent(
      `${t('alert.urgentHelp')} \n${t('alert.position')}: ${googleMapsLink}\n${t('alert.notes')}: ${notes || t('alert.none')}`,
    );

    // Detect iOS/Android because the SMS link separator differs based on the OS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const separator = isIOS ? '&' : '?';

    // Open the native Message app with pre-filled text
    window.open(`sms:${separator}body=${message}`, '_system');
  };

  // Actual SOS dispatch
  const triggerSOS = useCallback(async () => {
    setIsSending(true);
    setStatusMessage(t('alert.transmitting'));
    setStatusType(null);

    if (!userId) {
      setStatusMessage(t('alert.authError'));
      setStatusType('error');
      setIsSending(false);
      setTimeout(() => {
        setStatusMessage(null);
        setStatusType(null);
      }, 4000);
      return;
    } // Fallback sync if local profile is missing but internet is available

    if (navigator.onLine) {
      try {
        const localProfile = await db.userProfile.get(userId);
        if (!localProfile) {
          console.log('[ERIS] Local profile missing, fetching from Supabase...');
          const { data } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
          if (data) {
            await db.userProfile.put({
              id: userId,
              firstName: data.first_name || '',
              lastName: data.last_name || '',
              bloodType: data.blood_type || 'Unknown',
              allergies: data.allergies || 'None',
              medicalConditions: data.medical_conditions || 'None',
              currentCondition: data.current_condition || 'Healthy',
            });
          }
        }
      } catch (e) {
        console.warn('[ERIS] Could not fetch profile before dispatch', e);
      }
    } // Call SOS service

    // Fetch current battery level natively before dispatching
    let currentBattery = 100;
    try {
      const info = await Device.getBatteryInfo();
      if (info.batteryLevel !== undefined) {
        currentBattery = Math.round(info.batteryLevel * 100);
      }
    } catch (e) {
      console.warn('[ERIS] Could not fetch native battery info', e);
    }

    // Pass currentBattery instead of hardcoded 100
    const result = await dispatchSOS(userId, rawPosition, currentBattery, notes);

    if (result.success) {
      // Store IDs and launch the grace period popup
      setLastAlertIds({ supabase: (result as any).supabaseId, local: result.localId as number });
      setIsGracePeriod(true);
      setSent(true);

      if (result.method === 'INTERNET') {
        setStatusMessage(t('alert.receivedGlobal'));
      } else {
        setStatusMessage(t('alert.transmittedHardware'));
      }
      setStatusType('success');

      // 5-second timer for cancellation window
      graceTimerRef.current = setTimeout(() => {
        setIsGracePeriod(false);
        // Reset screen after grace period is fully over
        setTimeout(() => {
          setSent(false);
          setProgress(0);
          setStatusMessage(null);
          setStatusType(null);
          setNotes('');
        }, 3000);
      }, 5000);
    } else {
      // Offline fallback behavior
      setStatusMessage(t('alert.offlineSaved'));
      setStatusType('warning');
      setSent(true);

      setTimeout(() => {
        setSent(false);
        setProgress(0);
        setStatusMessage(null);
        setStatusType(null);
        setNotes('');
      }, 5000);
    }

    setIsSending(false);
  }, [rawPosition, userId, notes, t]);

  // SOS hold start
  const startHold = useCallback(() => {
    // Prevent holding if already sent, sending, or currently in grace period
    if (sent || isSending || isGracePeriod) return;
    setHolding(true);
    setProgress(0);
    startTimeRef.current = Date.now();

    progressTimerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        const pct = Math.min((elapsed / HOLD_DURATION) * 100, 100);
        setProgress(pct);
      }
    }, 30);

    holdTimerRef.current = setTimeout(() => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
      setHolding(false);
      setProgress(100);
      triggerSOS();
    }, HOLD_DURATION);
  }, [sent, isSending, isGracePeriod, triggerSOS]);

  // SOS hold cancel
  const cancelHold = useCallback(() => {
    if (sent || isSending) return;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setHolding(false);
    setProgress(0);
  }, [sent, isSending]);

  return (
    <div className="flex flex-col h-full bg-eris-bg w-full overflow-y-auto font-sans relative pb-24 pt-4 px-4">
      {/* History screen overlay */}
      {showHistory ? (
        <SOSHistoryScreen onClose={() => setShowHistory(false)} />
      ) : (
        <>
          {/* ─── CANCELLATION POPUP (GRACE PERIOD) ─── */}
          {isGracePeriod && (
            <div className="fixed bottom-28 left-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="bg-eris-danger rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-white/20 [.theme-contrasted_&]:!border-2 [.theme-contrasted_&]:!border-black overflow-hidden relative">
                <div className="flex items-center gap-3 relative z-10">
                  <div className="w-8 h-8 bg-white/20 [.theme-contrasted_&]:!border-2 [.theme-contrasted_&]:!border-black rounded-full flex items-center justify-center animate-pulse">
                    <span className="material-symbols-outlined text-eris-text text-lg">emergency</span>
                  </div>
                  <div>
                    <p className="text-eris-text font-bold text-sm">{t('alert.alertSent')}</p>
                    <p className="text-eris-text/80 text-[10px] uppercase tracking-wider font-semibold">
                      {t('alert.cancelAvailable')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancelAlert}
                  className="bg-white text-eris-danger [.theme-contrasted_&]:!bg-black [.theme-contrasted_&]:!text-white font-black px-4 py-2 rounded-xl text-xs active:scale-95 transition-transform relative z-10"
                >
                  {t('alert.cancelBtn')}
                </button>
                {/* Timer Progress Bar */}
                <div
                  className="absolute bottom-0 left-0 h-1 bg-white/40 [.theme-contrasted_&]:!bg-black/40 w-full origin-left"
                  style={{ animation: 'timer-bar 5s linear forwards' }}
                ></div>
              </div>
            </div>
          )}

          {/* Header */}
          <header className="mb-8 mt-2 text-center">
            <h2 className="text-eris-text font-bold text-3xl tracking-tight mb-2">{t('alert.triggerTitle')}</h2>
            <div className="h-1 w-16 bg-eris-danger mx-auto rounded-full mb-3" />
            <p className="text-eris-text-muted font-medium text-xs">{t('alert.triggerSubtitle')}</p>

            {/* History access button */}
            <button
              onClick={() => setShowHistory(true)}
              className="absolute right-2 top-6 w-10 h-10 bg-eris-surface-alt/60 border border-eris-border/50 rounded-full flex items-center justify-center text-eris-text-muted hover:text-eris-text active:scale-95 transition-all"
              title="SOS History"
            >
              <span className="material-symbols-outlined text-xl">history</span>
            </button>
          </header>

          {/* Queued Banner */}
          {(queuedCount ?? 0) > 0 && (
            <div className="mb-4 bg-eris-alert/10 border border-eris-alert/30 rounded-2xl p-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-eris-alert text-lg">schedule_send</span>
              <p className="text-eris-alert text-xs font-medium">
                {queuedCount} {t('alert.pendingAlerts')}
              </p>
            </div>
          )}

          {/* SOS Button Zone */}
          <section className="flex flex-col items-center justify-center py-6 mb-4">
            <div className="relative flex items-center justify-center mb-8">
              {/* Rotating ring */}
              <div
                className={`absolute rounded-full border ${
                  sent ? 'border-eris-success/20 bg-eris-success/5' : 'border-eris-danger/20 bg-eris-danger/5'
                } [.theme-contrasted_&]:border-white [.theme-contrasted_&]:bg-gray-600/60`}
                style={{
                  width: 300,
                  height: 300,
                }}
              />

              {/* SOS Button */}
              <button
                onMouseDown={startHold}
                onTouchStart={startHold}
                onMouseUp={cancelHold}
                onMouseLeave={cancelHold}
                onTouchEnd={cancelHold}
                disabled={isSending}
                className={`relative flex flex-col items-center justify-center gap-3 z-10 select-none rounded-full overflow-hidden transition-all duration-300 disabled:opacity-80 disabled:cursor-not-allowed border-[6px] border-white/10 [.theme-contrasted_&]:!border-white [.theme-contrasted_&]:shadow-none ${
                  sent
                    ? 'bg-eris-success shadow-[0_0_40px_rgba(var(--eris-success),0.4),0_0_80px_rgba(var(--eris-success),0.2)]'
                    : 'bg-eris-danger shadow-[0_0_40px_rgba(var(--eris-danger),0.4),0_0_80px_rgba(var(--eris-danger),0.2)]'
                }`}
                style={{
                  width: 240,
                  height: 240,
                  cursor: isSending ? 'not-allowed' : 'pointer',
                  WebkitUserSelect: 'none',
                  touchAction: 'none',
                }}
              >
                {/* Hold progress fill */}
                {holding && (
                  <div
                    className="absolute bottom-0 left-0 w-full bg-white/20 [.theme-contrasted_&]:bg-black/20 pointer-events-none"
                    style={{
                      height: `${progress}%`,
                      transition: 'height 0.03s linear',
                    }}
                  />
                )}

                {isSending ? (
                  <span className="material-symbols-outlined relative z-10 text-eris-text text-6xl animate-spin">
                    sync
                  </span>
                ) : (
                  <span
                    className="material-symbols-outlined relative z-10 text-white text-6xl"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    {sent ? 'check_circle' : 'emergency_share'}
                  </span>
                )}

                <span className="font-bold text-xl text-center px-4 leading-tight text-white relative z-10 whitespace-pre-line tracking-wide">
                  {isSending
                    ? t('alert.sending')
                    : sent
                      ? t('alert.sentCheck')
                      : holding
                        ? t('alert.holding')
                        : t('alert.holdBtn')}
                </span>
              </button>
            </div>

            {/* Status Message Banner */}
            {statusMessage && (
              <div
                className={`w-full max-w-xs rounded-2xl p-3 flex items-center gap-2 mb-4 ${
                  statusType === 'success'
                    ? 'bg-eris-success/10 border border-eris-success/30'
                    : statusType === 'warning'
                      ? 'bg-eris-alert/10 border border-eris-alert/30'
                      : statusType === 'error'
                        ? 'bg-eris-danger/10 border border-eris-danger/30'
                        : 'bg-eris-surface-alt/60 border border-eris-border/50'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-lg ${
                    statusType === 'success'
                      ? 'text-eris-success'
                      : statusType === 'warning'
                        ? 'text-eris-alert'
                        : statusType === 'error'
                          ? 'text-eris-danger'
                          : 'text-eris-primary'
                  }`}
                >
                  {statusType === 'success'
                    ? 'check_circle'
                    : statusType === 'warning'
                      ? 'schedule_send'
                      : statusType === 'error'
                        ? 'error'
                        : 'sync'}
                </span>
                <p className="text-eris-text text-xs font-medium leading-snug">{statusMessage}</p>
                {/* ─── OFFLINE SMS FALLBACK BUTTON ─── */}
                {statusType === 'warning' && (
                  <button
                    onClick={sendFallbackSMS}
                    className="w-full mt-3 py-3 bg-eris-primary hover:bg-eris-primary text-eris-text rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-lg"
                  >
                    <span className="material-symbols-outlined text-sm">sms</span>
                    {t('alert.sendSmsBtn')}
                  </button>
                )}
              </div>
            )}

            {/* Warning & Progress Bar */}
            <p className="font-semibold text-xs tracking-wider uppercase flex items-center gap-2 text-eris-alert mb-4">
              <span className="material-symbols-outlined text-sm">warning</span>
              {t('alert.holdRequired')}
            </p>

            <div className="w-48 h-1.5 bg-eris-surface-alt rounded-full overflow-hidden">
              <div
                className="h-full bg-eris-alert rounded-full"
                style={{
                  width: `${progress}%`,
                  transition: holding ? 'width 0.03s linear' : 'none',
                  opacity: holding || sent ? 1 : 0,
                }}
              />
            </div>
          </section>

          {/* Alert Details Form */}
          <section className="space-y-4 px-2">
            <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl p-4 shadow-sm">
              <label
                className="block font-bold text-xs uppercase tracking-wider mb-2 text-eris-text-muted px-1"
                htmlFor="alert-notes"
              >
                {t('alert.emergencyDetails')}
              </label>
              <textarea
                id="alert-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={isSending || isGracePeriod}
                className="w-full bg-eris-surface/50 border border-eris-border/50 rounded-2xl p-3 resize-none outline-none focus:ring-2 focus:ring-eris-primary/50 text-eris-text text-sm placeholder-gray-500 transition-all disabled:opacity-50"
                placeholder={t('alert.describeSituation')}
              />
            </div>

            {/* GPS Coordinates Display */}
            <div className="bg-eris-surface-alt/40 border border-eris-border/50 rounded-3xl p-4 shadow-sm">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: t('alert.latitude'), value: coords.lat },
                  { label: t('alert.longitude'), value: coords.lon },
                  { label: t('alert.altitude'), value: coords.alt },
                ].map(({ label, value }) => (
                  <div key={label} className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-eris-text-subtle">
                      {label}
                    </span>
                    <span className="text-sm font-bold text-eris-primary">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Network Indicator */}
            <div className="flex items-center justify-center gap-2 py-2">
              <span
                className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-eris-success' : 'bg-amber-500 animate-pulse'}`}
              />
              <span className="text-eris-text-subtle text-[11px] font-semibold uppercase tracking-wider">
                {navigator.onLine ? t('alert.networkActive') : t('alert.networkOffline')}
              </span>
            </div>
          </section>
        </>
      )}

      {/* Animations */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes timer-bar {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
      `}</style>
    </div>
  );
}
