import { useEffect, useRef, useState, useCallback } from 'react';
import L, { map } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import { CapacitorErisSosmap } from 'capacitor-eris-sosmap';
import type { PluginListenerHandle } from '@capacitor/core';

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
import { PRESET_REGIONS, MAP_STYLES } from './utils/MapUtils';
import SetupProfileScreen from './components/SetupProfileScreen';
import { useTranslation } from 'react-i18next';
import { reportHazard, fetchHazards } from './services/hazardService';

const getWeatherDetails = (code: number) => {
  if (code === 0)
    return { condition: 'weather.clear', icon: 'sunny', color: 'text-yellow-400', bg: 'bg-yellow-400/20' };
  if (code === 1 || code === 2)
    return {
      condition: 'weather.partlyCloudy',
      icon: 'partly_cloudy_day',
      color: 'text-yellow-200',
      bg: 'bg-yellow-200/20',
    };
  if (code === 3) return { condition: 'weather.cloudy', icon: 'cloud', color: 'text-gray-400', bg: 'bg-gray-400/20' };
  if ([45, 48].includes(code))
    return { condition: 'weather.fog', icon: 'foggy', color: 'text-gray-300', bg: 'bg-gray-300/20' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { condition: 'weather.rain', icon: 'rainy', color: 'text-blue-400', bg: 'bg-blue-400/20' };
  if ([71, 73, 75, 85, 86].includes(code))
    return { condition: 'weather.snow', icon: 'weather_snowy', color: 'text-white', bg: 'bg-white/20' };
  if ([77].includes(code))
    return { condition: 'weather.hail', icon: 'grain', color: 'text-cyan-300', bg: 'bg-cyan-300/20' };
  if ([95, 96, 99].includes(code))
    return { condition: 'weather.storm', icon: 'thunderstorm', color: 'text-purple-400', bg: 'bg-purple-400/20' };

  return { condition: 'profile.unknown', icon: 'cloud', color: 'text-gray-400', bg: 'bg-gray-400/20' };
};

export default function App() {
  const [showHazardReportModal, setShowHazardReportModal] = useState(false);
  const [hazardsList, setHazardsList] = useState<any[]>([]);
  const hazardLayerGroup = useRef<L.LayerGroup | null>(null);

  // Internationalisation
  const { t } = useTranslation();

  // Auth states
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  // App and Map states
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const userMarker = useRef<L.Marker | null>(null);
  const baseLayerRef = useRef<any>(null);

  const [userPosition, setUserPosition] = useState({ lat: 0, lng: 0, alt: 0 });
  const [gpsStatus, setGpsStatus] = useState('Locating...');
  const [activeTab, setActiveTab] = useState<
    'MAP' | 'ALERTS' | 'OFFLINE' | 'USER' | 'SETTINGS' | 'DOWNLOAD_MAP' | 'PROFILE_SETUP'
  >('ALERTS');
  const [offlineMode, setOfflineMode] = useState(false);
  const [showHazardAlert, setShowHazardAlert] = useState(true);

  // Layer Menu States
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [currentMapStyle, setCurrentMapStyle] = useState<string>('dark');

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [localSearchableRegions, setLocalSearchableRegions] = useState<any[]>([]);

  // Weather states
  const [currentWeather, setCurrentWeather] = useState({
    temp: '--',
    condition: 'profile.loading',
    icon: 'sync',
    color: 'text-blue-400',
    bg: 'bg-blue-400/20',
  });
  const [showWeatherReport, setShowWeatherReport] = useState(false);

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

  // ─── WEATHER FETCHING LOGIC ───
  const fetchWeather = useCallback(
    async (lat: number, lng: number) => {
      // If offline we don't fetch
      if (offlineMode || !navigator.onLine) return;

      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`,
        );
        const data = await res.json();
        if (data.current_weather) {
          const { temperature, weathercode } = data.current_weather;
          const details = getWeatherDetails(weathercode);
          setCurrentWeather({
            temp: Math.round(temperature).toString(),
            condition: details.condition,
            icon: details.icon,
            color: details.color,
            bg: details.bg,
          });
        }
      } catch (e) {
        console.error('Error weather forecast API:', e);
      }
    },
    [offlineMode],
  );

  // Initialize map and GPS tracking only if logged in
  useEffect(() => {
    if (!session || !mapRef.current || mapInstance.current) return;

    let watchId: string | null = null;

    const defaultCoords: [number, number] = [48.8584, 2.2945];

    mapInstance.current = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(defaultCoords, 13);

    baseLayerRef.current = (L.tileLayer as any)
      .offline(MAP_STYLES.dark.url, {
        attribution: 'ERIS Safety',
        minZoom: 12,
        maxZoom: 17,
        crossOrigin: true,
      })
      .addTo(mapInstance.current);

    setTimeout(() => {
      mapInstance.current?.invalidateSize();
    }, 250);

    fetchWeather(defaultCoords[0], defaultCoords[1]);

    mapInstance.current.on('moveend', () => {
      if (mapInstance.current) {
        const center = mapInstance.current.getCenter();
        fetchWeather(center.lat, center.lng);
      }
    });

    // ─── GPS TRACKING (CROSS-PLATFORM FIX) ───
    const startTracking = async () => {
      try {
        // Request permissions on native devices before starting
        if (Capacitor.isNativePlatform()) {
          const permissions = await Geolocation.checkPermissions();
          if (permissions.location !== 'granted') {
            await Geolocation.requestPermissions();
          }
        }

        watchId = await Geolocation.watchPosition(
          {
            // High accuracy for real GPS on mobile, standard accuracy for web
            enableHighAccuracy: Capacitor.isNativePlatform(),
            timeout: 10000,
            maximumAge: 0,
          },
          (position, err) => {
            if (err) {
              console.warn('[GPS] Error:', err);
              return;
            }
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
          },
        );
      } catch (error) {
        console.error('GPS Init Error:', error);
        setGpsStatus('GPS Unavailable');
      }
    };

    startTracking();

    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
      mapInstance.current?.remove();
      mapInstance.current = null;
      userMarker.current = null;
      baseLayerRef.current = null;
    };
  }, [session]);

  // --- LOCAL DATA CHARGING ---
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

      // If offline: search local cache
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
        // Fallback security: if API fails, search local cache
        const localResults = localSearchableRegions.filter((r) => r.display_name.toLowerCase().includes(searchLower));
        setSearchResults(localResults);
      } finally {
        setIsSearching(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, offlineMode, localSearchableRegions]);

  // Handle Layer Swap
  const changeMapStyle = (styleKey: string) => {
    setCurrentMapStyle(styleKey);
    if (baseLayerRef.current) {
      baseLayerRef.current.setUrl(MAP_STYLES[styleKey as keyof typeof MAP_STYLES].url);
    }
    setShowLayerMenu(false);
  };
  // Load and display hazards on the map
  useEffect(() => {
    if (!mapInstance.current) return;

    // Create the hazard layer group if it doesn't exist
    if (!hazardLayerGroup.current) {
      hazardLayerGroup.current = L.layerGroup().addTo(mapInstance.current);
    }

    useEffect(() => {
      if (!session) return;

      CapacitorErisSosmap.startMeshNetwork();

      const meshListener = CapacitorErisSosmap.addListener('onMeshMessageReceived', async (data) => {
        console.log("🔥 SOS reçu d'un autre utilisateur ERIS via Mesh :", data.message);

        try {
          const payload = JSON.parse(data.message);

          if (navigator.onLine) {
            console.log("J'ai internet, je relaie le SOS vers Supabase !");
          } else {
            console.log('Je suis hors-ligne aussi, je relaie le signal à mes voisins !');
            await CapacitorErisSosmap.broadcastMeshMessage({ message: data.message });
          }
        } catch (e) {
          console.error('Erreur lors de la lecture du message Mesh', e);
        }
      });

      return () => {
        CapacitorErisSosmap.stopMeshNetwork();
        meshListener.then((listener: PluginListenerHandle) => listener.remove());
      };
    }, [session]);

    const loadHazards = async () => {
      const hazards = await fetchHazards();
      setHazardsList(hazards);

      // Clear old markers before drawing new ones
      hazardLayerGroup.current?.clearLayers();

      hazards.forEach((hazard) => {
        let iconHtml = '';
        let color = '';

        switch (hazard.type) {
          case 'fire':
            iconHtml = 'local_fire_department';
            color = '#ef4444';
            break; // Red
          case 'flood':
            iconHtml = 'water_drop';
            color = '#3b82f6';
            break; // Blue
          case 'road_blocked':
            iconHtml = 'block';
            color = '#f97316';
            break; // Orange
          case 'landslide':
            iconHtml = 'landslide';
            color = '#8b5cf6';
            break; // Purple
        }

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width: 32px; height: 32px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
          "><span class="material-symbols-outlined" style="color: white; font-size: 18px;">${iconHtml}</span></div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        if (hazardLayerGroup.current) {
          L.marker([hazard.lat, hazard.lon], { icon }).addTo(hazardLayerGroup.current);
        }
      });
    };

    loadHazards();

    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hazards' }, (payload) => {
        console.log('[HAZARD] Nouvelle alerte reçue en temps réel !', payload);
        loadHazards();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeTab]);

  // Loading screen to prevent UI flash
  if (isInitializing) {
    return <div className="h-screen w-full bg-[#0f141e]"></div>;
  }

  // Show auth screen if not logged in
  if (!session) {
    return <AuthScreen />;
  }

  // Search result
  const handleSelectResult = (item: any) => {
    if (!mapInstance.current) return;

    // fetch bounding box and calculate center
    const bbox = item.boundingbox;
    const bounds = L.latLngBounds(
      [parseFloat(bbox[0]), parseFloat(bbox[2])],
      [parseFloat(bbox[1]), parseFloat(bbox[3])],
    );

    const exactLat = item.lat ? parseFloat(item.lat) : bounds.getCenter().lat;
    const exactLon = item.lon ? parseFloat(item.lon) : bounds.getCenter().lng;

    const targetZoom = Math.min(mapInstance.current.getBoundsZoom(bounds), 14);

    // move map to the selected location
    mapInstance.current.flyTo([exactLat, exactLon], targetZoom, {
      animate: true,
      duration: 1.5,
    });

    setPreviewArea({
      id: item.place_id.toString(),
      name: item.display_name.split(',')[0],
      bounds: bounds,
      isOffline: item.isOffline,
    });

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
        <button
          className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider px-4 py-1.5 rounded-full transition-colors shadow-lg shadow-red-900/20 active:scale-95"
          onClick={() => setActiveTab('ALERTS')}
        >
          SOS
        </button>
      </header>

      {/* --- SEARCH & OFFLINE BAR --- */}
      {activeTab === 'MAP' && (
        <div className="flex items-center px-4 py-3 bg-[#0f141e]/80 backdrop-blur-md z-[9999] gap-3 relative">
          {/* Search input (Soft rounded shape) */}
          <div className="relative flex-1">
            <div className="flex items-center bg-gray-800/60 border border-gray-700/50 rounded-full px-4 py-2.5 gap-2 shadow-inner">
              <span className="material-symbols-outlined text-gray-400 text-lg">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('download.searchPlaceholder', 'Search city or coordinates...')}
                className="bg-transparent text-sm text-white w-full outline-none placeholder-gray-500"
              />
              {isSearching && (
                <span className="material-symbols-outlined text-blue-400 text-lg animate-spin">sync</span>
              )}
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
      )}

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
                <div className="text-gray-500 text-[11px] mt-1">
                  {t('alert.altitude', 'Altitude')}: {userPosition.alt.toFixed(0)}m
                </div>
              </>
            ) : (
              <div className="text-gray-400 text-sm">{t('profile.locating', 'Acquiring position...')}</div>
            )}
          </div>
        </div>

        {/* ─── WEATHER WIDGET ─── */}
        <div className="absolute top-[120px] left-4 z-[1000] flex flex-col gap-2">
          <div className="bg-gray-900/80 backdrop-blur-md border border-gray-700/50 rounded-2xl p-2.5 shadow-xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center ${currentWeather.bg} ${currentWeather.color}`}
              >
                <span
                  className={`material-symbols-outlined text-lg ${currentWeather.icon === 'sync' ? 'animate-spin' : ''}`}
                >
                  {currentWeather.icon}
                </span>
              </div>
              <div>
                <div className="text-white font-bold text-sm leading-none">{currentWeather.temp}°C</div>
                <div className="text-gray-400 text-[9px] uppercase tracking-wider mt-0.5">
                  {t(currentWeather.condition)}
                </div>
              </div>
            </div>
            <div className="w-px h-6 bg-gray-700/50"></div>
            <button
              onClick={() => setShowWeatherReport(true)}
              className="w-8 h-8 rounded-full bg-gray-800/80 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 transition-colors active:scale-95"
              title={t('weather.reportWeather', 'Report Weather')}
            >
              <span className="material-symbols-outlined text-sm">edit_location_alt</span>
            </button>
          </div>
        </div>

        {/* --- MAP CONTROLS & LAYERS MENU --- */}
        <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-3">
          {/* Layers Menu Container */}
          <div className="relative">
            <button
              onClick={() => setShowLayerMenu(!showLayerMenu)}
              className={`w-12 h-12 border border-gray-700/50 rounded-full flex items-center justify-center transition-colors shadow-lg active:scale-95 ${
                showLayerMenu ? 'bg-gray-800 text-white' : 'bg-gray-900/90 text-gray-300 hover:bg-gray-800'
              }`}
            >
              <span className="material-symbols-outlined text-xl">layers</span>
            </button>

            {/* Layers Dropdown */}
            {showLayerMenu && (
              <div className="absolute right-14 top-0 bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col w-44 z-[1000] animate-in fade-in zoom-in duration-150">
                <div className="px-3 py-2 bg-gray-800/50 border-b border-gray-700">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    {t('offlineViewer.mapType', 'Map Type')}
                  </span>
                </div>
                {Object.entries(MAP_STYLES).map(([key, style]) => (
                  <button
                    key={key}
                    onClick={() => changeMapStyle(key)}
                    className={`px-4 py-3 text-left text-xs font-bold flex items-center gap-3 border-b border-gray-800/50 last:border-0 transition-colors ${
                      currentMapStyle === key ? 'text-blue-400 bg-gray-800/80' : 'text-gray-300 hover:bg-gray-800/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{style.icon}</span>
                    {t(`mapStyles.${key}`, style.name)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* HAZARD REPORT BUTTON ADDED HERE */}
          <button
            onClick={() => setShowHazardReportModal(true)}
            className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white hover:bg-orange-400 transition-colors shadow-lg shadow-orange-900/30 active:scale-95"
            title="Report Hazard"
          >
            <span className="material-symbols-outlined text-xl">warning</span>
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

        {/* Hazard Alert Notification */}
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

        {/* --- MAIN SOS BUTTON (Bottom Right) --- */}
        <div className="absolute bottom-6 right-4 z-[1000]">
          <button
            className="w-16 h-16 rounded-full bg-red-500 border-4 border-red-400/50 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 transition-all"
            onClick={() => setActiveTab('ALERTS')}
          >
            <span className="material-symbols-outlined text-white text-3xl">sensors</span>
          </button>
        </div>

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

        {/* ─── WEATHER REPORTING MODAL ─── */}
        {showWeatherReport && (
          <div className="absolute inset-0 z-[6000] bg-[#0f141e]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-700/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-white text-lg font-bold">{t('weather.reportWeather', 'Report Weather')}</h3>
                <button
                  onClick={() => setShowWeatherReport(false)}
                  className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <p className="text-gray-400 text-xs mb-5 leading-relaxed">
                {t(
                  'weather.reportHelp',
                  'Help others by reporting the current weather conditions at your exact location.',
                )}
              </p>

              <div className="grid grid-cols-3 gap-3 mb-2">
                {[
                  { condition: 'weather.clear', icon: 'sunny', color: 'text-yellow-400', bg: 'bg-yellow-400/20' },
                  {
                    condition: 'weather.partlyCloudy',
                    icon: 'partly_cloudy_day',
                    color: 'text-yellow-200',
                    bg: 'bg-yellow-200/20',
                  },
                  { condition: 'weather.cloudy', icon: 'cloud', color: 'text-gray-400', bg: 'bg-gray-400/20' },
                  { condition: 'weather.windy', icon: 'air', color: 'text-teal-400', bg: 'bg-teal-400/20' },
                  { condition: 'weather.rain', icon: 'rainy', color: 'text-blue-400', bg: 'bg-blue-400/20' },
                  {
                    condition: 'weather.storm',
                    icon: 'thunderstorm',
                    color: 'text-purple-400',
                    bg: 'bg-purple-400/20',
                  },
                  { condition: 'weather.hail', icon: 'grain', color: 'text-cyan-300', bg: 'bg-cyan-300/20' },
                  { condition: 'weather.snow', icon: 'weather_snowy', color: 'text-white', bg: 'bg-white/20' },
                  { condition: 'weather.fog', icon: 'foggy', color: 'text-gray-300', bg: 'bg-gray-300/20' },
                ].map((w) => (
                  <button
                    key={w.condition}
                    onClick={() => {
                      // Update of the state (maybe sent to supabase later)
                      setCurrentWeather({
                        temp: currentWeather.temp,
                        condition: w.condition,
                        icon: w.icon,
                        color: w.color,
                        bg: w.bg,
                      });
                      setShowWeatherReport(false);
                    }}
                    className="flex flex-col items-center justify-center gap-2 bg-gray-800/40 border border-gray-700/50 hover:bg-gray-700 hover:border-blue-500 rounded-2xl p-3 transition-all active:scale-95"
                  >
                    <span className={`material-symbols-outlined text-2xl ${w.color}`}>{w.icon}</span>
                    <span className="text-gray-300 text-[10px] font-bold uppercase tracking-wider">
                      {t(w.condition)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── HAZARD REPORTING MODAL ADDED HERE ─── */}
        {showHazardReportModal && (
          <div className="absolute inset-0 z-[6000] bg-[#0f141e]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-gray-900 border border-gray-700/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-white text-lg font-bold">Report a Hazard</h3>
                <button
                  onClick={() => setShowHazardReportModal(false)}
                  className="w-8 h-8 flex items-center justify-center bg-gray-800 rounded-full text-gray-400 hover:text-white active:scale-95"
                >
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>

              <p className="text-gray-400 text-xs mb-5 leading-relaxed">
                Warn other ERIS users about immediate dangers at your current location.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-2">
                {[
                  {
                    type: 'fire',
                    icon: 'local_fire_department',
                    label: 'Wildfire',
                    color: 'text-red-400',
                    bg: 'bg-red-400/20',
                  },
                  { type: 'flood', icon: 'water_drop', label: 'Flood', color: 'text-blue-400', bg: 'bg-blue-400/20' },
                  {
                    type: 'road_blocked',
                    icon: 'block',
                    label: 'Road Blocked',
                    color: 'text-orange-400',
                    bg: 'bg-orange-400/20',
                  },
                  {
                    type: 'landslide',
                    icon: 'landslide',
                    label: 'Landslide',
                    color: 'text-purple-400',
                    bg: 'bg-purple-400/20',
                  },
                ].map((hazard) => (
                  <button
                    key={hazard.type}
                    onClick={async () => {
                      if (userPosition.lat !== 0) {
                        await reportHazard(session.user.id, hazard.type as any, userPosition.lat, userPosition.lng);
                        setShowHazardReportModal(false);
                        // Force a quick refresh of the map tab to show the new marker instantly
                        setActiveTab('MAP');
                      }
                    }}
                    className="flex flex-col items-center justify-center gap-2 bg-gray-800/40 border border-gray-700/50 hover:bg-gray-700 hover:border-orange-500 rounded-2xl p-4 transition-all active:scale-95"
                  >
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center ${hazard.bg} ${hazard.color}`}
                    >
                      <span className="material-symbols-outlined text-2xl">{hazard.icon}</span>
                    </div>
                    <span className="text-gray-300 text-xs font-bold">{hazard.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="flex items-center justify-around h-20 bg-[#0f141e]/95 backdrop-blur-md border-t border-gray-800/50 pb-safe z-[1000]">
        {(
          [
            { id: 'ALERTS', icon: 'notifications', label: t('nav.alerts', 'Alerts') },
            { id: 'MAP', icon: 'map', label: t('nav.map', 'Map') },
            { id: 'OFFLINE', icon: 'cloud_download', label: t('nav.offline', 'Offline') },
            { id: 'USER', icon: 'person', label: t('nav.profile', 'Profile') },
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
