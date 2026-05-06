import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { createOfflineLayer, MAP_STYLES } from '../../../utils/MapUtils';

interface ManualZoneSelectorProps {
  t: any;
  onClose: () => void;
  onConfirmArea: (bounds: L.LatLngBounds) => void;
}

export default function ManualZoneSelector({ t, onClose, onConfirmArea }: ManualZoneSelectorProps) {
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualSearchResults, setManualSearchResults] = useState<any[]>([]);
  const [isManualSearching, setIsManualSearching] = useState(false);
  const selectionMapRef = useRef<L.Map | null>(null);
  const selectionContainerRef = useRef<HTMLDivElement>(null);

  // --- SELECTION MAP INITIALIZATION LOGIC ---
  useEffect(() => {
    if (selectionContainerRef.current && !selectionMapRef.current) {
      selectionMapRef.current = L.map(selectionContainerRef.current, {
        zoomControl: false,
      }).setView([46.6033, 1.8883], 6); // Centered on France

      const theme = localStorage.getItem('eris_theme') || 'dark';
      const styleKey = theme === 'light' ? 'light' : theme === 'contrasted' ? 'contrasted' : 'dark';
      const styleUrl = MAP_STYLES[styleKey as keyof typeof MAP_STYLES].url;

      createOfflineLayer(styleUrl).addTo(selectionMapRef.current);
      setTimeout(() => selectionMapRef.current?.invalidateSize(), 200);
    }
    return () => {
      if (selectionMapRef.current) {
        selectionMapRef.current.remove();
        selectionMapRef.current = null;
      }
    };
  }, []);

  // --- SEARCH LOGIC IN THE OVERLAY ---
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!manualSearchQuery.trim()) {
        setManualSearchResults([]);
        return;
      }
      setIsManualSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(manualSearchQuery)}&limit=4`,
        );
        const data = await res.json();
        setManualSearchResults(data);
      } catch (e) {
        console.error('Erreur recherche manuelle', e);
      } finally {
        setIsManualSearching(false);
      }
    }, 600);
    return () => clearTimeout(delayDebounceFn);
  }, [manualSearchQuery]);

  const handleManualSearchResultClick = (item: any) => {
    if (!selectionMapRef.current) return;
    const bbox = item.boundingbox;
    const bounds = L.latLngBounds(
      [parseFloat(bbox[0]), parseFloat(bbox[2])],
      [parseFloat(bbox[1]), parseFloat(bbox[3])],
    );

    const exactLat = parseFloat(item.lat);
    const exactLon = parseFloat(item.lon);

    const targetZoom = Math.min(selectionMapRef.current.getBoundsZoom(bounds), 14);

    selectionMapRef.current.flyTo([exactLat, exactLon], targetZoom, {
      animate: true,
      duration: 1.5,
    });

    setManualSearchQuery('');
    setManualSearchResults([]);
  };

  const handleConfirm = () => {
    if (!selectionMapRef.current) return;
    const bounds = selectionMapRef.current.getBounds();
    onConfirmArea(bounds);
  };

  return (
    <div className="absolute inset-0 z-[7000] flex flex-col bg-eris-bg animate-in slide-in-from-bottom duration-300">
      <header className="px-4 py-4 bg-eris-bg/95 backdrop-blur-md z-[50] shadow-md border-b border-eris-border">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center bg-eris-surface-alt rounded-full text-eris-text active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
          <div className="flex-1">
            <h2 className="text-eris-text text-sm font-bold">{t('download.manualSaving', 'Manual saving')}</h2>
            <p className="text-eris-text-muted text-[10px]">
              {t('download.searchOrMove', 'Search a place or move the map')}
            </p>
          </div>
          <button
            onClick={handleConfirm}
            className="bg-eris-primary text-eris-text px-4 py-2 rounded-xl text-xs font-bold shadow-lg active:scale-95 transition-transform"
          >
            {t('download.saveZone', 'Save this zone')}
          </button>
        </div>

        {/* SEARCH BAR */}
        <div className="relative">
          <div className="flex items-center bg-eris-surface-alt/60 border border-eris-border/50 rounded-full px-4 py-2 gap-2">
            <span className="material-symbols-outlined text-eris-text-muted text-sm">search</span>
            <input
              type="text"
              value={manualSearchQuery}
              onChange={(e) => setManualSearchQuery(e.target.value)}
              placeholder={t('download.searchPlace', 'Find a place to download...')}
              className="bg-transparent text-xs text-eris-text w-full outline-none"
            />
            {isManualSearching && (
              <span className="material-symbols-outlined text-eris-primary text-sm animate-spin">sync</span>
            )}
          </div>

          {/* SEARCH RESULTS */}
          {manualSearchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-eris-surface border border-eris-border rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[100]">
              {manualSearchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => handleManualSearchResultClick(result)}
                  className="px-4 py-3 text-left hover:bg-eris-surface-alt flex items-center gap-3 border-b border-eris-border last:border-0"
                >
                  <span className="material-symbols-outlined text-eris-text-muted text-sm">location_on</span>
                  <div className="flex-col overflow-hidden">
                    <span className="text-eris-text text-xs font-bold block truncate">
                      {result.display_name.split(',')[0]}
                    </span>
                    <span className="text-eris-text-subtle text-[9px] block truncate">{result.display_name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* MAP CONTAINER */}
      <div className="flex-1 w-full relative bg-eris-surface">
        <div className="absolute inset-0" ref={selectionContainerRef}></div>

        {/* VISUAL OVERLAY */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[10]">
          <div className="w-[85%] h-[65%] border-2 border-eris-primary/40 rounded-3xl shadow-[0_0_0_9999px_rgba(15,20,30,0.5)]"></div>
        </div>
      </div>
    </div>
  );
}
