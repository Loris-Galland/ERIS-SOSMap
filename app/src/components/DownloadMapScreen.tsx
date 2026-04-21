import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { createOfflineLayer, PRESET_REGIONS } from '../utils/MapUtils';

interface DownloadMapScreenProps {
  onBack: () => void;
  map: L.Map | null;
}

export default function DownloadMapScreen({ onBack }: DownloadMapScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [downloadingId, setDownloadingId] = useState<number | string | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloadedRegions, setDownloadedRegions] = useState<(number | string)[]>([]);

  const [customRegions, setCustomRegions] = useState<any[]>([]);

  const [isManualSelecting, setIsManualSelecting] = useState(false);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualSearchResults, setManualSearchResults] = useState<any[]>([]);
  const [isManualSearching, setIsManualSearching] = useState(false);

  const selectionMapRef = useRef<L.Map | null>(null);
  const selectionContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('eris_offline_regions');
    if (saved) {
      try {
        setDownloadedRegions(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }

    const savedCustom = localStorage.getItem('eris_custom_regions');
    if (savedCustom) {
      try {
        setCustomRegions(JSON.parse(savedCustom));
      } catch (e) {
        console.error(e);
      }
    }
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
    selectionMapRef.current.fitBounds(bounds, { animate: true });
    setManualSearchQuery('');
    setManualSearchResults([]);
  };

  // --- SELECTION MAP INITIALIZATION LOGIC ---
  useEffect(() => {
    if (isManualSelecting && selectionContainerRef.current && !selectionMapRef.current) {
      selectionMapRef.current = L.map(selectionContainerRef.current, {
        zoomControl: false,
      }).setView([46.6033, 1.8883], 6); // Centered on France

      createOfflineLayer().addTo(selectionMapRef.current);
      setTimeout(() => selectionMapRef.current?.invalidateSize(), 200);
    }
    return () => {
      if (selectionMapRef.current && !isManualSelecting) {
        selectionMapRef.current.remove();
        selectionMapRef.current = null;
      }
    };
  }, [isManualSelecting]);

  const handleConfirmManualArea = () => {
    if (!selectionMapRef.current) return;

    const bounds = selectionMapRef.current.getBounds();
    const zoom = selectionMapRef.current.getZoom();

    // On demande un nom à l'utilisateur
    const customName = window.prompt('Name this personnalized zone :', 'My Zone');

    if (customName && customName.trim() !== '') {
      const customId = `custom_${Date.now()}`; // ID unique basé sur le temps

      const newCustomRegion = {
        id: customId,
        name: customName,
        size: 'Custom Area',
        bounds: {
          southWest: [bounds.getSouthWest().lat, bounds.getSouthWest().lng],
          northEast: [bounds.getNorthEast().lat, bounds.getNorthEast().lng],
        },
      };

      const updatedCustomRegions = [newCustomRegion, ...customRegions];
      setCustomRegions(updatedCustomRegions);
      localStorage.setItem('eris_custom_regions', JSON.stringify(updatedCustomRegions));

      setIsManualSelecting(false);
      handleDownload(customId, customName, bounds);
    }
  };

  const saveRegionAsDownloaded = (id: number | string) => {
    setDownloadedRegions((prev) => {
      const updated = prev.includes(id) ? prev : [...prev, id];
      localStorage.setItem('eris_offline_regions', JSON.stringify(updated));
      return updated;
    });

    const savedMetadata = localStorage.getItem('eris_offline_metadata');
    const metadata = savedMetadata ? JSON.parse(savedMetadata) : {};
    metadata[id] = {
      lastUpdate: Date.now(),
    };

    localStorage.setItem('eris_offline_metadata', JSON.stringify(metadata));
  };

  const removeRegionFromDownloaded = (id: number | string) => {
    setDownloadedRegions((prev) => {
      const updated = prev.filter((regionId) => regionId !== id);
      localStorage.setItem('eris_offline_regions', JSON.stringify(updated));
      return updated;
    });
  };

  // Downloading fonction linked to the ID of the region
  const handleDownload = (id: number | string, name: string, customBounds?: L.LatLngBounds) => {
    let bounds = customBounds;

    if (!bounds) {
      if (typeof id === 'number') {
        bounds = PRESET_REGIONS.find((r) => r.id === id)?.bounds; // <-- MODIFIÉ ICI
      } else {
        const customReg = customRegions.find((r) => r.id === id);
        if (customReg) {
          bounds = L.latLngBounds(customReg.bounds.southWest, customReg.bounds.northEast);
        }
      }
    }

    if (!bounds) return;

    setDownloadingId(id);
    setProgress(0);

    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'width:256px; height:256px; position:fixed; top:-9999px;';
    document.body.appendChild(tempDiv);

    const tempMap = L.map(tempDiv, { fadeAnimation: false, zoomAnimation: false, inertia: false });
    tempMap.fitBounds(bounds, { animate: false });

    // 1. Création de la couche hors ligne
    const layer = createOfflineLayer().addTo(tempMap);

    // 2. Configuration du contrôleur de sauvegarde (plugin leaflet.offline)
    const control = (L.control as any).savetiles(layer, {
      zoomlevels: [12, 13, 14, 15], // Niveaux de zoom optimisés pour ERIS
      confirm: (offlineLayer: any, successCallback: () => void) => {
        const tilesToSave = offlineLayer._tilesforSave || [];
        const count = tilesToSave.length;

        if (count === 0) {
          alert('No tiles found for this area. Check your zoom levels.');
          cleanup();
          return false;
        }

        if (window.confirm(`Download ${count} tiles for ${name}?`)) {
          successCallback();
        } else {
          cleanup(); // Reset si l'utilisateur annule
        }
      },
      confirmNoTiles: () => {
        alert('This zone is already downloaded');
        saveRegionAsDownloaded(id);
        cleanup();
      },
    });

    control.addTo(tempMap);

    const cleanup = () => {
      setDownloadingId(null);
      if (tempMap) {
        tempMap.remove();
      }
      if (document.body.contains(tempDiv)) {
        document.body.removeChild(tempDiv);
      }
    };

    let totalTiles = 0;
    let savedTiles = 0;

    // 3. Gestion des événements pour l'interface
    layer.on('savestart', (e: any) => {
      totalTiles = e.length || (e._tilesforSave ? e._tilesforSave.length : 0);
    });

    layer.on('savetileend', () => {
      savedTiles++;
      if (totalTiles > 0) {
        const percent = Math.floor((savedTiles / totalTiles) * 100);
        setProgress(percent);
      }
    });

    layer.on('saveend', () => {
      setProgress(100);
      alert(`Success : The zone ${name} is available offline.`);
      saveRegionAsDownloaded(id);
      cleanup();
    });

    layer.on('tilelayeroffline:saveerror', (err: any) => {
      console.error('Downloading error:', err);
      alert('Error during downloading. Check your connexion.');
      cleanup();
    });

    // 4. Lancement du téléchargement
    tempMap.whenReady(() => {
      setTimeout(() => {
        try {
          // On passe explicitement les bounds au plugin
          control._saveTiles();
        } catch (e) {
          console.error('Erreur interne SaveTiles:', e);
          cleanup();
        }
      }, 500);
    });
  };

  const handleDelete = (id: number, name: string) => {
    if (window.confirm(`Are you sure you want to delete ${name} offline data?`)) {
      removeRegionFromDownloaded(id);
      alert(`${name} removed from your offline maps.`);
    }
  };

  const displayRegions = [...customRegions, ...PRESET_REGIONS];

  const filteredRegions = displayRegions.filter((region) =>
    region.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full bg-[#0f141e] w-full overflow-y-auto font-sans relative pb-20">
      {/* ─── MANUAL SELECTION OVERLAY ─── */}
      {isManualSelecting && (
        <div className="absolute inset-0 z-[7000] flex flex-col bg-[#0f141e] animate-in slide-in-from-bottom duration-300">
          <header className="px-4 py-4 bg-[#0f141e]/95 backdrop-blur-md z-[50] shadow-md border-b border-gray-800">
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => setIsManualSelecting(false)}
                className="w-10 h-10 flex items-center justify-center bg-gray-800 rounded-full text-white"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              <div className="flex-1">
                <h2 className="text-white text-sm font-bold">Manual saving</h2>
                <p className="text-gray-400 text-[10px]">Search a place or move the map</p>
              </div>
              <button
                onClick={handleConfirmManualArea}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-lg active:scale-95"
              >
                Save this zone
              </button>
            </div>

            {/* BARRE DE RECHERCHE INTERNE */}
            <div className="relative">
              <div className="flex items-center bg-gray-800/60 border border-gray-700/50 rounded-full px-4 py-2 gap-2">
                <span className="material-symbols-outlined text-gray-400 text-sm">search</span>
                <input
                  type="text"
                  value={manualSearchQuery}
                  onChange={(e) => setManualSearchQuery(e.target.value)}
                  placeholder="Trouver une ville à sauvegarder..."
                  className="bg-transparent text-xs text-white w-full outline-none"
                />
                {isManualSearching && (
                  <span className="material-symbols-outlined text-blue-400 text-sm animate-spin">sync</span>
                )}
              </div>

              {/* RÉSULTATS DE RECHERCHE INTERNE */}
              {manualSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[100]">
                  {manualSearchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleManualSearchResultClick(result)}
                      className="px-4 py-3 text-left hover:bg-gray-800 flex items-center gap-3 border-b border-gray-800 last:border-0"
                    >
                      <span className="material-symbols-outlined text-gray-400 text-sm">location_on</span>
                      <div className="flex-col overflow-hidden">
                        <span className="text-white text-xs font-bold block truncate">
                          {result.display_name.split(',')[0]}
                        </span>
                        <span className="text-gray-500 text-[9px] block truncate">{result.display_name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </header>

          <div className="flex-1 w-full relative bg-gray-900">
            <div className="absolute inset-0" ref={selectionContainerRef}></div>
            {/* Viseur central */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-[10]">
              <div className="w-[85%] h-[65%] border-2 border-blue-500/40 rounded-3xl shadow-[0_0_0_9999px_rgba(15,20,30,0.5)]"></div>
            </div>
          </div>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <header className="flex justify-between items-center px-6 py-4 sticky top-0 z-50 bg-[#0f141e]/90 backdrop-blur-md">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="text-gray-400 hover:text-white transition-colors mr-4 active:scale-95 flex items-center justify-center w-10 h-10 bg-gray-800/50 rounded-full"
          >
            <span className="material-symbols-outlined">chevron_left</span>
          </button>
          <h2 className="text-white text-xl font-bold tracking-wide">Download Maps</h2>
        </div>

        {/* Custom Area Map Button (Top Right) */}
        <button
          onClick={() => setIsManualSelecting(true)}
          className="text-blue-400 hover:text-blue-300 transition-colors flex items-center justify-center w-10 h-10 bg-blue-500/10 rounded-full active:scale-95"
          title="Select Custom Area"
        >
          <span className="material-symbols-outlined text-xl">map</span>
        </button>
      </header>

      <div className="px-4 flex flex-col gap-6 mt-2">
        {/* ─── SEARCH BAR ─── */}
        <div className="flex items-center bg-gray-800/40 border border-gray-700/50 rounded-2xl px-4 py-3 gap-3 shadow-inner">
          <span className="material-symbols-outlined text-gray-400 text-xl">search</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search city or region..."
            className="bg-transparent text-sm text-white w-full outline-none placeholder-gray-500"
          />
        </div>

        {/* ─── SUGGESTIONS LIST ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">Suggested Regions</h3>

          <div className="flex flex-col gap-3">
            {filteredRegions.length > 0 ? (
              filteredRegions.map((region) => {
                const isDownloaded = downloadedRegions.includes(region.id);
                const isDownloadingThis = downloadingId === region.id;
                const isCustom = typeof region.id === 'string' && region.id.startsWith('custom');

                return (
                  <div
                    key={region.id}
                    className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-4 flex items-center justify-between shadow-sm"
                  >
                    <div className="flex items-center gap-4">
                      {/* Location Icon */}
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-gray-700/50 text-gray-400">
                        <span className="material-symbols-outlined text-xl">
                          {isDownloaded ? 'offline_pin' : isCustom ? 'dashboard_customize' : 'location_city'}
                        </span>
                      </div>

                      {/* Region Info */}
                      <div>
                        <h4 className="text-white text-sm font-bold mb-0.5">{region.name}</h4>
                        <p className="text-gray-500 text-[11px] font-medium">
                          {isDownloadingThis
                            ? `Downloading... ${progress}%`
                            : isDownloaded
                              ? 'Available Offline'
                              : `${region.size} • Map & Navigation Data`}
                        </p>
                      </div>
                    </div>

                    {/* Buttons (Download / Loading / Delete) */}
                    <div className="flex items-center gap-2">
                      {isDownloadingThis ? (
                        <button
                          disabled
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-500/20 text-yellow-500 animate-pulse shrink-0"
                        >
                          <span className="material-symbols-outlined text-xl">sync</span>
                        </button>
                      ) : isDownloaded ? (
                        <button
                          onClick={() => handleDelete(region.id, region.name)}
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all shrink-0"
                          title="Delete Zone"
                        >
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownload(region.id, region.name)}
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 transition-all shrink-0"
                          title="Download Zone"
                        >
                          <span className="material-symbols-outlined text-xl">download</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-gray-500 text-sm">Aucune région trouvée pour "{searchQuery}"</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
