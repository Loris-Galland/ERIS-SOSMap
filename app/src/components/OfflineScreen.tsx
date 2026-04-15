import { useState } from 'react';

interface OfflineScreenProps {
  onBack: () => void;
}

export default function OfflineScreen({ onBack }: OfflineScreenProps) {
  // Simulation des données de la maquette
  const [sectors, setSectors] = useState([
    {
      id: '7G',
      name: 'Sector 7G (Montpellier Center)',
      status: 'DOWNLOADED',
      size: '124MB',
      isDownloaded: true,
    },
    {
      id: '8H',
      name: 'Sector 8H (North Region)',
      status: 'AVAILABLE',
      size: '85MB',
      isDownloaded: false,
    },
  ]);

  return (
    <div className="flex flex-col h-full bg-[#0A0A0A] w-full overflow-y-auto font-sans relative">
      
      {/* ─── HEADER (Avec le bouton retour de la maquette) ─── */}
      <header className="flex items-center px-4 py-3 bg-[#111111] border-b border-[#2A2A2A] sticky top-0 z-50">
        <button 
          onClick={onBack}
          className="text-[#888] hover:text-white transition-colors mr-3 active:scale-95 flex items-center justify-center w-8 h-8"
        >
          <span className="material-symbols-outlined text-2xl">chevron_left</span>
        </button>
        <h2 className="text-[#CC0000] text-lg font-black uppercase tracking-[0.2em] leading-none mt-1">
          OFFLINE MAPS
        </h2>
      </header>

      <div className="p-4 flex-1 flex flex-col">
        {/* ─── LISTE DES SECTEURS ─── */}
        <h3 className="text-[#888] text-[10px] font-bold uppercase tracking-[0.15em] mb-3">
          Available Offline Sectors
        </h3>

        <div className="flex flex-col gap-3 mb-6">
          {sectors.map((sector) => (
            <div 
              key={sector.id} 
              className={`bg-[#111111] border p-3 flex flex-col gap-3 ${
                sector.isDownloaded ? 'border-l-4 border-l-[#00CC44] border-y-[#333] border-r-[#333]' : 'border-[#333]'
              }`}
            >
              <div>
                <h4 className="text-white text-sm font-bold tracking-wide uppercase mb-1">
                  {sector.name}
                </h4>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${sector.isDownloaded ? 'bg-[#00CC44]' : 'bg-[#888]'}`}></span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest ${sector.isDownloaded ? 'text-[#00CC44]' : 'text-[#888]'}`}>
                      Status: {sector.status}
                    </span>
                  </div>
                  <span className="text-[#888] text-[10px] font-mono">{sector.size}</span>
                </div>
              </div>

              {/* Bouton d'action */}
              <button 
                className={`w-full py-2 text-[10px] font-black uppercase tracking-widest border transition-colors active:scale-[0.98] ${
                  sector.isDownloaded 
                    ? 'bg-[#1A1A1A] border-[#333] text-[#888] hover:border-[#888]' 
                    : 'bg-[#CC0000]/10 border-[#CC0000] text-[#CC0000] hover:bg-[#CC0000]/20'
                }`}
              >
                {sector.isDownloaded ? 'UPDATE DATA' : 'DOWNLOAD'}
              </button>
            </div>
          ))}
        </div>

        {/* ─── STOCKAGE LOCAL ─── */}
        <div className="mt-auto bg-[#111111] border border-[#2A2A2A] p-4">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[#888] text-[10px] font-bold uppercase tracking-widest">
              Local Storage
            </span>
            <span className="text-white text-xs font-mono font-bold">
              124MB <span className="text-[#555]">/ 1GB</span>
            </span>
          </div>
          {/* Barre de progression style tactique */}
          <div className="w-full h-2 bg-[#1A1A1A] border border-[#333] relative overflow-hidden">
            <div 
              className="absolute top-0 left-0 h-full bg-[#00CC44] shadow-[0_0_10px_rgba(0,204,68,0.5)]" 
              style={{ width: '12.4%' }}
            ></div>
          </div>
        </div>
      </div>

    </div>
  );
}