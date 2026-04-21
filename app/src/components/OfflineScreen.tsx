import { useEffect, useState } from 'react';

interface OfflineScreenProps {
  onBack: () => void;
  onNavigateDownload: () => void; // New prop for navigation
}

const REGIONS_DATA: Record<number, { name: string; size: string; detail: string }> = {
  1: { name: 'Paris & Île-de-France', size: '345 MB', detail: 'Île-de-France' },
  2: { name: 'Lyon Metropolitan', size: '180 MB', detail: 'Auvergne-Rhône-Alpes' },
  3: { name: 'Marseille & Calanques', size: '210 MB', detail: 'Provence-Alpes-Côte d’Azur' },
  4: { name: 'French Alps Sector', size: '420 MB', detail: 'Savoie / Haute-Savoie' },
  5: { name: 'Bordeaux & Gironde', size: '150 MB', detail: 'Nouvelle-Aquitaine' },
};

export default function OfflineScreen({ onBack, onNavigateDownload }: OfflineScreenProps) {
  const [downloadedIds, setDownloadedIds] = useState<number[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('eris_offline_regions');
    if (saved) {
      try {
        setDownloadedIds(JSON.parse(saved));
      } catch (e) {
        console.error('Erreur lors de la récupération des zones', e);
      }
    }
  }, []);

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
        <div className="bg-gradient-to-br from-blue-900/30 to-gray-800/40 border border-blue-800/20 rounded-3xl p-5 shadow-lg">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">Local Storage</p>
              <h3 className="text-white text-3xl font-bold">
                124 <span className="text-gray-400 text-sm font-normal">MB used</span>
              </h3>
            </div>
            <span className="text-gray-500 text-sm font-medium bg-gray-900/50 px-3 py-1 rounded-lg">1.0 GB Total</span>
          </div>

          <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-700/50">
            <div
              className="h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)]"
              style={{ width: '12.4%' }}
            ></div>
          </div>
        </div>

        {/* ─── REGIONAL MAPS LIST ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">My Regions</h3>

          <div className="flex flex-col gap-3">
            {downloadedIds.length > 0 ? (
              downloadedIds.map((id) => {
                const info = REGIONS_DATA[id];
                if (!info) return null;
                return (
                  <div
                    key={id}
                    className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-4 flex items-center justify-between shadow-sm animate-fade-in"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-green-500/10 text-green-400">
                        <span className="material-symbols-outlined text-xl">offline_pin</span>
                      </div>
                      <div>
                        <h4 className="text-white text-sm font-bold mb-0.5">{info.name}</h4>
                        <p className="text-gray-500 text-[11px] font-medium">
                          {info.detail} • {info.size}
                        </p>
                      </div>
                    </div>
                    <button className="text-gray-500 hover:text-white transition-colors">
                      <span className="material-symbols-outlined">more_vert</span>
                    </button>
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
