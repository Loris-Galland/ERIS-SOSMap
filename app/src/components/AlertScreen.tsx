import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../db/supabaseClient';
import { dispatchSOS, flushRetryQueue } from '../services/sosService';
import { db } from '../db/localDb';
import { useLiveQuery } from 'dexie-react-hooks';

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
  const [holding, setHolding] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [notes, setNotes] = useState<string>('');
  const [userId, setUserId] = useState<string | null>(null);

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

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const HOLD_DURATION = 3000;

  // Live count of queued offline alerts from Dexie
  const queuedCount = useLiveQuery(() => db.sosQueue.where('status').equals('queued').count(), [], 0);

  // Simulate GPS updates
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos: GeolocationPosition) => {
        setCoords({
          lat: `${pos.coords.latitude.toFixed(4)}° N`,
          lon: `${pos.coords.longitude.toFixed(4)}° E`,
          alt: `${Math.round(pos.coords.altitude ?? 0)} m`,
        });
        // Save raw numbers for Supabase
        setRawPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          alt: pos.coords.altitude ?? 0,
        });
      },
      (error) => console.error(error),
      { enableHighAccuracy: true },
    );

    return () => navigator.geolocation.clearWatch(watchId);
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

  // Actual SOS dispatch
  const triggerSOS = useCallback(async () => {
    setIsSending(true);
    setStatusMessage('Transmitting alert...');
    setStatusType(null);

    if (!userId) {
      setStatusMessage('Authentication error. Please log in again.');
      setStatusType('error');
      setIsSending(false);
      setTimeout(() => {
        setStatusMessage(null);
        setStatusType(null);
      }, 4000);
      return;
    }

    // Call SOS service
    const result = await dispatchSOS(userId, rawPosition, 100, notes);

    if (result.success && result.method === 'INTERNET') {
      setStatusMessage('Alert received by the global network.');
      setStatusType('success');
    } else if (result.success && result.method === 'WIFI_HARDWARE_FALLBACK') {
      setStatusMessage('Alert transmitted via local hardware fallback.');
      setStatusType('success');
    } else {
      setStatusMessage('Offline: Alert saved and will be sent when network is restored.');
      setStatusType('warning');
    }

    setIsSending(false);
    setSent(true);

    // Reset after 5 seconds
    setTimeout(() => {
      setSent(false);
      setProgress(0);
      setStatusMessage(null);
      setStatusType(null);
      setNotes('');
    }, 5000);
  }, [rawPosition, userId, notes]);

  // SOS hold start
  const startHold = useCallback(() => {
    if (sent || isSending) return;
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
  }, [sent, isSending, triggerSOS]);

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
      {/* Header */}
      <header className="mb-8 mt-2 text-center">
        <h2 className="text-white font-bold text-3xl tracking-tight mb-2">Trigger SOS Alert</h2>
        <div className="h-1 w-16 bg-red-500 mx-auto rounded-full mb-3" />
        <p className="text-gray-400 font-medium text-xs">Notifies local emergency services immediately</p>
      </header>

      {/* Queued Banner */}
      {(queuedCount ?? 0) > 0 && (
        <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-2xl p-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-yellow-400 text-lg">schedule_send</span>
          <p className="text-yellow-300 text-xs font-medium">
            {queuedCount} alert{(queuedCount ?? 0) > 1 ? 's' : ''} pending — will be sent when network is restored.
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
              animation: 'spin-slow 12s linear infinite',
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
            {/* Scan line animation */}
            <div
              className="absolute left-0 w-full h-[2px] pointer-events-none opacity-50"
              style={{
                background: 'linear-gradient(to right, transparent, white, transparent)',
                animation: 'scan 3s linear infinite',
              }}
            />

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
              {isSending ? 'SENDING...' : sent ? 'ALERT\nSENT ✓' : holding ? 'HOLDING...' : 'HOLD TO\nSEND SOS'}
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
          </div>
        )}

        {/* Warning & Progress Bar */}
        <p className="font-semibold text-xs tracking-wider uppercase flex items-center gap-2 text-yellow-500 mb-4">
          <span className="material-symbols-outlined text-sm">warning</span>
          3-second hold required
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
            Emergency Details (Optional)
          </label>
          <textarea
            id="alert-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSending}
            className="w-full bg-gray-900/50 border border-gray-700/50 rounded-2xl p-3 resize-none outline-none focus:ring-2 focus:ring-blue-500/50 text-white text-sm placeholder-gray-500 transition-all disabled:opacity-50"
            placeholder="Describe your situation (e.g., medical, fire, trapped)..."
          />
        </div>

        {/* GPS Coordinates Display */}
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-4 shadow-sm">
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'LATITUDE', value: coords.lat },
              { label: 'LONGITUDE', value: coords.lon },
              { label: 'ALTITUDE', value: coords.alt },
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
            {navigator.onLine ? 'Connected — ERIS Network Active' : 'Offline — Hardware Fallback Ready'}
          </span>
        </div>
      </section>

      {/* Animations */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes scan {
          0%   { top: 0%; opacity: 0; }
          10%  { opacity: 0.5; }
          90%  { opacity: 0.5; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
