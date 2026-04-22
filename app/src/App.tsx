import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Geolocation } from '@capacitor/geolocation';

// Auth imports
import { supabase } from './db/supabaseClient';

// UI imports
import AuthScreen from './components/AuthScreen';
import OfflineScreen from './components/OfflineScreen';
import ProfileScreen from './components/ProfileScreen';
import SettingsScreen from './components/SettingsScreen';
import AlertScreen from './components/AlertScreen';
import DownloadMapScreen from './components/DownloadMapScreen';
import logo from './assets/small_logo.png';
import { PRESET_REGIONS } from './utils/MapUtils';
import SetupProfileScreen from './components/SetupProfileScreen';

export default function App() {
  // Auth states
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // App and Map states
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const userMarker = useRef<L.Marker | null>(null);

  const [userPosition, setUserPosition] = useState({ lat: 0, lng: 0, alt: 0 });
  const [gpsStatus, setGpsStatus] = useState('Locating...');
  const [activeTab, setActiveTab] = useState<
    'MAP' | 'ALERTS' | 'OFFLINE' | 'USER' | 'SETTINGS' | 'DOWNLOAD_MAP' | 'PROFILE_SETUP'
  >('ALERTS');
  const [offlineMode, setOfflineMode] = useState(false);
  const [showHazardAlert, setShowHazardAlert] = useState(true);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [localSearchableRegions, setLocalSearchableRegions] = useState<any[]>([]);

  const [previewArea, setPreviewArea] = useState<{
    id: string;
    name: string;
    bounds: L.LatLngBounds;
    isOffline?: boolean;
  } | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  // Check auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      const isSetupDone = session.user?.user_metadata?.profile_setup_completed;
      if (!isSetupDone) {
        setActiveTab('PROFILE_SETUP');
      } else {
        setActiveTab('ALERTS');
      }
    }
  }, [session]);

  // Initialize map and GPS tracking only if logged in
  useEffect(() => {
    if (!session || !mapRef.current || mapInstance.current) return;

    mapInstance.current = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([48.8584, 2.2945], 13);

    // Modern dark map base layer (Voyager dark)
    (L.tileLayer as any)
      .offline('https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png', {
        attribution: 'ERIS Safety',
        minZoom: 12,
        maxZoom: 15,
        crossOrigin: true,
      })
      .addTo(mapInstance.current);

    setTimeout(() => {
      mapInstance.current?.invalidateSize();
    }, 250);

    const startTracking = async () => {
      try {
        await Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 10000 }, (position) => {
          if (position) {
            const { latitude, longitude, altitude } = position.coords;

            setUserPosition({ lat: latitude, lng: longitude, alt: altitude || 0 });
            setGpsStatus('Connected');

            if (mapInstance.current) {
              if (userMarker.current) {
                userMarker.current.setLatLng([latitude, longitude]);
              } else {
                const icon = L.divIcon({
                  className: '',
                  html: `<div style="
                      width:18px; height:18px;
                      background:#3b82f6;
                      border:3px solid #ffffff;
                      border-radius:50%;
                      box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
                    "></div>`,
                  iconSize: [18, 18],
                  iconAnchor: [9, 9],
                });
                userMarker.current = L.marker([latitude, longitude], { icon }).addTo(mapInstance.current);
                mapInstance.current.setView([latitude, longitude], 15);
              }
            }
          }
        });
      } catch {
        setGpsStatus('GPS Unavailable');
      }
    };

    startTracking();

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, [session]);

  // Loading screen to prevent UI flash
  if (isInitializing) {
    return <div className="h-screen w-full bg-[#0f141e]"></div>;
  }

  // Show auth screen if not logged in
  if (!session) {
    return <AuthScreen />;
  }

  // --- LOCAL DATA CHARGING---
  useEffect(() => {
    if (activeTab !== 'MAP') return;

    // Manual zones
    const savedCustom = localStorage.getItem('eris_custom_regions');
    const customRegs = savedCustom ? JSON.parse(savedCustom) : [];

    const formattedCustom = customRegs.map((r: any) => ({
      place_id: r.id,
      display_name: `${r.name}, Zone personnalisée`,
      boundingbox: [r.bounds.southWest[0], r.bounds.northEast[0], r.bounds.southWest[1], r.bounds.northEast[1]],
      isOffline: true,
    }));

    // Presets zones
    const savedOffline = localStorage.getItem('eris_offline_regions');
    const downloadedIds = savedOffline ? JSON.parse(savedOffline) : [];

    const downloadedPresets = PRESET_REGIONS.filter((pr) => downloadedIds.includes(pr.id)).map((pr) => ({
      place_id: pr.id.toString(),
      display_name: `${pr.name}, Zone enregistrée`,
      boundingbox: [
        pr.bounds.getSouthWest().lat,
        pr.bounds.getNorthEast().lat,
        pr.bounds.getSouthWest().lng,
        pr.bounds.getNorthEast().lng,
      ],
      isOffline: true,
    }));

    setLocalSearchableRegions([...formattedCustom, ...downloadedPresets]);
  }, [activeTab]);

  // Search logic
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      const searchLower = searchQuery.toLowerCase();

      // If offline: searcgh local cache
      if (offlineMode || !navigator.onLine) {
        const localResults = localSearchableRegions.filter((r) => r.display_name.toLowerCase().includes(searchLower));
        setSearchResults(localResults);
        setIsSearching(false);
        return;
      }

      // If online: search on the internet
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=4`,
        );
        const data = await res.json();
        setSearchResults(data);
      } catch (e) {
        // Fallback sécurité : Si l'API échoue, on cherche en local
        const localResults = localSearchableRegions.filter((r) => r.display_name.toLowerCase().includes(searchLower));
        setSearchResults(localResults);
      } finally {
        setIsSearching(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, offlineMode, localSearchableRegions]);

  // Search result
  const handleSelectResult = (item: any) => {
    if (!mapInstance.current) return;

    // Récupération des limites de la zone (Bounding Box)
    const bbox = item.boundingbox;
    const bounds = L.latLngBounds(
      [parseFloat(bbox[0]), parseFloat(bbox[2])],
      [parseFloat(bbox[1]), parseFloat(bbox[3])],
    );

    // Déplace la carte principale vers la zone recherchée avec une animation fluide
    mapInstance.current.fitBounds(bounds, { animate: true, duration: 1.5 });

    setPreviewArea({
      id: item.place_id.toString(),
      name: item.display_name.split(',')[0],
      bounds: bounds,
      isOffline: item.isOffline,
    });

    // Nettoie l'interface
    setSearchQuery('');
    setSearchResults([]);
  };

  return (
    <div className="flex flex-col h-screen w-full bg-[#0f141e] text-white overflow-hidden font-sans">
      {/* Header */}
      <header className="flex justify-between items-center px-5 py-3 bg-[#0f141e]/95 backdrop-blur-md border-b border-gray-800/50 z-[1000] relative">
        <div className="flex items-center gap-2">
          <img src={logo} alt="ERIS-SOSMap" className="h-7 w-auto object-contain" />
        </div>
        <h1 className="flex-1 text-center text-white text-lg font-bold tracking-wide">ERIS Safety</h1>
        <div className="w-16" /> {/* Spacer invisible pour garder le titre centré */}
      </header>

      {/* ─── SEARCH & OFFLINE BAR ─── */}
      <div className="flex items-center px-4 py-3 bg-[#0f141e]/80 backdrop-blur-md z-[9999] gap-3 relative">
        {/* Search input (Soft rounded shape) */}
        <div className="relative flex-1">
          <div className="flex items-center bg-gray-800/60 border border-gray-700/50 rounded-full px-4 py-2.5 gap-2 shadow-inner">
            <span className="material-symbols-outlined text-gray-400 text-lg">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search city or coordinates..."
              className="bg-transparent text-sm text-white w-full outline-none placeholder-gray-500"
            />
            {isSearching && <span className="material-symbols-outlined text-blue-400 text-lg animate-spin">sync</span>}
          </div>

          {searchResults.length > 0 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[5000]">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectResult(result)}
                  className="px-4 py-3 text-left hover:bg-gray-700 flex items-center gap-3 border-b border-gray-700/50 last:border-0 transition-colors"
                >
                  <span className="material-symbols-outlined text-gray-400">location_on</span>
                  <div className="flex-col overflow-hidden">
                    <span className="text-white text-sm font-bold block truncate">
                      {result.display_name.split(',')[0]}
                    </span>
                    <span className="text-gray-500 text-[10px] block truncate">{result.display_name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setOfflineMode((v) => !v)}
          className={`flex items-center justify-center w-11 h-11 rounded-full transition-colors shadow-lg ${
            offlineMode
              ? 'bg-blue-500 text-white shadow-blue-900/30'
              : 'bg-gray-800 border border-gray-700 text-gray-400'
          }`}
        >
          <span className="material-symbols-outlined text-xl">{offlineMode ? 'cloud_off' : 'cloud_download'}</span>
        </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden">
        {/* Map Container */}
        <div ref={mapRef} className="absolute inset-0 z-0" />

        {/* Location Card */}
        <div className="absolute top-4 left-4 z-[1000] pointer-events-none flex flex-col gap-2">
          <div className="bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-2xl p-4 shadow-xl">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`w-2 h-2 rounded-full ${gpsStatus === 'Connected' ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`}
              ></span>
              <span className="text-gray-300 text-xs font-semibold">{gpsStatus}</span>
            </div>
            {userPosition.lat !== 0 ? (
              <>
                <div className="text-white text-sm font-mono font-medium">
                  {userPosition.lat.toFixed(4)}° N, {userPosition.lng.toFixed(4)}° E
                </div>
                <div className="text-gray-500 text-[11px] mt-1">Altitude: {userPosition.alt.toFixed(0)}m</div>
              </>
            ) : (
              <div className="text-gray-400 text-sm">Acquiring position...</div>
            )}
          </div>
        </div>

        {/* Map Controls */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-3">
          <button
            onClick={() => mapInstance.current?.setZoom(mapInstance.current?.getZoom() ?? 13)}
            className="w-12 h-12 bg-gray-900/90 border border-gray-700/50 rounded-full flex items-center justify-center text-gray-300 hover:bg-gray-800 transition-colors shadow-lg active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">layers</span>
          </button>
          <button
            onClick={() => {
              if (mapInstance.current && userPosition.lat !== 0) {
                mapInstance.current.setView([userPosition.lat, userPosition.lng], 15);
              }
            }}
            className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/30 active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">my_location</span>
          </button>
        </div>

        {/* Hazard Alert */}
        {showHazardAlert && (
          <div className="absolute bottom-24 left-4 right-20 z-[1000] animate-fade-in">
            <div className="bg-red-500/90 backdrop-blur-md rounded-2xl p-4 flex items-start gap-3 shadow-[0_8px_30px_rgba(239,68,68,0.3)] border border-red-400/30">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-white text-lg">warning</span>
              </div>
              <div className="flex-1">
                <h4 className="text-white text-sm font-bold mb-0.5">Area Warning</h4>
                <p className="text-red-100 text-xs leading-relaxed">
                  High avalanche risk reported in your current sector. Avoid steep terrains.
                </p>
              </div>
              <button
                onClick={() => setShowHazardAlert(false)}
                className="text-red-200 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined text-xl">close</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab Screens */}
        {activeTab === 'ALERTS' && (
          <div className="absolute inset-0 z-[2000] bg-[#0f141e]">
            <AlertScreen />
          </div>
        )}

        {activeTab === 'OFFLINE' && (
          <div className="absolute inset-0 z-[2000] bg-[#0f141e]">
            <OfflineScreen onBack={() => setActiveTab('MAP')} onNavigateDownload={() => setActiveTab('DOWNLOAD_MAP')} />
          </div>
        )}

        {activeTab === 'DOWNLOAD_MAP' && (
          <div className="absolute inset-0 z-[3000] bg-[#0f141e]">
            <DownloadMapScreen onBack={() => setActiveTab('OFFLINE')} map={mapInstance.current} />
          </div>
        )}

        {activeTab === 'USER' && (
          <div className="absolute inset-0 z-[2000] bg-[#0f141e]">
            <ProfileScreen onOpenSettings={() => setActiveTab('SETTINGS')} />
          </div>
        )}

        {activeTab === 'PROFILE_SETUP' && session && (
          <div className="absolute inset-0 z-[5000] bg-[#0f141e]">
            <SetupProfileScreen userId={session.user.id} onComplete={() => setActiveTab('ALERTS')} />
          </div>
        )}

        {activeTab === 'SETTINGS' && (
          <div className="absolute inset-0 z-[3000] bg-[#0f141e]">
            <SettingsScreen onBack={() => setActiveTab('USER')} />
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="flex items-center justify-around h-20 bg-[#0f141e]/95 backdrop-blur-md border-t border-gray-800/50 pb-safe z-[1000]">
        {(
          [
            { id: 'ALERTS', icon: 'notifications', label: 'Alerts' },
            { id: 'MAP', icon: 'map', label: 'Map' },
            { id: 'OFFLINE', icon: 'cloud_download', label: 'Offline' },
            { id: 'USER', icon: 'person', label: 'Profile' },
          ] as const
        ).map(({ id, icon, label }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex flex-col items-center justify-center w-16 gap-1 transition-all ${isActive ? 'text-blue-500' : 'text-gray-500 hover:text-gray-400'}`}
            >
              <div
                className={`px-4 py-1 rounded-full transition-all ${isActive ? 'bg-blue-500/10' : 'bg-transparent'}`}
              >
                <span
                  className="material-symbols-outlined text-2xl"
                  style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}
                >
                  {icon}
                </span>
              </div>
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}