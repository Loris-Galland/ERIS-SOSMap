/*
 * Full-screen offline map viewer component for the ERIS app.
 * Exports OfflineMapViewer (default), which renders a Leaflet map from locally
 * cached tiles using leaflet.offline. Receives a name, a LatLngBounds, and the
 * list of downloaded styles; lets the user switch between available tile layers.
 * Used by the offline feature to preview a saved map region without internet access.
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { createOfflineLayer, MAP_STYLES } from '../utils/MapUtils';
import { useTranslation } from 'react-i18next';

interface OfflineMapViewerProps {
  name: string;
  bounds: L.LatLngBounds;
  onClose: () => void;
  availableStyles?: string[];
}

export default function OfflineMapViewer({ name, bounds, onClose, availableStyles }: OfflineMapViewerProps) {
  const { t } = useTranslation();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<any>(null);

  // Layer Menu States
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [currentMapStyle, setCurrentMapStyle] = useState<string>(() => {
    const theme = localStorage.getItem('eris_theme') || 'dark';
    const preferredKey = theme === 'light' ? 'light' : theme === 'contrasted' ? 'contrasted' : 'dark';

    if (!availableStyles || availableStyles.length === 0) return preferredKey;
    if (availableStyles.includes(preferredKey)) return preferredKey;
    return availableStyles[0];
  });

  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      // Map initialization
      mapInstanceRef.current = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
      }).fitBounds(bounds);

      const initialUrl = MAP_STYLES[currentMapStyle as keyof typeof MAP_STYLES].url;

      // Add offline layer and save reference
      baseLayerRef.current = createOfflineLayer(initialUrl);
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
      // Switch the URL
      baseLayerRef.current.setUrl(MAP_STYLES[styleKey as keyof typeof MAP_STYLES].url);
    }
    setShowLayerMenu(false);
  };

  const currentTheme = localStorage.getItem('eris_theme') || 'dark';
  const defaultStyleId = currentTheme === 'light' ? 'light' : currentTheme === 'contrasted' ? 'contrasted' : 'dark';

  return (
    <div className="fixed inset-0 z-[6000] bg-eris-bg flex flex-col animate-in slide-in-from-bottom duration-300">
      {/* Internal header for Map view */}
      <header className="flex justify-between items-center px-6 pb-4 pt-[70px] bg-eris-bg/95 backdrop-blur-md z-[2000] shrink-0 border-b border-eris-border shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-eris-surface-alt rounded-full text-eris-text active:scale-90 transition-transform"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h2 className="text-eris-text font-bold">{name}</h2>
            <p className="text-eris-primary text-[10px] font-bold uppercase tracking-tighter">
              {t('offlineViewer.offlineMode')}
            </p>
          </div>
        </div>
      </header>

      {/* Map container */}
      <div className="relative flex-1 w-full h-full">
        <div className={`absolute inset-0 z-0 ${currentMapStyle === 'terrain_dark' ? 'dark-terrain-active' : ''}`}>
          <div ref={mapContainerRef} className="w-full h-full" />
        </div>

        {/* ─── MAP CONTROLS (LAYERS) ─── */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-3">
          <div className="relative">
            <button
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              className={`w-12 h-12 border border-eris-border/50 rounded-full flex items-center justify-center transition-colors shadow-lg active:scale-95 ${
                showLayerMenu
                  ? 'bg-eris-surface-alt text-eris-text'
                  : 'bg-eris-surface/90 text-eris-text-muted hover:bg-eris-surface-alt'
              }`}
            >
              <span className="material-symbols-outlined text-xl">layers</span>
            </button>

            {/* Layers Dropdown */}
            {showLayerMenu && (
              <div className="absolute right-14 top-0 bg-eris-surface/95 backdrop-blur-md border border-eris-border rounded-2xl shadow-2xl overflow-hidden flex flex-col w-44 z-[1000] animate-in fade-in zoom-in duration-150">
                <div className="px-3 py-2 bg-eris-surface-alt/50 border-b border-eris-border">
                  <span className="text-[10px] font-bold text-eris-text-muted uppercase tracking-wider">
                    {t('offlineViewer.mapType')}
                  </span>
                </div>
                {Object.entries(MAP_STYLES)
                  .sort(([keyA], [keyB]) => {
                    const currentDefault =
                      currentTheme === 'light' ? 'light' : currentTheme === 'contrasted' ? 'contrasted' : 'dark';
                    if (keyA === currentDefault) return -1;
                    if (keyB === currentDefault) return 1;
                    return 0;
                  })
                  .map(([key, style]) => {
                    const isAvailable = !availableStyles || availableStyles.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => isAvailable && changeMapStyle(key)}
                        disabled={!isAvailable}
                        className={`px-4 py-3 text-left text-xs font-bold flex items-center gap-3 border-b border-eris-border/50 last:border-0 transition-colors ${
                          !isAvailable
                            ? 'opacity-40 cursor-not-allowed text-eris-text-subtle' // if unavailable -> grey out
                            : currentMapStyle === key
                              ? 'text-eris-primary bg-eris-surface-alt/80'
                              : 'text-eris-text-muted hover:bg-eris-surface-alt/40'
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">
                          {isAvailable ? style.icon : 'cloud_off'}
                        </span>
                        <div className="flex flex-col">
                          <span>{t(`mapStyles.${key}`, style.name)}</span>
                          {!isAvailable && (
                            <span className="text-[9px] font-normal italic">
                              {t('offlineViewer.notDownloaded', 'Not downloaded')}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Small floating indicator at the bottom */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 bg-eris-surface/80 backdrop-blur-md border border-eris-border px-4 py-2 rounded-full shadow-2xl">
        <p className="text-eris-text text-[11px] font-medium flex items-center gap-2">
          <span className="w-2 h-2 bg-eris-success rounded-full animate-pulse"></span>
          {t('offlineViewer.viewingLocal')}
        </p>
      </div>
    </div>
  );
}
