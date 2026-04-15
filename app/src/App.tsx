import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Geolocation } from '@capacitor/geolocation';

export default function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const userMarker = useRef<L.Marker | null>(null);

  // State for REAL GPS position
  const [userPosition, setUserPosition] = useState({ lat: 0, lng: 0, alt: 0 });
  const [gpsStatus, setGpsStatus] = useState('SEARCHING...');
  const [activeTab, setActiveTab] = useState<'MAP' | 'ALERTS' | 'OFFLINE' | 'USER'>('MAP');
  const [offlineMode, setOfflineMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHazardAlert, setShowHazardAlert] = useState(true);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Initialize Leaflet map
    mapInstance.current = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([48.8584, 2.2945], 13);

    // Dark tactical tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png').addTo(
      mapInstance.current
    );

    setTimeout(() => {
      mapInstance.current?.invalidateSize();
    }, 250);

    // --- REAL GPS TRACKING LOGIC ---
    const startTracking = async () => {
      try {
        await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 10000 },
          (position) => {
            if (position) {
              const { latitude, longitude, altitude } = position.coords;

              // 1. Update telemetry state
              setUserPosition({ lat: latitude, lng: longitude, alt: altitude || 0 });
              setGpsStatus('SIGNAL FIX');

              // 2. Update visual marker on map
              if (mapInstance.current) {
                if (userMarker.current) {
                  userMarker.current.setLatLng([latitude, longitude]);
                } else {
                  // Blue glowing dot for user position (matches mockup)
                  const icon = L.divIcon({
                    className: '',
                    html: `<div style="
                      width:14px; height:14px;
                      background:#4A9EFF;
                      border:2px solid #fff;
                      border-radius:50%;
                      box-shadow: 0 0 10px #4A9EFF, 0 0 20px rgba(74,158,255,0.4);
                    "></div>`,
                    iconSize: [14, 14],
                    iconAnchor: [7, 7],
                  });
                  userMarker.current = L.marker([latitude, longitude], { icon }).addTo(
                    mapInstance.current
                  );
                  // Center map on first GPS fix
                  mapInstance.current.setView([latitude, longitude], 15);
                }
              }
            }
          }
        );
      } catch {
        setGpsStatus('GPS ERROR');
      }
    };

    startTracking();

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  return (
    <div
      style={{ fontFamily: "'Rajdhani', 'Space Grotesk', sans-serif" }}
      className="flex flex-col h-screen w-full bg-[#0A0A0A] text-white overflow-hidden"
    >
      {/* ─── HEADER ─────────────────────────────────────────────────── */}
      <header className="flex justify-between items-center px-4 py-2 bg-[#111111] border-b border-[#2A2A2A] z-[1000] relative">
        {/* Hamburger menu */}
        <button className="text-white opacity-70 hover:opacity-100 transition-opacity mr-3">
          <span className="material-symbols-outlined text-xl">menu</span>
        </button>

        {/* Title */}
        <h1
          className="flex-1 text-[#CC0000] text-base font-black uppercase tracking-[0.2em]"
          style={{ letterSpacing: '0.18em' }}
        >
          COMMAND CENTER
        </h1>

        {/* SOS button - top right, red pill */}
        <button className="bg-[#CC0000] text-white text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-sm hover:bg-red-700 active:bg-red-900 transition-colors shadow-[0_0_12px_rgba(204,0,0,0.5)]">
          SOS
        </button>
      </header>

      {/* ─── SEARCH BAR ─────────────────────────────────────────────── */}
      <div className="flex items-center px-3 py-2 bg-[#111111] border-b border-[#2A2A2A] z-[999] gap-2">
        {/* Search input */}
        <div className="flex items-center flex-1 bg-[#1A1A1A] border border-[#333] px-3 py-2 gap-2">
          <span className="material-symbols-outlined text-[#888] text-base">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="SEARCH COORDINATES OR LOCATION..."
            className="bg-transparent text-[#888] text-[10px] font-semibold uppercase tracking-widest w-full outline-none placeholder-[#555]"
          />
        </div>

        {/* Offline mode toggle */}
        <button
          onClick={() => setOfflineMode((v) => !v)}
          className={`flex flex-col items-center justify-center border px-3 py-1.5 text-[9px] font-black uppercase tracking-widest transition-colors min-w-[58px] ${
            offlineMode
              ? 'border-[#CC0000] bg-[#CC0000]/10 text-[#CC0000]'
              : 'border-[#333] bg-[#1A1A1A] text-[#666]'
          }`}
        >
          <span className="material-symbols-outlined text-sm mb-0.5">wifi_off</span>
          OFFLINE
          <span className="text-[8px] leading-none">MODE</span>
        </button>
      </div>

      {/* ─── MAIN CONTENT ───────────────────────────────────────────── */}
      <main className="flex-1 relative overflow-hidden">

        {/* MAP layer */}
        <div ref={mapRef} className="absolute inset-0 z-0" />

        {/* ── LEFT TELEMETRY PANEL ──────────────────────────────────── */}
        <div className="absolute top-3 left-3 z-[1000] pointer-events-none flex flex-col gap-1.5 w-[180px]">

          {/* LATITUDE */}
          <div className="bg-[#0D0D0D]/90 border-l-4 border-[#CC0000] px-3 py-2">
            <div className="text-[#888] text-[8px] font-bold uppercase tracking-[0.15em] mb-0.5">
              LATITUDE
            </div>
            <div className="text-[#F0C040] text-[15px] font-black tracking-wide leading-tight">
              {userPosition.lat !== 0 ? `${userPosition.lat.toFixed(4)} N` : '48.8584° N'}
            </div>
          </div>

          {/* LONGITUDE */}
          <div className="bg-[#0D0D0D]/90 border-l-4 border-[#CC0000] px-3 py-2">
            <div className="text-[#888] text-[8px] font-bold uppercase tracking-[0.15em] mb-0.5">
              LONGITUDE
            </div>
            <div className="text-[#F0C040] text-[15px] font-black tracking-wide leading-tight">
              {userPosition.lng !== 0 ? `${userPosition.lng.toFixed(4)} E` : '2.2945° E'}
            </div>
          </div>

          {/* ALTITUDE */}
          <div className="bg-[#0D0D0D]/90 border-l-4 border-[#CC0000] px-3 py-2">
            <div className="text-[#888] text-[8px] font-bold uppercase tracking-[0.15em] mb-0.5">
              ALTITUDE
            </div>
            <div className="text-[#F0C040] text-[15px] font-black tracking-wide leading-tight">
              {userPosition.alt !== 0
                ? `${userPosition.alt.toFixed(0)} M`
                : '1,244 M'}
            </div>
          </div>
        </div>

        {/* ── RIGHT MAP CONTROLS ────────────────────────────────────── */}
        <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
          {/* Layers */}
          <button
            onClick={() => mapInstance.current?.setZoom((mapInstance.current?.getZoom() ?? 13))}
            className="w-10 h-10 bg-[#0D0D0D]/90 border border-[#333] flex items-center justify-center hover:border-[#CC0000] transition-colors"
          >
            <span className="material-symbols-outlined text-[#888] text-lg">layers</span>
          </button>

          {/* Re-center on user */}
          <button
            onClick={() => {
              if (mapInstance.current && userPosition.lat !== 0) {
                mapInstance.current.setView([userPosition.lat, userPosition.lng], 15);
              }
            }}
            className="w-10 h-10 bg-[#0D0D0D]/90 border border-[#333] flex items-center justify-center hover:border-[#CC0000] transition-colors"
          >
            <span className="material-symbols-outlined text-[#888] text-lg">my_location</span>
          </button>

          {/* Compass / rotation */}
          <button className="w-10 h-10 bg-[#0D0D0D]/90 border border-[#333] flex items-center justify-center hover:border-[#CC0000] transition-colors">
            <span className="material-symbols-outlined text-[#888] text-lg">explore</span>
          </button>
        </div>

        {/* GPS status badge */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000]">
          <div
            className={`text-[9px] font-black uppercase tracking-widest px-2.5 py-1 border ${
              gpsStatus === 'SIGNAL FIX'
                ? 'border-green-600 text-green-400 bg-green-900/20'
                : 'border-[#555] text-[#888] bg-[#0D0D0D]/80'
            }`}
          >
            {gpsStatus}
          </div>
        </div>

        {/* ── HAZARD ALERT BANNER ───────────────────────────────────── */}
        {showHazardAlert && (
          <div className="absolute bottom-3 left-3 right-[80px] z-[1000]">
            <div className="bg-[#CC0000] px-3 py-2.5 flex items-start gap-2 shadow-[0_0_20px_rgba(204,0,0,0.4)]">
              {/* Warning icon */}
              <span className="material-symbols-outlined text-white text-base mt-0.5 flex-shrink-0">
                warning
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-white text-[9px] font-black uppercase tracking-[0.15em] mb-0.5">
                  ▲ HAZARD ALERT
                </div>
                <div className="text-white/90 text-[9px] font-semibold uppercase tracking-wide leading-snug">
                  EXTREME TERRAIN ALERT.{'\n'}AVALANCHE RISK IN SECTOR 7G.{'\n'}EMERGENCY PROTOCOLS ACTIVE.
                </div>
              </div>
              {/* Dismiss button */}
              <button
                onClick={() => setShowHazardAlert(false)}
                className="text-white/60 hover:text-white text-base flex-shrink-0 leading-none"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* ── SOS FLOATING BUTTON ──────────────────────────────────── */}
        <div className="absolute bottom-3 right-3 z-[1000]">
          <button className="w-16 h-16 rounded-full bg-[#CC0000] border-4 border-[#FF2020] flex flex-col items-center justify-center shadow-[0_0_20px_rgba(204,0,0,0.7)] active:scale-95 transition-transform">
            <span className="material-symbols-outlined text-white text-2xl">wifi_tethering</span>
            <span className="text-white text-[9px] font-black uppercase tracking-widest mt-0.5">
              SOS
            </span>
          </button>
        </div>
      </main>

      {/* ─── BOTTOM NAVIGATION ──────────────────────────────────────── */}
      <nav className="flex items-stretch h-16 bg-[#111111] border-t border-[#2A2A2A] z-[1000]">
        {(
          [
            { id: 'MAP', icon: 'map', label: 'MAP' },
            { id: 'ALERTS', icon: 'notifications_active', label: 'ALERTS' },
            { id: 'OFFLINE', icon: 'download', label: 'OFFLINE' },
            { id: 'USER', icon: 'person', label: 'USER' },
          ] as const
        ).map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === id
                ? 'bg-[#1A0000] border-t-2 border-[#CC0000] text-[#F0C040]'
                : 'text-[#555] hover:text-[#888]'
            }`}
          >
            <span className="material-symbols-outlined text-xl">{icon}</span>
            <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}