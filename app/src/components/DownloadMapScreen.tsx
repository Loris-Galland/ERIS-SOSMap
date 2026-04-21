import { useEffect, useState } from 'react';
import L from 'leaflet';
import { createOfflineLayer, TILE_URL } from '../utils/MapUtils';

interface DownloadMapScreenProps {
  onBack: () => void;
  map: L.Map | null;
}

// Definition of the coordinates of suggested regions
const REGIONS_BOUNDS: Record<number, L.LatLngBounds> = {
  1: L.latLngBounds([48.5, 2.0], [49.0, 2.7]), // Paris & IDF
  2: L.latLngBounds([45.6, 4.7], [45.9, 5.0]), // Lyon
  3: L.latLngBounds([43.1, 5.2], [43.4, 5.5]), // Marseille
  4: L.latLngBounds([44.5, 5.5], [46.5, 7.5]), // Alpes françaises
  5: L.latLngBounds([44.7, -0.7], [45.0, -0.4]), // Bordeaux
};

export default function DownloadMapScreen({ onBack }: DownloadMapScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [downloadedRegions, setDownloadedRegions] = useState<number[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('eris_offline_regions');
    if (saved) {
      try {
        setDownloadedRegions(JSON.parse(saved));
      } catch (e) {
        console.error('Erreur de lecture du localStorage', e);
      }
    }
  }, []);

  const saveRegionAsDownloaded = (id: number) => {
    setDownloadedRegions((prev) => {
      const updated = prev.includes(id) ? prev : [...prev, id];
      localStorage.setItem('eris_offline_regions', JSON.stringify(updated));
      return updated;
    });
  };

  const removeRegionFromDownloaded = (id: number) => {
    setDownloadedRegions((prev) => {
      const updated = prev.filter((regionId) => regionId !== id);
      localStorage.setItem('eris_offline_regions', JSON.stringify(updated));
      return updated;
    });
  };

  // Downloading fonction linked to the ID of the region
  const handleDownload = (id: number, name: string) => {
    const bounds = REGIONS_BOUNDS[id];
    if (!bounds) {
      return;
    }

    setDownloadingId(id);
    setProgress(0);

    const tempDiv = document.createElement('div');
    tempDiv.style.width = '256px';
    tempDiv.style.height = '256px';
    tempDiv.style.position = 'fixed';
    tempDiv.style.top = '-9999px';
    document.body.appendChild(tempDiv);

    const tempMap = L.map(tempDiv, {
      fadeAnimation: false,
      zoomAnimation: false,
      inertia: false,
    });

    tempMap.invalidateSize();
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

  // Suggested regions to download
  const [suggestions] = useState([
    { id: 1, name: 'Paris & Île-de-France', size: '345 MB' },
    { id: 2, name: 'Lyon Metropolitan', size: '180 MB' },
    { id: 3, name: 'Marseille & Calanques', size: '210 MB' },
    { id: 4, name: 'French Alps Sector', size: '420 MB' },
    { id: 5, name: 'Bordeaux & Gironde', size: '150 MB' },
  ]);

  return (
    <div className="flex flex-col h-full bg-[#0f141e] w-full overflow-y-auto font-sans relative pb-20">
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
            {suggestions.map((region) => {
              const isDownloaded = downloadedRegions.includes(region.id);
              const isDownloadingThis = downloadingId === region.id;
              return (
                <div
                  key={region.id}
                  className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-4 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-4">
                    {/* Location Icon */}
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-gray-700/50 text-gray-400">
                      <span className="material-symbols-outlined text-xl">
                        {isDownloaded ? 'offline_pin' : 'location_city'}
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
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
