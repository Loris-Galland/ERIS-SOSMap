import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { createOfflineLayer, MAP_STYLES } from '../utils/MapUtils';
import { useTranslation } from 'react-i18next';

interface OfflineMapViewerProps {
  name: string;
  bounds: L.LatLngBounds;
  onClose: () => void;
}

export default function OfflineMapViewer({ name, bounds, onClose }: OfflineMapViewerProps) {
  const { t } = useTranslation();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<any>(null);

  // Layer Menu States
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [currentMapStyle, setCurrentMapStyle] = useState<string>('dark');

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      // Map initialization
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).fitBounds(bounds);

      // Add offline layer and save reference
      baseLayerRef.current = createOfflineLayer();
      baseLayerRef.current.addTo(mapInstanceRef.current);

      // Fix frequent rendering bug (gray blocks)
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 250);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        baseLayerRef.current = null;
      }
    };
  }, [bounds]);

  // Handle Layer Swap
  const changeMapStyle = (styleKey: string) => {
    setCurrentMapStyle(styleKey);
    if (baseLayerRef.current) {
      // Switch the URL of the existing offline layer
      baseLayerRef.current.setUrl(MAP_STYLES[styleKey as keyof typeof MAP_STYLES].url);
    }
    setShowLayerMenu(false);
  };

  return (
    <div className="fixed inset-0 z-[6000] bg-[#0f141e] flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Internal header for Map view */}
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
            <p className="text-blue-400 text-[10px] font-bold uppercase tracking-tighter">
              {t('offlineViewer.offlineMode')}
            </p>
          </div>
        </div>
      </header>

      {/* Map container */}
      <div className="relative flex-1 w-full h-full">
        <div ref={mapContainerRef} className="absolute inset-0 z-0" />

        {/* ─── MAP CONTROLS (LAYERS) ─── */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-3">
          <div className="relative">
            <button
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              className={`w-12 h-12 border border-gray-700/50 rounded-full flex items-center justify-center transition-colors shadow-lg active:scale-95 ${
                showLayerMenu ? 'bg-gray-800 text-white' : 'bg-gray-900/90 text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="material-symbols-outlined text-xl">layers</span>
            </button>

            {/* Layers Dropdown */}
            {showLayerMenu && (
              <div className="absolute right-14 top-0 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col w-44 z-[1000] animate-in fade-in zoom-in duration-150">
                <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-700">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t('offlineViewer.mapType')}
                  </span>
                </div>
                {Object.entries(MAP_STYLES).map(([key, style]) => (
                  <button
                    key={key}
                    onClick={() => changeMapStyle(key)}
                    className={`px-4 py-3 text-left text-xs font-bold flex items-center gap-3 border-b border-gray-800/50 last:border-0 transition-colors ${
                      currentMapStyle === key ? 'text-blue-400 bg-gray-800/80' : 'text-gray-300 hover:bg-gray-800/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{style.icon}</span>
                    {/* fallback on style.name if translation key doesn't exist yet */}
                    {t(`mapStyles.${key}`, style.name)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Small floating indicator at the bottom */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-gray-900/80 backdrop-blur-md border border-gray-700 px-4 py-2 rounded-full shadow-2xl">
        <p className="text-white text-[11px] font-medium flex items-center gap-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          {t('offlineViewer.viewingLocal')}
        </p>
      </div>
    </div>
  );
}
