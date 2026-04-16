import { useState } from 'react';

interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  // Toggle and selection states
  const [settings, setSettings] = useState({
    language: 'English (US)',
    theme: 'Dark Safety (Default)',
    pushNotifications: true,
    criticalAlertsOnly: false,
    shareLocation: true,
    anonymousAnalytics: true,
    autoRetrySos: true,
  });

  // Type-safe toggle function for boolean settings
  const toggle = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Reusable Switch Component
  const Switch = ({ active, onClick }: { active: boolean, onClick: () => void }) => (
    <div 
      onClick={onClick}
      className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ease-in-out ${active ? 'bg-blue-500' : 'bg-gray-700'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${active ? 'left-6' : 'left-1'}`}></div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-[#0f141e] w-full overflow-y-auto font-sans relative pb-10">
      
      {/* ─── HEADER ─── */}
      <header className="flex items-center px-6 py-4 sticky top-0 z-50 bg-[#0f141e]/90 backdrop-blur-md">
        <button 
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors mr-4 active:scale-95 flex items-center justify-center w-10 h-10 bg-gray-800/50 rounded-full"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>
        <h2 className="text-white text-xl font-bold tracking-wide">
          Settings
        </h2>
      </header>

      <div className="px-4 flex flex-col gap-6 mt-2">
        
        {/* ─── DISPLAY & LANGUAGE ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">Display & Language</h3>
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl overflow-hidden">
            
            {/* Language Selector */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700/30 cursor-pointer hover:bg-white/5 transition-colors">
              <div>
                <p className="text-white text-sm font-medium">Application Language</p>
                <p className="text-blue-400 text-[11px] font-bold mt-0.5">{settings.language}</p>
              </div>
              <span className="material-symbols-outlined text-gray-500">translate</span>
            </div>
            
            {/* Theme Selector */}
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors">
              <div>
                <p className="text-white text-sm font-medium">Visual Theme</p>
                <p className="text-blue-400 text-[11px] font-bold mt-0.5">{settings.theme}</p>
              </div>
              <span className="material-symbols-outlined text-gray-500">dark_mode</span>
            </div>
            
          </div>
        </section>

        {/* ─── NOTIFICATIONS ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">Notifications</h3>
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-700/30">
              <div>
                <p className="text-white text-sm font-medium">Push Notifications</p>
                <p className="text-gray-500 text-[11px]">Receive real-time safety updates</p>
              </div>
              <Switch active={settings.pushNotifications} onClick={() => toggle('pushNotifications')} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-white text-sm font-medium">Critical Alerts Only</p>
                <p className="text-gray-500 text-[11px]">Only notify for immediate threats</p>
              </div>
              <Switch active={settings.criticalAlertsOnly} onClick={() => toggle('criticalAlertsOnly')} />
            </div>
          </div>
        </section>

        {/* ─── PRIVACY & SAFETY ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">Privacy & Safety</h3>
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-700/30">
              <div>
                <p className="text-white text-sm font-medium">Share Live Location</p>
                <p className="text-gray-500 text-[11px]">Allow rescue teams to find you</p>
              </div>
              <Switch active={settings.shareLocation} onClick={() => toggle('shareLocation')} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-white text-sm font-medium">Anonymous Analytics</p>
                <p className="text-gray-500 text-[11px]">Help us improve the ERIS network</p>
              </div>
              <Switch active={settings.anonymousAnalytics} onClick={() => toggle('anonymousAnalytics')} />
            </div>
          </div>
        </section>

        {/* ─── DATA & STORAGE ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">Data & Storage</h3>
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-700/30">
              <div>
                <p className="text-white text-sm font-medium">Auto-Retry SOS</p>
                <p className="text-gray-500 text-[11px]">Automatically re-send if signal is lost</p>
              </div>
              <Switch active={settings.autoRetrySos} onClick={() => toggle('autoRetrySos')} />
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="text-white text-sm font-medium">Offline Map Cache</p>
                <p className="text-gray-500 text-[11px]">Currently using 124 MB</p>
              </div>
              <button className="text-blue-400 text-xs font-bold bg-blue-500/10 px-4 py-2 rounded-full hover:bg-blue-500/20 active:scale-95 transition-all">
                Clear Cache
              </button>
            </div>
          </div>
        </section>

        {/* ─── SYSTEM DIAGNOSTICS ─── */}
        <section>
          <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-3 px-2">System Diagnostics</h3>
          <div className="bg-gray-800/40 border border-gray-700/50 rounded-3xl p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">LoRa Module</span>
              <span className="flex items-center gap-2 text-green-400 text-xs font-bold bg-green-400/10 px-3 py-1 rounded-full">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Connected
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-300 text-sm">Mesh Network</span>
              <span className="text-blue-400 text-xs font-bold bg-blue-500/10 px-3 py-1 rounded-full">Searching...</span>
            </div>
            <button className="mt-2 w-full py-3 bg-gray-700/50 text-white text-xs font-bold rounded-2xl border border-gray-600/50 hover:bg-gray-700 transition-colors active:scale-95">
              Run Network Test
            </button>
          </div>
        </section>

        {/* ─── LOGOUT ─── */}
        <button className="mt-4 mb-8 w-full bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500/20 py-4 rounded-3xl text-sm font-bold flex items-center justify-center gap-2 transition-all active:scale-95">
          <span className="material-symbols-outlined">logout</span>
          Sign Out of ERIS System
        </button>

      </div>
    </div>
  );
}