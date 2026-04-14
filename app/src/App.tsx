import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

function App() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  
  // État pour la télémétrie
  const [position, setPosition] = useState({ lat: 16.074, lng: 108.223 }); // Coordonnées par défaut (Da Nang)
  const [isSosActive, setIsSosActive] = useState(false);

  useEffect(() => {
    // Si la carte est déjà initialisée ou si la div n'est pas prête, on arrête
    if (!mapRef.current || mapInstance.current) return;

    // 1. Initialisation de la carte Leaflet
    mapInstance.current = L.map(mapRef.current, {
      zoomControl: false, // Design épuré
      attributionControl: false
    }).setView([position.lat, position.lng], 13);

    // 2. Ajout des tuiles (Préparation pour la Phase 2 : Cartes hors-ligne)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance.current);

    // 3. Écouteur de mouvement pour mettre à jour la télémétrie
    mapInstance.current.on('move', () => {
      const center = mapInstance.current!.getCenter();
      setPosition({ lat: center.lat, lng: center.lng });
    });

    // Nettoyage lors du démontage du composant
    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  const handleSosClick = () => {
    setIsSosActive(true);
    // Plus tard : Appel au plugin Capacitor pour l'envoi au backend
    alert("ALERTE SOS : Envoi des coordonnées...");
  };

  return (
    <div className="relative h-screen w-full bg-[#121212] text-white overflow-hidden font-sans">
      
      {/* Conteneur de la Carte */}
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* Overlay Télémétrie (Haut) */}
      <div className="absolute top-0 left-0 w-full z-10 p-4 pointer-events-none">
        <div 
          className={`bg-[#1E1E1E]/95 border-l-4 ${isSosActive ? 'border-[#D32F2F]' : 'border-[#F3DF2E]'} p-4 flex justify-between items-center transition-colors duration-300`} 
          style={{ borderRadius: '0px' }}
        >
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${isSosActive ? 'text-[#D32F2F]' : 'text-[#F3DF2E]'}`}>
              Position Actuelle
            </p>
            <div className="flex gap-4 mt-1">
              <div><span className="text-gray-400 text-xs">LAT:</span> <span className="font-mono text-sm ml-1">{position.lat.toFixed(5)}</span></div>
              <div><span className="text-gray-400 text-xs">LON:</span> <span className="font-mono text-sm ml-1">{position.lng.toFixed(5)}</span></div>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Signal GPS</p>
            <p className={`${isSosActive ? 'text-[#D32F2F]' : 'text-[#F3DF2E]'} font-bold`}>FORT</p>
          </div>
        </div>
      </div>

      {/* Bouton d'Action SOS (Bas) */}
      <button 
        onClick={handleSosClick}
        className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-20 ${isSosActive ? 'bg-red-700 animate-pulse' : 'bg-[#D32F2F] hover:bg-red-700'} text-white px-12 py-5 font-bold text-2xl tracking-tighter uppercase active:scale-95 transition-all shadow-2xl`} 
        style={{ borderRadius: '0px' }}
      >
        {isSosActive ? 'SOS ACTIF' : 'LANCER SOS'}
      </button>

    </div>
  );
}

export default App;