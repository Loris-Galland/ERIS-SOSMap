import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { createOfflineLayer } from '../utils/MapUtils';

interface OfflineMapViewerProps {
  name: string;
  bounds: L.LatLngBounds;
  onClose: () => void;
}

export default function OfflineMapViewer({ name, bounds, onClose }: OfflineMapViewerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      // 1. Initialisation de la carte
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false, // On peut le désactiver pour un look plus "App"
        attributionControl: false,
      }).fitBounds(bounds);

      // 2. Ajout de la couche hors-ligne
      createOfflineLayer().addTo(mapInstanceRef.current);

      // 3. Correction du bug de rendu fréquent (blocs gris)
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 250);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [bounds]);

  return (
    <div className="fixed inset-0 z-[6000] bg-[#0f141e] flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Header interne à la vue Map */}
      <header className="flex justify-between items-center px-6 py-4 bg-[#0f141e]/90 backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-gray-800 rounded-full text-white active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="text-white font-bold">{name}</h2>
            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-tighter">Mode Hors-ligne</p>
          </div>
        </div>
      </header>

      {/* Le conteneur de la carte */}
      <div ref={mapContainerRef} className="flex-1 w-full h-full" />

      {/* Petit indicateur flottant en bas */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-gray-900/80 backdrop-blur-md border border-gray-700 px-4 py-2 rounded-full shadow-2xl">
        <p className="text-white text-[11px] font-medium flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          Visualisation des données locales
        </p>
      </div>
    </div>
  );
}
