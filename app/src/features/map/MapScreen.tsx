import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { useGPS } from './hooks/useGPS';
import { useWeather } from './hooks/useWeather';
import { useHazards } from './hooks/useHazards';
import { useMapLayers } from './hooks/useMapLayers';
import DiagnosticsModal from '../../features/settings/DiagnosticsModal';
import { PRESET_REGIONS, MAP_STYLES } from '../../utils/MapUtils';
import { useSOSMarkersAdmin } from '../../features/admin/hooks/useSOSMarkersAdmin';

interface MapScreenProps {
  isActive: boolean;
  visualTheme: string;
  session: any;
  isAdmin: boolean;
  onNavigateToAlerts: () => void;
}

const getGuestId = () => {
  let id = localStorage.getItem('eris_guest_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('eris_guest_id', id);
  }
  return id;
};

export default function MapScreen({ isActive, visualTheme, session, isAdmin, onNavigateToAlerts }: MapScreenProps) {
  const { t } = useTranslation();
  const mapRef = useRef<HTMLDivElement | null>(null);

  const [offlineMode, setOfflineMode] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [previewArea, setPreviewArea] = useState<{
    id: string;
    name: string;
    bounds: L.LatLngBounds;
    isOffline?: boolean;
  } | null>(null);

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [localSearchableRegions, setLocalSearchableRegions] = useState<any[]>([]);

  // ─── HOOKS ───
  const { mapInstance, showLayerMenu, setShowLayerMenu, currentMapStyle, changeMapStyle } = useMapLayers({
    mapRef,
    isActive,
    visualTheme,
  });

  const { userPosition, gpsStatus } = useGPS({ mapInstance, isActive });

  const { currentWeather, setCurrentWeather, showWeatherReport, setShowWeatherReport, fetchWeather } =
    useWeather(offlineMode);

  const { showHazardAlert, setShowHazardAlert, showHazardReportModal, setShowHazardReportModal, handleReportHazard } =
    useHazards({ mapInstance, isActive });

  
    // Admin SOS markers overlay — US40
    useSOSMarkersAdmin({
      mapInstance,
      isActive,
      isAdmin,
    });

  // Fetch weather when GPS position changes
  useEffect(() => {
    if (userPosition.lat !== 0) {
      fetchWeather(userPosition.lat, userPosition.lng);
    }
  }, [userPosition.lat, userPosition.lng]);

  // Fetch weather when map moves
  useEffect(() => {
    if (!mapInstance.current) return;
    const handleMoveEnd = () => {
      const center = mapInstance.current!.getCenter();
      fetchWeather(center.lat, center.lng);
    };
    mapInstance.current.on('moveend', handleMoveEnd);
    return () => {
      mapInstance.current?.off('moveend', handleMoveEnd);
    };
  }, [mapInstance.current]);

  // Invalidate size when coming back to map
  useEffect(() => {
    if (isActive) {
      setTimeout(() => {
        mapInstance.current?.invalidateSize();
      }, 100);
    }
  }, [isActive]);

  // Load local regions for offline search
  useEffect(() => {
    if (!isActive) return;

    const savedCustom = localStorage.getItem('eris_custom_regions');
    const customRegs = savedCustom ? JSON.parse(savedCustom) : [];
    const formattedCustom = customRegs.map((r: any) => ({
      place_id: r.id,
      display_name: `${r.name}, Zone personnalisée`,
      boundingbox: [r.bounds.southWest[0], r.bounds.northEast[0], r.bounds.southWest[1], r.bounds.northEast[1]],
      isOffline: true,
    }));

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
  }, [isActive]);

  // Geographic search with debounce
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      const searchLower = searchQuery.toLowerCase();

      if (offlineMode || !navigator.onLine) {
        const localResults = localSearchableRegions.filter((r) => r.display_name.toLowerCase().includes(searchLower));
        setSearchResults(localResults);
        setIsSearching(false);
        return;
      }

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=4`,
        );
        const data = await res.json();
        setSearchResults(data);
      } catch {
        const localResults = localSearchableRegions.filter((r) => r.display_name.toLowerCase().includes(searchLower));
        setSearchResults(localResults);
      } finally {
        setIsSearching(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, offlineMode, localSearchableRegions]);

  // Handle search result selection
  const handleSelectResult = (item: any) => {
    if (!mapInstance.current) return;

    const bbox = item.boundingbox;
    const bounds = L.latLngBounds(
      [parseFloat(bbox[0]), parseFloat(bbox[2])],
      [parseFloat(bbox[1]), parseFloat(bbox[3])],
    );

    const exactLat = item.lat ? parseFloat(item.lat) : bounds.getCenter().lat;
    const exactLon = item.lon ? parseFloat(item.lon) : bounds.getCenter().lng;
    const targetZoom = Math.min(mapInstance.current.getBoundsZoom(bounds), 14);

    mapInstance.current.flyTo([exactLat, exactLon], targetZoom, {
      animate: true,
      duration: 1.5,
    });

    setPreviewArea({
      id: item.place_id.toString(),
      name: item.display_name.split(',')[0],
      bounds,
      isOffline: item.isOffline,
    });

    setSearchQuery('');
    setSearchResults([]);
  };

  const currentUserId = session?.user?.id || getGuestId();

  return (
    <div className="relative w-full h-full">
      {/* ─── CARTE LEAFLET ─── */}
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* ─── SEARCH & OFFLINE BAR ─── */}
      <div className="flex items-center px-4 py-3 bg-eris-bg/80 backdrop-blur-md z-[9999] gap-3 absolute top-0 left-0 right-0">
        <div className="relative flex-1">
          <div className="flex items-center bg-eris-surface-alt/60 border border-eris-border/50 rounded-full px-4 py-2.5 gap-2 shadow-inner">
            <span className="material-symbols-outlined text-eris-text-muted text-lg">search</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('download.searchPlaceholder', 'Search city or coordinates...')}
              className="bg-transparent text-sm text-eris-text w-full outline-none placeholder-gray-500"
            />
            {isSearching && (
              <span className="material-symbols-outlined text-eris-primary text-lg animate-spin">sync</span>
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-eris-surface-alt border border-eris-border rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[5000]">
              {searchResults.map((result, index) => (
                <button
                  key={index}
                  onClick={() => handleSelectResult(result)}
                  className="px-4 py-3 text-left hover:bg-gray-700 flex items-center gap-3 border-b border-eris-border/50 last:border-0 transition-colors"
                >
                  <span className="material-symbols-outlined text-eris-text-muted">location_on</span>
                  <div className="flex-col overflow-hidden">
                    <span className="text-eris-text text-sm font-bold block truncate">
                      {result.display_name.split(',')[0]}
                    </span>
                    <span className="text-eris-text-subtle text-[10px] block truncate">{result.display_name}</span>
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
              ? 'bg-eris-primary text-eris-text shadow-blue-900/30'
              : 'bg-eris-surface-alt border border-eris-border text-eris-text-muted'
          }`}
        >
          <span className="material-symbols-outlined text-xl">{offlineMode ? 'cloud_off' : 'cloud_download'}</span>
        </button>
      </div>

      {/* ─── LOCATION CARD ─── */}
      <div className="absolute top-20 left-4 z-[1000] pointer-events-none flex flex-col gap-2">
        <div className="bg-eris-surface/80 backdrop-blur-md border border-eris-border/50 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`w-2 h-2 rounded-full ${
                gpsStatus === 'Connected'
                  ? 'bg-eris-success'
                  : 'bg-yellow-500 [.theme-contrasted_&]:!bg-gray-500 animate-pulse'
              }`}
            />
            <span className="text-eris-text-muted text-xs font-semibold">{gpsStatus}</span>
          </div>
          {userPosition.lat !== 0 ? (
            <>
              <div className="text-eris-text text-sm font-mono font-medium">
                {userPosition.lat.toFixed(4)}° N, {userPosition.lng.toFixed(4)}° E
              </div>
              <div className="text-eris-text-subtle text-[11px] mt-1">
                {t('alert.altitude', 'Altitude')}: {userPosition.alt.toFixed(0)}m
              </div>
            </>
          ) : (
            <div className="text-eris-text-muted text-sm">{t('profile.locating', 'Acquiring position...')}</div>
          )}
        </div>
      </div>

      {/* ─── WEATHER WIDGET ─── */}
      <div className="absolute top-[190px] left-4 z-[1000]">
        <div className="bg-eris-surface/80 backdrop-blur-md border border-eris-border/50 rounded-2xl p-2.5 shadow-xl flex items-center gap-4">
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
              <div className="text-eris-text font-bold text-sm leading-none">{currentWeather.temp}°C</div>
              <div className="text-eris-text-muted text-[9px] uppercase tracking-wider mt-0.5">
                {t(currentWeather.condition)}
              </div>
            </div>
          </div>
          <div className="w-px h-6 bg-gray-700/50" />
          <button
            onClick={() => setShowWeatherReport(true)}
            className="w-8 h-8 rounded-full bg-eris-surface-alt/80 flex items-center justify-center text-eris-text-muted hover:text-eris-text hover:bg-gray-700 transition-colors active:scale-95"
            title={t('weather.reportWeather', 'Report Weather')}
          >
            <span className="material-symbols-outlined text-sm">edit_location_alt</span>
          </button>
        </div>
      </div>

      {/* ─── LAYER MENU + CONTROLS ─── */}
      <div className="absolute top-20 right-4 z-[10000] flex flex-col gap-3">
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            className={`w-12 h-12 border border-eris-border/50 rounded-full flex items-center justify-center transition-colors shadow-lg active:scale-95 ${
              showLayerMenu
                ? 'bg-eris-surface-alt text-eris-text'
                : 'bg-eris-surface/90 text-eris-text-muted hover:bg-eris-surface-alt'
            }`}
          >
            <span className="material-symbols-outlined text-xl">layers</span>
          </button>

          {showLayerMenu && (
            <div className="absolute right-14 top-0 bg-eris-surface/95 backdrop-blur-md border border-eris-border rounded-2xl shadow-2xl overflow-hidden flex flex-col w-44 z-[1000] animate-in fade-in zoom-in duration-150">
              <div className="px-3 py-2 bg-eris-surface-alt/50 border-b border-eris-border">
                <span className="text-[10px] font-bold text-eris-text-muted uppercase tracking-wider">
                  {t('offlineViewer.mapType', 'Map Type')}
                </span>
              </div>
              {Object.entries(MAP_STYLES)
                .sort(([keyA], [keyB]) => {
                  const currentDefault =
                    visualTheme === 'light' ? 'light' : visualTheme === 'contrasted' ? 'contrasted' : 'dark';
                  if (keyA === currentDefault) return -1;
                  if (keyB === currentDefault) return 1;
                  return 0;
                })
                .map(([key, style]) => (
                  <button
                    key={key}
                    onClick={() => changeMapStyle(key)}
                    className={`px-4 py-3 text-left text-xs font-bold flex items-center gap-3 border-b border-eris-border/50 last:border-0 transition-colors ${
                      currentMapStyle === key
                        ? 'text-eris-primary bg-eris-surface-alt/80'
                        : 'text-eris-text-muted hover:bg-eris-surface-alt/40'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base">{style.icon}</span>
                    {t(`mapStyles.${key}`, style.name)}
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* // Report hazard button */}
        <button
          onClick={() => setShowHazardReportModal(true)}
          className="w-12 h-12 bg-eris-alert [.theme-dark_&]:bg-orange-400 rounded-full flex items-center justify-center text-white [.theme-contrasted_&]:border-2 [.theme-contrasted_&]:!border-black hover:bg-orange-400 transition-colors shadow-lg shadow-eris-alert/30 active:scale-95"
          title="Report Hazard"
        >
          <span className="material-symbols-outlined [.theme-contrasted_&]:!text-black text-xl">warning</span>
        </button>

        {/* // Re-center on my location button */}
        <button
          onClick={() => {
            if (mapInstance.current && userPosition.lat !== 0) {
              mapInstance.current.setView([userPosition.lat, userPosition.lng], 15);
            }
          }}
          className="w-12 h-12 bg-eris-primary rounded-full flex items-center justify-center text-eris-text [.theme-light_&]:text-white [.theme-contrasted_&]:border-2 [.theme-contrasted_&]:!border-black hover:bg-eris-primary transition-colors shadow-lg shadow-blue-900/30 active:scale-95"
        >
          <span className="material-symbols-outlined [.theme-contrasted_&]:!text-black text-xl">my_location</span>
        </button>
      </div>

      {/* ─── HAZARD ALERT BANNER ─── */}
      {showHazardAlert && (
        <div className="absolute bottom-24 left-4 right-20 z-[1000] animate-fade-in">
          <div className="bg-eris-danger/90 [.theme-contrasted_&]:bg-black backdrop-blur-md rounded-2xl p-4 flex items-start gap-3 shadow-[0_8px_30px_rgba(var(--eris-danger),0.3)] [.theme-contrasted_&]:shadow-none border border-white/30 [.theme-contrasted_&]:border-white">
            <div className="w-8 h-8 rounded-full bg-white/30 [.theme-contrasted_&]:bg-transparent [.theme-contrasted_&]:border [.theme-contrasted_&]:border-white flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white text-lg">warning</span>
            </div>
            <div className="flex-1">
              <h4 className="text-white text-sm font-bold mb-0.5">Area Warning</h4>
              <p className="text-red-100 [.theme-contrasted_&]:text-white text-xs leading-relaxed">
                High avalanche risk reported in your current sector. Avoid steep terrains.
              </p>
            </div>
            <button
              onClick={() => setShowHazardAlert(false)}
              className="text-red-200 hover:text-eris-text transition-colors"
            >
              <span className="material-symbols-outlined [.theme-contrasted_&]:text-white text-xl">close</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── SOS BUTTON ─── */}
      <div className="absolute bottom-6 right-4 z-[1000]">
        <button
          className="w-16 h-16 rounded-full bg-eris-danger border-[3px] border-white/30 [.theme-contrasted_&]:!border-black flex flex-col items-center justify-center shadow-[0_0_20px_rgba(var(--eris-danger),0.4)] [.theme-contrasted_&]:shadow-none active:scale-95 transition-all"
          onClick={onNavigateToAlerts}
        >
          <span className="material-symbols-outlined text-white text-3xl">sensors</span>
        </button>
      </div>

      {/* ─── WEATHER REPORT MODAL ─── */}
      {showWeatherReport && (
        <div className="absolute inset-0 z-[6000] bg-eris-bg/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-eris-surface border border-eris-border/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-eris-text text-lg font-bold">{t('weather.reportWeather', 'Report Weather')}</h3>
              <button
                onClick={() => setShowWeatherReport(false)}
                className="w-8 h-8 flex items-center justify-center bg-eris-surface-alt rounded-full text-eris-text-muted hover:text-eris-text active:scale-95"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <p className="text-eris-text-muted text-xs mb-5 leading-relaxed">
              {t(
                'weather.reportHelp',
                'Help others by reporting the current weather conditions at your exact location.',
              )}
            </p>
            <div className="grid grid-cols-3 gap-3 mb-2">
              {[
                {
                  condition: 'weather.clear',
                  icon: 'sunny',
                  color: 'text-eris-weather-clear',
                  bg: 'bg-eris-weather-clear/20',
                },
                {
                  condition: 'weather.partlyCloudy',
                  icon: 'partly_cloudy_day',
                  color: 'text-eris-weather-partly',
                  bg: 'bg-eris-weather-partly/20',
                },
                {
                  condition: 'weather.cloudy',
                  icon: 'cloud',
                  color: 'text-eris-weather-cloudy',
                  bg: 'bg-eris-weather-cloudy/20',
                },
                {
                  condition: 'weather.windy',
                  icon: 'air',
                  color: 'text-eris-weather-windy',
                  bg: 'bg-eris-weather-windy/20',
                },
                {
                  condition: 'weather.rain',
                  icon: 'rainy',
                  color: 'text-eris-weather-rainy',
                  bg: 'bg-eris-weather-rainy/20',
                },
                {
                  condition: 'weather.storm',
                  icon: 'thunderstorm',
                  color: 'text-eris-weather-storm',
                  bg: 'bg-eris-weather-storm/20',
                },
                {
                  condition: 'weather.hail',
                  icon: 'grain',
                  color: 'text-eris-weather-hail',
                  bg: 'bg-eris-weather-hail/20',
                },
                {
                  condition: 'weather.snow',
                  icon: 'weather_snowy',
                  color: 'text-eris-weather-snow',
                  bg: 'bg-eris-weather-snow/20',
                },
                {
                  condition: 'weather.fog',
                  icon: 'foggy',
                  color: 'text-eris-weather-fog',
                  bg: 'bg-eris-weather-fog/20',
                },
              ].map((w) => (
                <button
                  key={w.condition}
                  onClick={() => {
                    setCurrentWeather({ temp: currentWeather.temp, ...w });
                    setShowWeatherReport(false);
                  }}
                  className="flex flex-col items-center justify-center gap-2 bg-eris-surface-alt/40 border border-eris-border/50 hover:bg-gray-700 hover:border-eris-primary rounded-2xl p-3 transition-all active:scale-95"
                >
                  <span className={`material-symbols-outlined text-2xl ${w.color}`}>{w.icon}</span>
                  <span className="text-eris-text-muted text-[10px] font-bold uppercase tracking-wider">
                    {t(w.condition)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── HAZARD REPORT MODAL ─── */}
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
                  color: 'text-red-400 [.theme-contrasted_&]:text-white',
                  bg: 'bg-red-400/20 [.theme-contrasted_&]:bg-transparent [.theme-contrasted_&]:border [.theme-contrasted_&]:border-white',
                },
                {
                  type: 'flood',
                  icon: 'water_drop',
                  label: 'Flood',
                  color: 'text-blue-400 [.theme-contrasted_&]:text-white',
                  bg: 'bg-blue-400/20 [.theme-contrasted_&]:bg-transparent [.theme-contrasted_&]:border [.theme-contrasted_&]:border-white',
                },
                {
                  type: 'road_blocked',
                  icon: 'block',
                  label: 'Road Blocked',
                  color: 'text-orange-400 [.theme-contrasted_&]:text-white',
                  bg: 'bg-orange-400/20 [.theme-contrasted_&]:bg-transparent [.theme-contrasted_&]:border [.theme-contrasted_&]:border-white',
                },
                {
                  type: 'landslide',
                  icon: 'landslide',
                  label: 'Landslide',
                  color: 'text-purple-400 [.theme-contrasted_&]:text-white',
                  bg: 'bg-purple-400/20 [.theme-contrasted_&]:bg-transparent [.theme-contrasted_&]:border [.theme-contrasted_&]:border-white',
                },
              ].map((hazard) => (
                <button
                  key={hazard.type}
                  onClick={() =>
                    handleReportHazard(currentUserId, hazard.type as any, userPosition.lat, userPosition.lng)
                  }
                  className="flex flex-col items-center justify-center gap-2 bg-gray-800/40 border border-gray-700/50 hover:bg-gray-700 hover:border-orange-500 rounded-2xl p-4 transition-all active:scale-95"
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${hazard.bg} ${hazard.color}`}
                  >
                    <span className="material-symbols-outlined text-2xl">{hazard.icon}</span>
                  </div>
                  <span className="text-eris-text-subtle text-xs font-bold">{hazard.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ─── DIAGNOSTICS ─── */}
      {showDiagnostics && <DiagnosticsModal onClose={() => setShowDiagnostics(false)} gpsStatus={gpsStatus} />}
    </div>
  );
}
