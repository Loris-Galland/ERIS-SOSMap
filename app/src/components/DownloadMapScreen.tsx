import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { createOfflineLayer, PRESET_REGIONS, MAP_STYLES } from '../utils/MapUtils';
import OfflineMapViewer from './OfflineMapViewer';

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

  const [viewingRegion, setViewingRegion] = useState<number | string | null>(null);

  const [selectedStyles, setSelectedStyles] = useState<string[]>(['dark']);

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

  const toggleStyle = (id: string) => {
    if (selectedStyles.includes(id) && selectedStyles.length === 1) return;

    setSelectedStyles((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  };

  //  Get bounds of regions
  const getBoundsForRegion = (id: number | string): L.LatLngBounds | undefined => {
    if (typeof id === 'number' || (typeof id === 'string' && !id.startsWith('custom_'))) {
      return PRESET_REGIONS.find((r) => r.id === Number(id))?.bounds;
    } else {
      const customReg = customRegions.find((r) => r.id === id);
      if (customReg) {
        return L.latLngBounds(customReg.bounds.southWest, customReg.bounds.northEast);
      }
    }
    return undefined;
  };

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

    const customName = window.prompt('Name this personnalized zone :', 'My Zone');

    if (customName && customName.trim() !== '') {
      const customId = `custom_${Date.now()}`;

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

    // --- LAYER CONFIGURATION ---
    const layer = createOfflineLayer().addTo(tempMap);

    const control = (L.control as any).savetiles(layer, {
      zoomlevels: [12, 13, 14, 15, 16, 17],
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
          cleanup();
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

    const downloadStyleLayer = (styleIndex: number) => {
      if (styleIndex >= selectedStyles.length) {
        setProgress(100);
        alert(`Success : The zone ${name} is available offline (${selectedStyles.length} layers).`);
        saveRegionAsDownloaded(id);
        cleanup();
        return;
      }

      const styleKey = selectedStyles[styleIndex];
      const styleConfig = MAP_STYLES[styleKey as keyof typeof MAP_STYLES];

      const layer = createOfflineLayer(styleConfig.url).addTo(tempMap);

      const control = (L.control as any).savetiles(layer, {
        zoomlevels: [12, 13, 14, 15],
        confirm: (offlineLayer: any, successCallback: () => void) => {
          const tilesToSave = offlineLayer._tilesforSave || [];
          const count = tilesToSave.length;

          if (count === 0) {
            if (styleIndex === 0) alert('No tiles found for this area. Check your zoom levels.');
            tempMap.removeLayer(layer);
            downloadStyleLayer(styleIndex + 1);
            return false;
          }

          if (styleIndex === 0) {
            if (
              window.confirm(
                `Download ${count} tiles per layer for ${name} (${selectedStyles.length} layers selected)?`,
              )
            ) {
              successCallback();
            } else {
              cleanup();
            }
          } else {
            successCallback();
          }
        },
        confirmNoTiles: () => {
          if (styleIndex === 0) {
            alert('This zone is already downloaded');
            saveRegionAsDownloaded(id);
            cleanup();
          } else {
            tempMap.removeLayer(layer);
            downloadStyleLayer(styleIndex + 1);
          }
        },
      });

      control.addTo(tempMap);

      layer.on('savestart', (e: any) => {
        totalTiles += e.length || (e._tilesforSave ? e._tilesforSave.length : 0);
      });

      layer.on('savetileend', () => {
        savedTiles++;
        if (totalTiles > 0) {
          const percent = Math.floor((savedTiles / totalTiles) * 100);
          setProgress(Math.min(percent, 99));
        }
      });

      layer.on('saveend', () => {
        tempMap.removeLayer(layer);
        downloadStyleLayer(styleIndex + 1);
      });

      layer.on('tilelayeroffline:saveerror', (err: any) => {
        console.error(`Downloading error on layer ${styleConfig.name}:`, err);
        alert('Error during downloading. Check your connexion.');
        cleanup();
      });

      tempMap.whenReady(() => {
        setTimeout(() => {
          try {
            control._saveTiles();
          } catch (e) {
            console.error('Erreur interne SaveTiles:', e);
            cleanup();
          }
        }, 500);
      });
    };

    downloadStyleLayer(0);
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
      {viewingRegion !== null &&
        (() => {
          const bounds = getBoundsForRegion(viewingRegion);
          const regionObj = displayRegions.find((r) => String(r.id) === String(viewingRegion));

          if (!bounds || !regionObj) return null;

          return <OfflineMapViewer name={regionObj.name} bounds={bounds} onClose={() => setViewingRegion(null)} />;
        })()}

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

            {/* SEARCH BAR */}
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

              {/* SEARCH RESULTS */}
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

        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">Select Map Layers</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {Object.values(MAP_STYLES).map((style) => {
              const isSelected = selectedStyles.includes(style.id);
              return (
                <button
                  key={style.id}
                  onClick={() => toggleStyle(style.id)}
                  disabled={downloadingId !== null}
                  className={`relative flex flex-col items-center justify-center gap-2 p-3 rounded-2xl border transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                      : 'bg-gray-800/40 border-gray-700 text-gray-500 hover:bg-gray-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-2xl">{style.icon}</span>
                  <span className="text-xs font-bold">{style.name}</span>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-[10px] font-bold">check</span>
                    </div>
                  )}
                  {style.id === 'dark' && <span className="text-[8px] uppercase font-black mt-0.5">Default</span>}
                </button>
              );
            })}
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-yellow-500 text-sm mt-0.5">database</span>
            <p className="text-gray-400 text-[10px] leading-relaxed">
              Selecting multiple layers increases storage usage.{' '}
              <span className="text-gray-200 font-semibold">Satellite tiles</span> are ~2.5x larger.
            </p>
          </div>
        </section>

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
                    onClick={() => {
                      if (isDownloaded && !isDownloadingThis) {
                        setViewingRegion(region.id);
                      }
                    }}
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
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      {isDownloadingThis ? (
                        <button
                          disabled
                          className="w-10 h-10 rounded-full flex items-center justify-center bg-yellow-500/20 text-yellow-500 animate-pulse shrink-0"
                        >
                          <span className="material-symbols-outlined text-xl">sync</span>
                        </button>
                      ) : isDownloaded ? (
                        <button
                          onClick={() => handleDelete(Number(region.id), region.name)}
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
              <div className="text-center py-6 text-gray-500 text-sm">No regions found for "{searchQuery}"</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
