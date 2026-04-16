import { useState } from 'react';

interface DownloadMapScreenProps {
  onBack: () => void;
}

export default function DownloadMapScreen({ onBack }: DownloadMapScreenProps) {
  const [searchQuery, setSearchQuery] = useState('');

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
          <h2 className="text-white text-xl font-bold tracking-wide">
            Download Maps
          </h2>
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
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">
            Suggested Regions
          </h3>

          <div className="flex flex-col gap-3">
            {suggestions.map((region) => (
              <div 
                key={region.id} 
                className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-4 flex items-center justify-between shadow-sm"
              >
                <div className="flex items-center gap-4">
                  {/* Location Icon */}
                  <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 bg-gray-700/50 text-gray-400">
                    <span className="material-symbols-outlined text-xl">location_city</span>
                  </div>
                  
                  {/* Region Info */}
                  <div>
                    <h4 className="text-white text-sm font-bold mb-0.5">
                      {region.name}
                    </h4>
                    <p className="text-gray-500 text-[11px] font-medium">
                      {region.size} • Map & Navigation Data
                    </p>
                  </div>
                </div>

                {/* Download Button */}
                <button 
                  className="w-10 h-10 rounded-full bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 flex items-center justify-center transition-all active:scale-95 shrink-0"
                >
                  <span className="material-symbols-outlined text-xl">download</span>
                </button>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}