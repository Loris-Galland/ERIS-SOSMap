import React, { useState, useEffect, useRef, useCallback } from 'react';

interface Coords {
  lat: string;
  lon: string;
  alt: string;
}

export default function AlertsPage() {
  const [holding, setHolding] = useState<boolean>(false);
  const [sent, setSent] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [coords, setCoords] = useState<Coords>({
    lat: '0.0000° N',
    lon: '0.0000° W',
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
        lon: `${pos.coords.longitude.toFixed(4)}° W`,
        alt: `${Math.round(pos.coords.altitude ?? 0)} m`,
      });
    });
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
    <div
      className="min-h-screen font-body selection:bg-red-500 selection:text-white"
      style={{ backgroundColor: '#131313', color: '#e5e2e1' }}
    >
      {/* TopAppBar */}
      <nav
        className="flex justify-between items-center w-full px-4 h-16 fixed top-0 z-50"
        style={{ backgroundColor: '#0E0E0E' }}
      >
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined" style={{ color: '#FFB3AC' }}>
            menu
          </span>
          <h1
            className="text-xl font-black tracking-widest uppercase"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#D32F2F' }}
          >
            COMMAND CENTER
          </h1>
        </div>
        <button
          className="font-bold px-4 py-1 tracking-tighter"
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            backgroundColor: '#D32F2F',
            color: '#fff2f0',
          }}
        >
          SOS
        </button>
      </nav>

      {/* Main */}
      <main className="pt-20 pb-28 px-4 flex flex-col max-w-2xl mx-auto" style={{ minHeight: '100vh' }}>
        {/* Header */}
        <header className="mb-6 mt-4">
          <h2
            className="font-extrabold text-4xl leading-none tracking-tighter mb-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#e5e2e1' }}
          >
            ENVOYER UNE ALERTE ?
          </h2>
          <div className="h-1 w-24" style={{ backgroundColor: '#D32F2F' }} />
          <p
            className="font-bold uppercase tracking-widest text-xs mt-4"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#ffb3ac' }}
          >
            Activation immédiate de la réponse locale
          </p>
        </header>

        {/* SOS Button Zone */}
        <section className="flex-grow flex flex-col items-center justify-center py-10">
          <div className="relative flex items-center justify-center">
            {/* Rotating ring */}
            <div
              className="absolute"
              style={{
                width: 320,
                height: 320,
                border: '2px solid rgba(211,47,47,0.2)',
                backgroundColor: 'rgba(211,47,47,0.05)',
                transform: 'rotate(45deg)',
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
              className="relative flex flex-col items-center justify-center gap-4 z-10 select-none"
              style={{
                width: 256,
                height: 256,
                borderRadius: '50%',
                backgroundColor: sent ? '#1b5e20' : '#D32F2F',
                border: '8px solid rgba(255,242,240,0.2)',
                boxShadow: sent
                  ? '0 0 40px rgba(76,175,80,0.5), 0 0 80px rgba(76,175,80,0.15)'
                  : '0 0 40px rgba(211,47,47,0.4), 0 0 80px rgba(211,47,47,0.1)',
                transition: 'background-color 0.4s, box-shadow 0.4s',
                overflow: 'hidden',
                cursor: 'pointer',
                WebkitUserSelect: 'none',
                touchAction: 'none',
              }}
            >
              {/* Scan line */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  width: '100%',
                  height: 2,
                  background: 'linear-gradient(to right, transparent, rgba(243,223,46,0.5), transparent)',
                  animation: 'scan 3s linear infinite',
                  pointerEvents: 'none',
                }}
              />

              {/* Hold progress fill */}
              {holding && (
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    width: '100%',
                    height: `${progress}%`,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                    pointerEvents: 'none',
                    transition: 'height 0.03s linear',
                  }}
                />
              )}

              <span
                className="material-symbols-outlined relative z-10"
                style={{
                  fontVariationSettings: "'FILL' 1",
                  fontSize: 64,
                  color: '#fff2f0',
                }}
              >
                {sent ? 'check_circle' : 'emergency_share'}
              </span>

              <span
                className="font-black text-2xl text-center px-4 leading-tight uppercase relative z-10 whitespace-pre-line"
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#fff2f0' }}
              >
                {sent ? 'ALERTE\nENVOYÉE ✓' : holding ? 'MAINTIEN EN\nCOURS...' : 'MAINTENIR POUR\nENVOYER SOS'}
              </span>
            </button>
          </div>

          <p
            className="mt-10 font-bold text-sm tracking-widest uppercase flex items-center gap-2"
            style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#f3df2e' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              warning
            </span>
            Vérification de 3 secondes requise
          </p>

          <div
            className="mt-3 overflow-hidden"
            style={{
              width: 192,
              height: 4,
              backgroundColor: '#353534',
              opacity: holding ? 1 : 0,
              transition: 'opacity 0.3s',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progress}%`,
                backgroundColor: '#f3df2e',
                transition: holding ? 'width 0.03s linear' : 'none',
              }}
            />
          </div>
        </section>

        {/* Alert details textarea */}
        <section className="space-y-4 mt-2">
          <div
            className="p-4"
            style={{
              backgroundColor: '#2a2a2a',
              borderLeft: '4px solid #f3df2e',
            }}
          >
            <label
              className="block font-bold text-xs uppercase tracking-widest mb-2"
              htmlFor="alert-notes"
              style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#f3df2e' }}
            >
              Détails de l'alerte (facultatif)
            </label>
            <textarea
              id="alert-notes"
              rows={3}
              className="w-full border-0 p-3 resize-none outline-none focus:ring-2"
              placeholder="Entrez des informations critiques..."
              style={{
                backgroundColor: '#353534',
                color: '#e5e2e1',
                fontFamily: "'Inter', sans-serif",
                caretColor: '#f3df2e',
              }}
            />
          </div>

          {/* GPS Coordinates */}
          <div className="p-4 relative overflow-hidden" style={{ backgroundColor: '#201f1f' }}>
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'LATITUDE', value: coords.lat },
                { label: 'LONGITUDE', value: coords.lon },
                { label: 'ALTITUDE', value: coords.alt },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <span
                    className="block font-bold uppercase"
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: 10,
                      color: '#c6c6c7',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {label}
                  </span>
                  <span
                    className="block font-bold tracking-tight"
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: 14,
                      color: '#ffb3ac',
                    }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* BottomNavBar */}
      <nav
        className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center h-20"
        style={{ backgroundColor: '#201F1F' }}
      >
        {[
          { icon: 'map', label: 'MAP', active: false },
          { icon: 'notifications_active', label: 'ALERTS', active: true, filled: true },
          { icon: 'download', label: 'OFFLINE', active: false },
          { icon: 'person', label: 'USER', active: false },
        ].map(({ icon, label, active, filled }) => (
          <a
            key={label}
            href="#"
            className="flex flex-col items-center justify-center p-2"
            style={{
              color: active ? '#F3DF2E' : '#FFFFFF',
              opacity: active ? 1 : 0.7,
              backgroundColor: active ? '#353534' : 'transparent',
              borderBottom: active ? '4px solid #F3DF2E' : '4px solid transparent',
            }}
          >
            <span className="material-symbols-outlined" style={filled ? { fontVariationSettings: "'FILL' 1" } : {}}>
              {icon}
            </span>
            <span className="font-bold uppercase" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 10 }}>
              {label}
            </span>
          </a>
        ))}
      </nav>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(45deg); }
          to   { transform: rotate(405deg); }
        }
        @keyframes scan {
          0%   { top: 0%; }
          100% { top: 100%; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
