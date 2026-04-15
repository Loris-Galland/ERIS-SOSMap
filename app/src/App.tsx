import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Geolocation } from '@capacitor/geolocation'; 

export default function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const userMarker = useRef<L.Marker | null>(null);
  
  const [position, setPosition] = useState({ lat: 16.074, lng: 108.223 });
  const [isTracking, setIsTracking] = useState(false);

  // Fonction pour obtenir la position réelle
  const updateCurrentLocation = async () => {
    try {
      const coordinates = await Geolocation.getCurrentPosition();
      const { latitude, longitude } = coordinates.coords;
      
      setPosition({ lat: latitude, lng: longitude });

      if (mapInstance.current) {
        // Centrer la carte sur l'utilisateur
        mapInstance.current.setView([latitude, longitude], 16);
        
        // Ajouter ou déplacer le marqueur "Tactical"
        if (userMarker.current) {
          userMarker.current.setLatLng([latitude, longitude]);
        } else {
          userMarker.current = L.marker([latitude, longitude]).addTo(mapInstance.current)
            .bindPopup("VOTRE POSITION ACTIVÉE")
            .openPopup();
        }
      }
      setIsTracking(true);
    } catch (error) {
      console.error("Erreur de géolocalisation:", error);
      alert("Impossible d'accéder au GPS. Vérifiez les permissions.");
    }
  };

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false
    }).setView([position.lat, position.lng], 14);

    // 1. Lien corrigé 
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(mapInstance.current);

    // 2. LE FIX : On force Leaflet à vérifier sa taille après 250ms
    setTimeout(() => {
      mapInstance.current?.invalidateSize();
    }, 250);

    // Mise à jour de la télémétrie lors du déplacement
    mapInstance.current.on('move', () => {
      const center = mapInstance.current!.getCenter();
      setPosition(prev => ({ ...prev, lat: center.lat, lng: center.lng }));
    });

    // On lance la géolocalisation au démarrage
    updateCurrentLocation();

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
        <button 
          onClick={updateCurrentLocation}
          className={`p-2 border-0 flex items-center justify-center transition-all ${isTracking ? 'text-[#F3DF2E]' : 'text-white'}`}
        >
          <span className="material-symbols-outlined">{isTracking ? 'my_location' : 'location_searching'}</span>
        </button>
      </header>

      {/* ZONE CARTE */}
      <main className="flex-1 relative bg-[#121212] z-0">
        <div ref={mapRef} className="flex-1 w-full h-full z-0" style={{ minHeight: '400px' }} />
        
        {/* OVERLAY TÉLÉMÉTRIE DYNAMIQUE */}
        <div className="absolute top-4 left-4 z-[1000] pointer-events-none">
          <div className="bg-[#201F1F]/90 p-3 border-l-4 border-[#F3DF2E]" style={{ borderRadius: '0px' }}>
            <div className="text-[#FFFFFF] opacity-50 text-[10px] font-['Space_Grotesk'] uppercase tracking-widest mb-1">
              Position Tactique
            </div>
            <div className="font-mono text-xs text-[#FFFFFF]">
              <div className="mb-1">LAT: <span className="text-[#F3DF2E] ml-1">{position.lat.toFixed(6)}</span></div>
              <div>LON: <span className="text-[#F3DF2E] ml-1">{position.lng.toFixed(6)}</span></div>
            </div>
          </div>
        </div>

        {/* BOUTON SOS */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-11/12 max-w-sm">
          <button className="w-full bg-[#D32F2F] text-white py-4 font-['Space_Grotesk'] text-xl font-bold uppercase tracking-widest" style={{ borderRadius: '0px' }}>
            Lancer SOS
          </button>
        </div>
      </main>

      {/* NAVIGATION BASSE */}
      <nav className="flex justify-around items-center h-20 bg-[#201F1F] z-[1000]">
        <button className="flex-1 h-full flex flex-col items-center justify-center text-[#F3DF2E] border-b-4 border-[#F3DF2E] bg-[#353534]">
          <span className="material-symbols-outlined text-2xl">map</span>
          <span className="text-[10px] font-bold mt-1">MAP</span>
        </button>
        {/* ... autres boutons ... */}
      </nav>
    </div>
  );
}