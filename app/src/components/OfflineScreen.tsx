import { useEffect, useState } from 'react';
import L from 'leaflet';
import { createOfflineLayer, PRESET_REGIONS } from '../utils/MapUtils';
import OfflineMapViewer from './OfflineMapViewer';

function getRelativeTimeString(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `Mis à jour il y a ${days} jour${days > 1 ? 's' : ''}`;
  if (hours > 0) return `Mis à jour il y a ${hours} h`;
  if (minutes > 0) return `Mis à jour il y a ${minutes} min`;
  return "Mis à jour à l'instant";
}

interface OfflineScreenProps {
  onBack: () => void;
  onNavigateDownload: () => void; // New prop for navigation
}

export default function OfflineScreen({ onBack, onNavigateDownload }: OfflineScreenProps) {
  const [downloadedIds, setDownloadedIds] = useState<(number | string)[]>([]);
  const [customRegions, setCustomRegions] = useState<any[]>([]);

  const [metadata, setMetadata] = useState<Record<number | string, { lastUpdate: number }>>({});
  const [activeMenu, setActiveMenu] = useState<number | string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | string | null>(null);
  const [progress, setProgress] = useState(0);
  const [viewingRegion, setViewingRegion] = useState<number | string | null>(null);
  const [storageUsedMB, setStorageUsedMB] = useState(0);

  const MAX_STORAGE_MB = 1024;

  useEffect(() => {
    async function calculateRealStorage() {
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const { usage } = await navigator.storage.estimate();
          const mb = (usage || 0) / (1024 * 1024);
          setStorageUsedMB(Number(mb.toFixed(1)));
        } catch (e) {
          console.error('Erreur de calcul du stockage', e);
        }
      }
    }
    calculateRealStorage();
    const interval = setInterval(calculateRealStorage, 5000);
    return () => clearInterval(interval);
  }, []);

  const progressPercent = Math.min((storageUsedMB / MAX_STORAGE_MB) * 100, 100);

  useEffect(() => {
    const saved = localStorage.getItem('eris_offline_regions');
    if (saved) setDownloadedIds(JSON.parse(saved));

    const savedMeta = localStorage.getItem('eris_offline_metadata');
    if (savedMeta) setMetadata(JSON.parse(savedMeta));

    const savedCustom = localStorage.getItem('eris_custom_regions');
    if (savedCustom) setCustomRegions(JSON.parse(savedCustom));
  }, []);

  // Funstion used bto get the info of a zone
  const getRegionInfo = (id: number | string) => {
    // For presets
    if (typeof id === 'number' || (typeof id === 'string' && !id.startsWith('custom_'))) {
      const preset = PRESET_REGIONS.find((r) => r.id === Number(id));
      return preset ? { ...preset, isCustom: false } : null;
    }

    // For manual zones
    const custom = customRegions.find((r) => r.id === id);
    if (custom) {
      return {
        name: custom.name,
        size: custom.size || 'Custom Size',
        detail: 'Zone personnalisée',
        bounds: L.latLngBounds(custom.bounds.southWest, custom.bounds.northEast),
        isCustom: true,
      };
    }
    return null;
  };

  // --- DELETION LOGIC ---
  const handleDelete = (id: number | string, name: string) => {
    if (window.confirm(`Delete ${name} from offline storage?`)) {
      const updated = downloadedIds.filter((rid) => rid !== id);
      setDownloadedIds(updated);
      localStorage.setItem('eris_offline_regions', JSON.stringify(updated));
      setActiveMenu(null);
    }
  };

  // --- UPDATING LOGIC ---
  const handleUpdate = (id: number | string, name: string) => {
    const region = getRegionInfo(id);
    if (!region) return;

    setUpdatingId(id);
    setProgress(0);
    setActiveMenu(null);

    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'width:256px; height:256px; position:fixed; top:-9999px;';
    document.body.appendChild(tempDiv);

    const tempMap = L.map(tempDiv, { fadeAnimation: false, zoomAnimation: false });
    tempMap.fitBounds(region.bounds);

    const layer = createOfflineLayer().addTo(tempMap);
    const control = (L.control as any).savetiles(layer, {
      zoomlevels: [12, 13, 14, 15],
      confirm: (_: any, success: () => void) => success(), // Auto-confirm pour l'update
    });
    control.addTo(tempMap);

    const cleanup = () => {
      setUpdatingId(null);
      tempMap.remove();
      if (document.body.contains(tempDiv)) document.body.removeChild(tempDiv);
    };

    layer.on('savestart', (e: any) => {
      const total = e.length || (e._tilesforSave ? e._tilesforSave.length : 0);
      layer.on('savetileend', () => {
        const current = (layer as any)._tilesforSave?.length || total;
        setProgress((prev) => Math.min(prev + 5, 95));
      });
    });

    layer.on('saveend', () => {
      setProgress(100);

      const now = Date.now();
      setMetadata((prev) => ({
        ...prev,
        [id]: { lastUpdate: now },
      }));

      const savedMeta = localStorage.getItem('eris_offline_metadata');
      const currentMeta = savedMeta ? JSON.parse(savedMeta) : {};
      currentMeta[id] = { lastUpdate: now };
      localStorage.setItem('eris_offline_metadata', JSON.stringify(currentMeta));

      setTimeout(() => {
        alert(`${name} updated successfully.`);
        cleanup();
      }, 500);
    });

    tempMap.whenReady(() => {
      setTimeout(() => control._saveTiles(), 500);
    });
  };

  // Mock data for regional maps
  /*const [sectors] = useState([
    {
      id: '1',
      name: 'Montpellier City Area',
      status: 'Downloaded',
      size: '124 MB',
      isDownloaded: true,
      lastUpdated: 'Updated 2 days ago',
    },
    {
      id: '2',
      name: 'Occitanie Region North',
      status: 'Available',
      size: '85 MB',
      isDownloaded: false,
      lastUpdated: 'Ready to install',
    },
  ]);*/

  return (
    <div className="flex flex-col h-full bg-[#0f141e] w-full overflow-y-auto font-sans relative pb-24">
      {viewingRegion !== null &&
        (() => {
          const regionInfo = getRegionInfo(viewingRegion);
          if (!regionInfo) return null;
          return (
            <OfflineMapViewer
              name={regionInfo.name}
              bounds={regionInfo.bounds}
              onClose={() => setViewingRegion(null)}
            />
          );
        })()}
      {/* ─── HEADER ─── */}
      <header className="flex items-center px-6 py-4 bg-[#0f141e]/90 backdrop-blur-md sticky top-0 z-50">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors mr-4 active:scale-95 flex items-center justify-center w-10 h-10 bg-gray-800/50 rounded-full"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h2 className="text-white text-xl font-bold tracking-wide">Offline Maps</h2>
      </header>

      <div className="p-4 flex-1 flex flex-col gap-6">
        {/* ─── STORAGE CARD ─── */}
        <div className="bg-gradient-to-br from-blue-900/30 to-gray-800/40 border border-blue-800/20 rounded-3xl p-5 shadow-lg relative overflow-hidden">
          {/* Optionnel : petite animation de chargement en fond si la valeur est 0 au début */}
          {storageUsedMB === 0 && <div className="absolute inset-0 bg-blue-500/5 animate-pulse rounded-3xl" />}

          <div className="flex justify-between items-end mb-4 relative z-10">
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Local Storage</p>
              <h3 className="text-white text-3xl font-bold">
                {storageUsedMB} <span className="text-gray-400 text-sm font-normal">MB used</span>
              </h3>
            </div>
            <span className="text-gray-500 text-sm font-medium bg-gray-900/50 px-3 py-1 rounded-lg">1.0 GB Total</span>
          </div>

          <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-700/50 relative z-10">
            <div
              className={`h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)] transition-all duration-1000 ease-out`}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          {/* Petit message d'avertissement si le stockage est presque plein */}
          {progressPercent > 90 && (
            <p className="text-red-400 text-[11px] font-medium mt-3 flex items-center gap-1">
              <span className="material-symbols-outlined text-sm">warning</span>
              Storage is almost full. Consider deleting old maps.
            </p>
          )}
        </div>

        {/* ─── REGIONAL MAPS LIST ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">My Regions</h3>

          <div className="flex flex-col gap-3">
            {downloadedIds.length > 0 ? (
              downloadedIds.map((id) => {
                const info = getRegionInfo(id);
                if (!info) return null;
                const lastUpdate = metadata[id]?.lastUpdate;
                return (
                  <div
                    key={id}
                    onClick={() => {
                      const isUpdating = updatingId === id;
                      if (!isUpdating) setViewingRegion(id);
                    }}
                    className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-4 flex items-center justify-between shadow-sm animate-fade-in cursor-pointer hover:bg-gray-800/60 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-green-500/10 text-green-400">
                        <span className="material-symbols-outlined text-xl">offline_pin</span>
                      </div>
                      <div>
                        <h4 className="text-white text-sm font-bold mb-0.5">{info.name}</h4>
                        <p className="text-gray-500 text-[11px] font-medium">
                          {lastUpdate ? getRelativeTimeString(lastUpdate) : 'Date inconnue'} • {info.size}
                        </p>
                      </div>
                    </div>

                    {/* BOUTON MORE */}
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenu(activeMenu === id ? null : id);
                        }}
                        className="text-gray-500 hover:text-white transition-colors w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-700/30"
                      >
                        <span className="material-symbols-outlined">more_vert</span>
                      </button>

                      {/* MENU ACTIONS */}
                      {activeMenu === id && (
                        <div className="absolute right-0 mt-2 w-36 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl z-[3000] overflow-hidden animate-in fade-in zoom-in duration-150">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdate(id, info.name);
                            }}
                            className="w-full px-4 py-3 text-left text-xs font-bold text-blue-400 hover:bg-gray-800 flex items-center gap-2 border-b border-gray-800"
                          >
                            <span className="material-symbols-outlined text-sm">update</span> Update
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(id, info.name);
                            }}
                            className="w-full px-4 py-3 text-left text-xs font-bold text-red-400 hover:bg-gray-800 flex items-center gap-2"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              /* Message si aucune carte n'est téléchargée */
              <div className="bg-gray-800/20 border border-dashed border-gray-700/50 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
                <span className="material-symbols-outlined text-gray-600 text-4xl mb-3">cloud_off</span>
                <p className="text-gray-500 text-sm">No offline maps found.</p>
                <p className="text-gray-600 text-[11px] mt-1">Download a region to use the app without internet.</p>
              </div>
            )}
          </div>
        </section>

        {/* ─── DOWNLOAD NEW MAP BUTTON ─── */}
        <div className="mt-2">
          <button
            onClick={onNavigateDownload}
            className="w-full py-4 bg-blue-600 text-white rounded-3xl text-sm font-bold tracking-wide flex items-center justify-center gap-2 shadow-lg shadow-blue-900/30 hover:bg-blue-500 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined">add_location</span>
            Download New Region
          </button>
        </div>

        <p className="text-gray-500 text-[11px] text-center mt-4 px-4 leading-relaxed">
          Downloading maps allows you to navigate and use the ERIS emergency network even without internet access.
        </p>
      </div>
    </div>
  );
}
