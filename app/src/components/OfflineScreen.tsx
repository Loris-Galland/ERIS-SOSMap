import { useState } from 'react';

interface OfflineScreenProps {
  onBack: () => void;
}

export default function OfflineScreen({ onBack }: OfflineScreenProps) {
  // Mock data for regional maps
  const [sectors] = useState([
    {
      id: '1',
      name: 'Montpellier City Area',
      status: 'Downloaded',
      size: '124 MB',
      isDownloaded: true,
      lastUpdated: 'Updated 2 days ago'
    },
    {
      id: '2',
      name: 'Occitanie Region North',
      status: 'Available',
      size: '85 MB',
      isDownloaded: false,
      lastUpdated: 'Ready to install'
    },
  ]);

  return (
    <div className="flex flex-col h-full bg-[#0f141e] w-full overflow-y-auto font-sans relative pb-20">
      
      {/* ─── HEADER ─── */}
      <header className="flex items-center px-6 py-4 bg-[#0f141e]/90 backdrop-blur-md sticky top-0 z-50">
        <button 
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors mr-4 active:scale-95 flex items-center justify-center w-10 h-10 bg-gray-800/50 rounded-full"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h2 className="text-white text-xl font-bold tracking-wide">
          Offline Maps
        </h2>
      </header>

      <div className="p-4 flex-1 flex flex-col gap-6">
        
        {/* ─── STORAGE CARD ─── */}
        <div className="bg-gradient-to-br from-blue-900/30 to-gray-800/40 border border-blue-800/20 rounded-3xl p-5 shadow-lg">
          <div className="flex justify-between items-end mb-4">
            <div>
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-1">
                Local Storage
              </p>
              <h3 className="text-white text-3xl font-bold">
                124 <span className="text-gray-400 text-sm font-normal">MB used</span>
              </h3>
            </div>
            <span className="text-gray-500 text-sm font-medium bg-gray-900/50 px-3 py-1 rounded-lg">
              1.0 GB Total
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="w-full h-3 bg-gray-900 rounded-full overflow-hidden border border-gray-700/50">
            <div 
              className="h-full bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.6)]" 
              style={{ width: '12.4%' }}
            ></div>
          </div>
        </div>

        {/* ─── REGIONAL MAPS LIST ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">
            Available Regions
          </h3>

          <div className="flex flex-col gap-3">
            {sectors.map((sector) => (
              <div 
                key={sector.id} 
                className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-4 flex flex-col gap-4 shadow-sm"
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    sector.isDownloaded ? 'bg-green-500/10 text-green-400' : 'bg-gray-700/50 text-gray-400'
                  }`}>
                    <span className="material-symbols-outlined text-2xl">
                      {sector.isDownloaded ? 'check_circle' : 'map'}
                    </span>
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1">
                    <h4 className="text-white text-sm font-bold mb-0.5">
                      {sector.name}
                    </h4>
                    <p className="text-gray-400 text-[11px] font-medium">
                      {sector.size} • {sector.lastUpdated}
                    </p>
                  </div>
                </div>

                {/* Action Button */}
                <button 
                  className={`w-full py-3 rounded-2xl text-xs font-bold tracking-wide transition-all active:scale-[0.98] ${
                    sector.isDownloaded 
                      ? 'bg-gray-700/40 text-gray-300 hover:bg-gray-700/60' 
                      : 'bg-blue-600 text-white shadow-lg shadow-blue-900/20 hover:bg-blue-500'
                  }`}
                >
                  {sector.isDownloaded ? 'Update Map Data' : 'Download to Device'}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Footer info */}
        <p className="text-gray-500 text-[11px] text-center mt-2 px-4 leading-relaxed">
          Downloading maps allows you to navigate and use the ERIS emergency network even without internet access.
        </p>

      </div>
    </div>
  );
}