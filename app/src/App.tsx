import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Geolocation } from '@capacitor/geolocation';

export default function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const userMarker = useRef<L.Marker | null>(null);

  // État pour la position RÉELLE
  const [userPosition, setUserPosition] = useState({ lat: 0, lng: 0, alt: 0 });
  const [gpsStatus, setGpsStatus] = useState('RECHERCHE...');

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Initialisation de la carte
    mapInstance.current = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([16.074, 108.223], 14);

    // Lien de carte
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png').addTo(mapInstance.current);

    setTimeout(() => {
      mapInstance.current?.invalidateSize();
    }, 250);

    // --- LOGIQUE DE SUIVI GPS RÉEL ---
    const startTracking = async () => {
      try {
        await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 10000,
          },
          (position) => {
            if (position) {
              const { latitude, longitude, altitude } = position.coords;

              // 1. Mise à jour de la télémétrie
              setUserPosition({
                lat: latitude,
                lng: longitude,
                alt: altitude || 0,
              });
              setGpsStatus('SIGNAL FIX');

              // 2. Mise à jour du marqueur visuel
              if (mapInstance.current) {
                if (userMarker.current) {
                  userMarker.current.setLatLng([latitude, longitude]);
                } else {
                  const icon = L.divIcon({
                    className: 'user-pos-icon',
                    html: "<div style='background-color:#F3DF2E; width:12px; height:12px; border:2px solid white; border-radius:0px;'></div>",
                    iconSize: [12, 12],
                    iconAnchor: [6, 6],
                  });
                  userMarker.current = L.marker([latitude, longitude], { icon }).addTo(mapInstance.current);
                  mapInstance.current.setView([latitude, longitude], 16); // Centrer au premier fix
                }
              }
            }
          },
        );
      } catch (e) {
        setGpsStatus('ERREUR GPS');
      }
    };

    startTracking();

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-full bg-[#121212] text-white font-['Inter']">
      {/* HEADER */}
      <header className="flex justify-between items-center px-4 py-3 bg-[#201F1F] border-b-2 border-[#353534] z-[1000] relative">
        <div className="flex flex-col">
          <h1 className="font-['Space_Grotesk'] text-[#FFFFFF] text-lg font-bold tracking-widest leading-tight">
            ERIS<span className="text-[#F3DF2E]">SOS</span>
          </h1>
          <span className="font-['Space_Grotesk'] text-[#F3DF2E] text-[10px] tracking-widest uppercase">
            Tactical Node
          </span>
        </div>
        <div className="text-right flex items-center gap-2">
          <span className="text-[10px] font-bold text-[#F3DF2E]">{gpsStatus}</span>
          <span className="material-symbols-outlined text-[#F3DF2E] text-sm">sensors</span>
        </div>
      </header>

      <main className="flex-1 relative bg-[#121212] z-0 flex flex-col">
        <div ref={mapRef} className="flex-1 w-full h-full z-0" style={{ minHeight: '400px' }} />

        {/* TÉLÉMÉTRIE */}
        <div className="absolute top-4 left-4 z-[1000] pointer-events-none">
          <div className="bg-[#201F1F]/90 p-3 border-l-4 border-[#F3DF2E]" style={{ borderRadius: '0px' }}>
            <div className="text-[#FFFFFF] opacity-50 text-[10px] font-['Space_Grotesk'] uppercase tracking-widest mb-1">
              Position Réelle
            </div>
            <div className="font-mono text-xs text-[#FFFFFF]">
              <div className="mb-1">
                LAT: <span className="text-[#F3DF2E] ml-1">{userPosition.lat.toFixed(6)}</span>
              </div>
              <div className="mb-1">
                LON: <span className="text-[#F3DF2E] ml-1">{userPosition.lng.toFixed(6)}</span>
              </div>
              <div>
                ALT: <span className="text-[#F3DF2E] ml-1">{userPosition.alt.toFixed(1)} m</span>
              </div>
            </div>
          </div>
        </div>

        {/* SOS BUTTON */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-11/12 max-w-sm">
          <button
            className="w-full bg-[#D32F2F] text-white py-4 font-['Space_Grotesk'] text-xl font-bold uppercase tracking-widest shadow-[0_0_15px_rgba(211,47,47,0.5)] active:bg-red-800"
            style={{ borderRadius: '0px' }}
          >
            Lancer SOS
          </button>
        </div>
      </main>

      {/* NAVIGATION */}
      <nav className="flex justify-around items-center h-20 bg-[#201F1F] z-[1000] relative">
        <button className="flex flex-col items-center justify-center bg-[#353534] text-[#F3DF2E] border-b-4 border-[#F3DF2E] flex-1 h-full">
          <span className="material-symbols-outlined text-2xl">map</span>
          <span className="text-[10px] font-bold mt-1 uppercase">MAP</span>
        </button>
        <button className="flex flex-col items-center justify-center text-[#FFFFFF] opacity-50 flex-1 h-full">
          <span className="material-symbols-outlined text-2xl">notifications_active</span>
          <span className="text-[10px] font-bold mt-1 uppercase">ALERTS</span>
        </button>
      </nav>
    </div>
  );
}
