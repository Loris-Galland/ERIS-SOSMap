import { useState, useEffect, useRef, useCallback } from 'react';

interface Coords {
  lat: string;
  lon: string;
  alt: string;
}

export default function AlertScreen() {
  const [holding, setHolding] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [coords, setCoords] = useState<Coords>({
    lat: '0.0000° N',
    lon: '0.0000° E',
    alt: '0 m',
  });

  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const HOLD_DURATION = 3000;

  // Simulate GPS updates
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition((pos: GeolocationPosition) => {
      setCoords({
        lat: `${pos.coords.latitude.toFixed(4)}° N`,
        lon: `${pos.coords.longitude.toFixed(4)}° E`,
        alt: `${Math.round(pos.coords.altitude ?? 0)} m`,
      });
    }, (error) => console.error(error), { enableHighAccuracy: true });
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  const startHold = useCallback(() => {
    if (sent) return;
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
      setSent(true);
      // Reset after 5 seconds
      setTimeout(() => {
        setSent(false);
        setProgress(0);
      }, 5000);
    }, HOLD_DURATION);
  }, [sent]);

  const cancelHold = useCallback(() => {
    if (sent) return;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setHolding(false);
    setProgress(0);
  }, [sent]);

  return (
    <div className="flex flex-col h-full bg-[#0f141e] w-full overflow-y-auto font-sans relative pb-24 pt-4 px-4">
      
      {/* ─── HEADER ─── */}
      <header className="mb-8 mt-2 text-center">
        <h2 className="text-white font-bold text-3xl tracking-tight mb-2">
          Trigger SOS Alert
        </h2>
        <div className="h-1 w-16 bg-red-500 mx-auto rounded-full mb-3" />
        <p className="text-gray-400 font-medium text-xs">
          Notifies local emergency services immediately
        </p>
      </header>

      {/* ─── SOS BUTTON ZONE ─── */}
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
            className="relative flex flex-col items-center justify-center gap-3 z-10 select-none rounded-full overflow-hidden transition-all duration-300"
            style={{
              width: 240,
              height: 240,
              backgroundColor: sent ? '#22c55e' : '#ef4444', // Green if sent, Red if normal
              border: '6px solid rgba(255,255,255,0.1)',
              boxShadow: sent
                ? '0 0 40px rgba(34,197,94,0.4), 0 0 80px rgba(34,197,94,0.2)'
                : '0 0 40px rgba(239,68,68,0.4), 0 0 80px rgba(239,68,68,0.2)',
              cursor: 'pointer',
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

            {/* Hold progress fill (White overlay rising from bottom) */}
            {holding && (
              <div
                className="absolute bottom-0 left-0 w-full bg-white/20 pointer-events-none"
                style={{
                  height: `${progress}%`,
                  transition: 'height 0.03s linear',
                }}
              />
            )}

            <span className="material-symbols-outlined relative z-10 text-white text-6xl" style={{ fontVariationSettings: "'FILL' 1" }}>
              {sent ? 'check_circle' : 'emergency_share'}
            </span>

            <span className="font-bold text-xl text-center px-4 leading-tight text-white relative z-10 whitespace-pre-line tracking-wide">
              {sent ? 'ALERT\nSENT ✓' : holding ? 'HOLDING...' : 'HOLD TO\nSEND SOS'}
            </span>
          </button>
        </div>

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

      {/* ─── ALERT DETAILS FORM ─── */}
      <section className="space-y-4 px-2">
        <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-4 shadow-sm">
          <label className="block font-bold text-xs uppercase tracking-wider mb-2 text-gray-400 px-1" htmlFor="alert-notes">
            Emergency Details (Optional)
          </label>
          <textarea
            id="alert-notes"
            rows={3}
            className="w-full bg-gray-900/50 border border-gray-700/50 rounded-2xl p-3 resize-none outline-none focus:ring-2 focus:ring-blue-500/50 text-white text-sm placeholder-gray-500 transition-all"
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  {label}
                </span>
                <span className="text-sm font-bold text-blue-400">
                  {value}
                </span>
              </div>
            ))}
          </div>
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