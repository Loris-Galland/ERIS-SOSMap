import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../db/supabaseClient';
import { dispatchSOS, flushRetryQueue, revokeSOS } from '../services/sosService';
import { db } from '../db/localDb';
import { useLiveQuery } from 'dexie-react-hooks';
import SOSHistoryScreen from './SosHistoryScreen';
import { Geolocation } from '@capacitor/geolocation';
import { Device } from '@capacitor/device';
import { useTranslation } from 'react-i18next';
import DistressSignalScreen from './DistressSignalScreen';
import { Capacitor } from '@capacitor/core';

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

// Function to get or create a guest ID for users without an account
const getOrCreateGuestId = () => {
  let id = localStorage.getItem('eris_guest_id');
  if (!id) {
    id = crypto.randomUUID(); // Generate a new UUID for the guest user
    localStorage.setItem('eris_guest_id', id);
    localStorage.setItem('eris_is_guest', 'true');
  }
  return id;
};

// Main Component
export default function AlertScreen() {
  const { t } = useTranslation();
  const [holding, setHolding] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [showBeacon, setShowBeacon] = useState<boolean>(false);

  // States added for backend logic
  const [rawPosition, setRawPosition] = useState<RawPosition>({ lat: 0, lng: 0, alt: 0 });
  const [isSending, setIsSending] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusType, setStatusType] = useState<'success' | 'warning' | 'error' | null>(null);

  // States for Grace Period (Cancellation)
  const [isGracePeriod, setIsGracePeriod] = useState<boolean>(false);
  const [lastAlertIds, setLastAlertIds] = useState<{ supabase?: string; local?: number } | null>(null);

  const [coords, setCoords] = useState<Coords>({
    lat: '0.0000° N',
    lon: '0.0000° E',
    alt: '0 m',
  });

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // Fetch user ID: Supabase session OR Guest ID if offline/not logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user?.id) {
        setUserId(data.session.user.id);
        localStorage.removeItem('eris_is_guest');
      } else {
        // No ID from Supabase, fallback to guest ID
        setUserId(getOrCreateGuestId());
      }
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

    // Make sure you have an ID before sending
    let activeUserId = userId;
    if (!activeUserId) {
      activeUserId = getOrCreateGuestId();
      setUserId(activeUserId);
    }

    // Only retrieve the profile if it is NOT invited
    const isGuest = localStorage.getItem('eris_is_guest') === 'true';

    if (navigator.onLine && !isGuest) {
      try {
        const localProfile = await db.userProfile.get(activeUserId);
        if (!localProfile) {
          console.log('[ERIS] Local profile missing, fetching from Supabase...');
          const { data } = await supabase.from('user_profiles').select('*').eq('id', activeUserId).single();
          if (data) {
            await db.userProfile.put({
              id: activeUserId,
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
    }

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
    const result = await dispatchSOS(activeUserId, rawPosition, currentBattery, notes);

    let isSuccess = result.success;

    if (!navigator.onLine) {
      isSuccess = false;
      if (result.localId) {
        await db.sosQueue.update(result.localId, { status: 'queued' });
      } else {
        await db.sosQueue.add({
          user_id: activeUserId,
          lat: rawPosition.lat,
          lon: rawPosition.lng,
          battery: currentBattery,
          notes: notes,
          status: 'queued',
          timestamp: Date.now(),
        } as any);
      }
    }
    if (Capacitor.getPlatform() === 'web' && !navigator.onLine) {
      isSuccess = false;
    }

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
    <div className="flex flex-col h-full bg-[#0f141e] w-full overflow-y-auto font-sans relative pb-24 pt-4 px-4">
      {/* History screen overlay */}
      {showHistory && <SOSHistoryScreen onClose={() => setShowHistory(false)} />}

      {/* Beacon screen overlay */}
      {showBeacon && <DistressSignalScreen onClose={() => setShowBeacon(false)} />}

      {/* ─── CANCELLATION POPUP (GRACE PERIOD) ─── */}
      {isGracePeriod && (
        <div className="fixed bottom-28 left-4 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-red-600 rounded-2xl p-4 shadow-2xl flex items-center justify-between border border-white/20 overflow-hidden relative">
            <div className="flex items-center gap-3 relative z-10">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-pulse">
                <span className="material-symbols-outlined text-white text-lg">emergency</span>
              </div>
              <div>
                <p className="text-white font-bold text-sm">{t('alert.alertSent')}</p>
                <p className="text-white/80 text-[10px] uppercase tracking-wider font-semibold">
                  {t('alert.cancelAvailable')}
                </p>
              </div>
            </div>
            <button
              onClick={handleCancelAlert}
              className="bg-white text-red-600 font-black px-4 py-2 rounded-xl text-xs active:scale-95 transition-transform relative z-10"
            >
              {t('alert.cancelBtn')}
            </button>
            {/* Timer Progress Bar */}
            <div
              className="absolute bottom-0 left-0 h-1 bg-white/40 w-full origin-left"
              style={{ animation: 'timer-bar 5s linear forwards' }}
            ></div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="mb-8 mt-2 text-center">
        <h2 className="text-white font-bold text-3xl tracking-tight mb-2">{t('alert.triggerTitle')}</h2>
        <div className="h-1 w-16 bg-red-500 mx-auto rounded-full mb-3" />
        <p className="text-gray-400 font-medium text-xs">{t('alert.triggerSubtitle')}</p>

        {/* Flashlight */}
        <button
          onClick={() => setShowBeacon(true)}
          className="absolute left-2 top-6 w-10 h-10 bg-red-500/10 border border-red-500/30 rounded-full flex items-center justify-center text-red-400 hover:bg-red-500/20 hover:text-red-300 active:scale-95 transition-all"
          title="Distress Beacon"
        >
          <span className="material-symbols-outlined text-xl">flashlight_on</span>
        </button>

        {/* History */}
        <button
          onClick={() => setShowHistory(true)}
          className="absolute right-2 top-6 w-10 h-10 bg-gray-800/60 border border-gray-700/50 rounded-full flex items-center justify-center text-gray-400 hover:text-white active:scale-95 transition-all"
          title="SOS History"
        >
          <span className="material-symbols-outlined text-xl">history</span>
        </button>
      </header>

      {/* Queued Banner */}
      {(queuedCount ?? 0) > 0 && (
        <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-yellow-400 text-lg">schedule_send</span>
          <p className="text-yellow-300 text-xs font-medium">
            {queuedCount} {t('alert.pendingAlerts')}
          </p>
        </div>
      )}

      {/* SOS Button Zone */}
      <section className="flex flex-col items-center justify-center py-6 mb-4">
        <div className="relative flex items-center justify-center mb-8">
          {/* Rotating ring */}
          <div
            className="absolute rounded-full border border-red-500/20 bg-red-500/5"
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
            className="relative flex flex-col items-center justify-center gap-3 z-10 select-none rounded-full overflow-hidden transition-all duration-300 disabled:opacity-80 disabled:cursor-not-allowed"
            style={{
              width: 240,
              height: 240,
              backgroundColor: sent ? '#22c55e' : '#ef4444',
              border: '6px solid rgba(255,255,255,0.1)',
              boxShadow: sent
                ? '0 0 40px rgba(34,197,94,0.4), 0 0 80px rgba(34,197,94,0.2)'
                : '0 0 40px rgba(239,68,68,0.4), 0 0 80px rgba(239,68,68,0.2)',
              cursor: isSending ? 'not-allowed' : 'pointer',
              WebkitUserSelect: 'none',
              touchAction: 'none',
            }}
          >
            {/* Hold progress fill */}
            {holding && (
              <div
                className="absolute bottom-0 left-0 w-full bg-white/20 pointer-events-none"
                style={{
                  height: `${progress}%`,
                  transition: 'height 0.03s linear',
                }}
              />
            )}

            {isSending ? (
              <span className="material-symbols-outlined relative z-10 text-white text-6xl animate-spin">sync</span>
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
                ? 'bg-green-500/10 border border-green-500/30'
                : statusType === 'warning'
                  ? 'bg-yellow-500/10 border border-yellow-500/30'
                  : statusType === 'error'
                    ? 'bg-red-500/10 border border-red-500/30'
                    : 'bg-gray-800/60 border border-gray-700/50'
            }`}
          >
            <span
              className={`material-symbols-outlined text-lg ${
                statusType === 'success'
                  ? 'text-green-400'
                  : statusType === 'warning'
                    ? 'text-yellow-400'
                    : statusType === 'error'
                      ? 'text-red-400'
                      : 'text-blue-400'
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
            <p className="text-white text-xs font-medium leading-snug">{statusMessage}</p>
            {/* ─── OFFLINE SMS FALLBACK BUTTON ─── */}
            {statusType === 'warning' && (
              <button
                onClick={sendFallbackSMS}
                className="w-full mt-3 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors active:scale-95 shadow-lg"
              >
                <span className="material-symbols-outlined text-sm">sms</span>
                {t('alert.sendSmsBtn')}
              </button>
            )}
          </div>
        )}

        {/* Warning & Progress Bar */}
        <p className="font-semibold text-xs tracking-wider uppercase flex items-center gap-2 text-yellow-500 mb-4">
          <span className="material-symbols-outlined text-sm">warning</span>
          {t('alert.holdRequired')}
        </p>

        <div className="w-48 h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-500 rounded-full"
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
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-4 shadow-sm">
          <label
            className="block font-bold text-xs uppercase tracking-wider mb-2 text-gray-400 px-1"
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
            className="w-full bg-gray-900/50 border border-gray-700/50 rounded-2xl p-3 resize-none outline-none focus:ring-2 focus:ring-blue-500/50 text-white text-sm placeholder-gray-500 transition-all disabled:opacity-50"
            placeholder={t('alert.describeSituation')}
          />
        </div>

        {/* GPS Coordinates Display */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: t('alert.latitude'), value: coords.lat },
              { label: t('alert.longitude'), value: coords.lon },
              { label: t('alert.altitude'), value: coords.alt },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">{label}</span>
                <span className="text-sm font-bold text-blue-400">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Network Indicator */}
        <div className="flex items-center justify-center gap-2 py-2">
          <span
            className={`w-2 h-2 rounded-full ${navigator.onLine ? 'bg-green-500' : 'bg-amber-500 animate-pulse'}`}
          />
          <span className="text-gray-500 text-[11px] font-semibold uppercase tracking-wider">
            {navigator.onLine ? t('alert.networkActive') : t('alert.networkOffline')}
          </span>
        </div>
      </section>

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
