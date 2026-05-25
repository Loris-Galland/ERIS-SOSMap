/*
 * MapScreen — the primary map view of the ERIS app, rendered when the map tab is active.
 * Composes useMapLayers (Leaflet init), useGPS (position tracking), useWeather,
 * useHazards, usePOIs, useFallDetection, useCrashDetection, useInactivityMonitoring,
 * and useSOSMarkersAdmin into a single interactive screen.
 * Handles geographic search via Nominatim (online) or cached local regions (offline),
 * POI filter pills, layer switching, and automatic SOS dispatch on detected emergencies.
 * Exported as the default component consumed by App.tsx tab navigation.
 */

import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import L from 'leaflet';
import { useGPS } from './hooks/useGPS';
import { useWeather } from './hooks/useWeather';
import { useHazards } from './hooks/useHazards';
import { useMapLayers } from './hooks/useMapLayers';
import DiagnosticsModal from '../../features/settings/DiagnosticsModal';
import { PRESET_REGIONS, MAP_STYLES } from '../../utils/MapUtils';
import { useSOSMarkersAdmin } from '../../features/admin/hooks/useSOSMarkersAdmin';
import { usePOIs, type POICategory } from './hooks/usePOIs';
import { useFallDetection } from '../sos/hooks/useFallDetection';
import FallDetectionModal from '../../components/FallDetectionModal';
import { dispatchSOS } from '../../services/sosService';
import { useCrashDetection } from '../sos/hooks/useCrashDetection';
import { useInactivityMonitoring } from '../sos/hooks/useInactivityMonitoring';
import InactivityModal from '../../components/InactivityModal';

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
  const [isMapReady, setIsMapReady] = useState(false);
  const currentUserId = session?.user?.id || getGuestId();

  const [offlineMode, setOfflineMode] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [activeFilters, setActiveFilters] = useState<POICategory[]>([]);
  const [isLocationExpanded, setIsLocationExpanded] = useState(false);
  const [isWeatherExpanded, setIsWeatherExpanded] = useState(false);
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
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localSearchableRegions, setLocalSearchableRegions] = useState<any[]>([]);

  // Fall detection state
  const [showFallModal, setShowFallModal] = useState(false);

  // Inactivity monitoring state
  const [showInactivityModal, setShowInactivityModal] = useState(false);

  // ─── HOOKS ───
  const { mapInstance, showLayerMenu, setShowLayerMenu, currentMapStyle, changeMapStyle } = useMapLayers({
    mapRef,
    isActive,
    visualTheme,
  });

  const { userPosition, gpsStatus } = useGPS({ mapInstance, isActive });

  const { currentWeather, setCurrentWeather, showWeatherReport, setShowWeatherReport, fetchWeather } =
    useWeather(offlineMode);

  // Passing isAdmin and fetching the modal states/functions
  const {
    showHazardAlert,
    setShowHazardAlert,
    showHazardReportModal,
    setShowHazardReportModal,
    handleReportHazard,
    hazardToDelete,
    setHazardToDelete,
    handleDeleteHazard,
  } = useHazards({ mapInstance, isActive, isAdmin, isMapReady });

  const { isLoading: isPoisLoading } = usePOIs({ mapInstance, activeFilters });

  const toggleFilter = (category: POICategory) => {
    setActiveFilters((prev) => (prev.includes(category) ? [] : [category]));
  };

  // Admin SOS markers overlay — US40
  useSOSMarkersAdmin({
    mapInstance,
    isActive,
    isAdmin,
  });

  // Logic for fall detection
  const handleFallDetected = useCallback(() => {
    console.log('🚨 FALL DETECTED BY ACCELEROMETER!');
    setShowFallModal(true);
  }, []);

  // Activate continuous fall detection
  useFallDetection(handleFallDetected, true);

  // Logic for motorcycle crash detection
  const handleCrashDetected = useCallback(() => {
    console.log('🚨 MOTORCYCLE CRASH DETECTED!');
    setShowFallModal(true); // Reuses the red countdown modal with the siren
  }, []);

  // Compute speed safely or default to 0 if useGPS doesn't provide it yet
  const currentSpeed = (userPosition as any).speed || 0;

  // Activate continuous crash detection based on GPS speed and impact forces
  useCrashDetection({
    currentSpeedKmh: currentSpeed,
    onCrashDetected: handleCrashDetected,
    isActive: isActive,
  });

  const handleSOSConfirm = async () => {
    setShowFallModal(false);

    // Check if we have a valid position
    if (userPosition.lat !== 0 && userPosition.lng !== 0) {
      try {
        await dispatchSOS(
          currentUserId,
          { lat: userPosition.lat, lng: userPosition.lng, alt: userPosition.alt },
          100,
          'AUTOMATIC FALL/CRASH DETECTED',
        );
        console.log('SOS SENT AUTOMATICALLY!');
        onNavigateToAlerts();
      } catch (error) {
        console.error('Failed to send SOS:', error);
        alert(t('fall.sosFailed', 'Failed to send SOS. Please try again manually.'));
      }
    } else {
      console.warn('Cannot send SOS: No GPS location available.');
      alert(t('fall.noGps', 'Cannot send SOS: Acquiring position...'));
      onNavigateToAlerts();
    }
  };

  // --- Logic for Inactivity Monitoring ---
  const handleInactivityDetected = useCallback(() => {
    console.log('🚨 PROLONGED INACTIVITY DETECTED!');
    setShowInactivityModal(true);
  }, []);

  const { resetTimer: resetInactivityTimer } = useInactivityMonitoring(handleInactivityDetected, true);

  const handleInactivityCancel = () => {
    setShowInactivityModal(false);
    resetInactivityTimer(); // Restart the clock because the user is fine
  };

  const handleInactivitySOS = async () => {
    setShowInactivityModal(false);

    // Check if we have a valid position
    if (userPosition.lat !== 0 && userPosition.lng !== 0) {
      try {
        await dispatchSOS(
          currentUserId,
          { lat: userPosition.lat, lng: userPosition.lng, alt: userPosition.alt },
          100,
          'AUTOMATIC SOS: PROLONGED INACTIVITY DETECTED',
        );
        onNavigateToAlerts();
      } catch (error) {
        console.error('Failed to send SOS:', error);
      }
    } else {
      console.warn('Cannot send SOS: No GPS location available.');
      onNavigateToAlerts();
    }
  };

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
        setIsMapReady(true);
      }, 100);
    }
  }, [isActive]);

  // Safely clear POIs when leaving to prevent 0-pixel boundary crashes
  useEffect(() => {
    if (!isActive) {
      setActiveFilters([]);
    } else {
      const timer = setTimeout(() => {
        if (mapInstance.current) {
          mapInstance.current.invalidateSize(true);
        }
        setIsMapReady(true);
      }, 350);

      return () => clearTimeout(timer);
    }
  }, [isActive]);

  // Load local regions for offline search
  useEffect(() => {
    if (!isActive) return;

    const savedCustom = localStorage.getItem('eris_custom_regions');
    const customRegs = savedCustom ? JSON.parse(savedCustom) : [];
    const formattedCustom = customRegs.map((r: any) => ({
      place_id: r.id,
      display_name: `${r.name}, Custom zone`,
      boundingbox: [r.bounds.southWest[0], r.bounds.northEast[0], r.bounds.southWest[1], r.bounds.northEast[1]],
      isOffline: true,
    }));

    const savedOffline = localStorage.getItem('eris_offline_regions');
    const downloadedIds = savedOffline ? JSON.parse(savedOffline) : [];
    const downloadedPresets = PRESET_REGIONS.filter((pr) => downloadedIds.includes(pr.id)).map((pr) => ({
      place_id: pr.id.toString(),
      display_name: `${pr.name}, Saved zone`,
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

  // ─── SOFT REFRESH FUNCTION ───
  const handleSoftRefresh = () => {
    setIsRefreshing(true);

    if (mapInstance.current) {
      mapInstance.current.invalidateSize(true);
    }

    setTimeout(() => {
      if (userPosition.lat !== 0) {
        fetchWeather(userPosition.lat, userPosition.lng);
      }

      if (activeFilters.length > 0) {
        const currentFilters = [...activeFilters];
        setActiveFilters([]);

        setTimeout(() => {
          setActiveFilters(currentFilters);

          // Apply the Map Jolt to force fresh data fetch on refresh
          if (mapInstance.current) {
            mapInstance.current.panBy([1, 1], { animate: false });
            setTimeout(() => {
              mapInstance.current?.panBy([-1, -1], { animate: false });
            }, 50);
          }
        }, 50);
      } else {
        // Even if no pills are active, fire a moveend to refresh background layers
        mapInstance.current?.fire('moveend');
      }
    }, 150);

    setTimeout(() => {
      setIsRefreshing(false);
    }, 800);
  };

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

  return (
    <div className="relative w-full h-full">
      {/* ─── LEAFLET MAP ─── */}
      <div ref={mapRef} className="absolute inset-0 z-0" />

      {/* ─── SEARCH & REFRESH BAR ─── */}
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

        {/* ─── REFRESH BUTTON ─── */}
        <button
          onClick={handleSoftRefresh}
          disabled={isRefreshing}
          className="flex items-center justify-center w-11 h-11 rounded-full transition-colors shadow-lg bg-eris-surface-alt border border-eris-border text-eris-text-muted hover:bg-gray-700 hover:text-eris-text active:scale-95"
          title={t('refresh', 'Refresh Map')}
        >
          <span className={`material-symbols-outlined text-xl ${isRefreshing ? 'animate-spin text-eris-primary' : ''}`}>
            refresh
          </span>
        </button>
      </div>

      {/* ─── POI FILTER PILLS (Google Maps Style) ─── */}
      <div
        className="absolute top-[80px] left-0 w-full z-[9998] flex gap-2 overflow-x-auto pb-1 px-4 mask-fade-edges [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {[
          {
            id: 'hospital',
            label: t('poi.hospital', 'Hospitals'),
            icon: 'local_hospital',
            color: 'text-red-500 [.theme-contrasted_&]:!text-white',
          },
          {
            id: 'clinic',
            label: t('poi.clinic', 'Clinics'),
            icon: 'medical_services',
            color: 'text-red-400 [.theme-contrasted_&]:!text-white',
          },
          {
            id: 'pharmacy',
            label: t('poi.pharmacy', 'Pharmacies'),
            icon: 'local_pharmacy',
            color: 'text-emerald-500 [.theme-contrasted_&]:!text-white',
          },
          {
            id: 'aed',
            label: t('poi.aed', 'AEDs'),
            icon: 'monitor_heart',
            color: 'text-rose-600 [.theme-contrasted_&]:!text-white',
          },
          {
            id: 'police',
            label: t('poi.police', 'Police'),
            icon: 'local_police',
            color: 'text-blue-500 [.theme-contrasted_&]:!text-white',
          },
          {
            id: 'fire_station',
            label: t('poi.fire', 'Fire Stations'),
            icon: 'local_fire_department',
            color: 'text-orange-500 [.theme-contrasted_&]:!text-white',
          },
          {
            id: 'shelter',
            label: t('poi.shelter', 'Shelters'),
            icon: 'night_shelter',
            color: 'text-green-500 [.theme-contrasted_&]:!text-white',
          },
          {
            id: 'water',
            label: t('poi.water', 'Water'),
            icon: 'water_drop',
            color: 'text-cyan-500 [.theme-contrasted_&]:!text-white',
          },
          {
            id: 'gas',
            label: t('poi.gas', 'Gas Stations'),
            icon: 'local_gas_station',
            color: 'text-slate-600 [.theme-contrasted_&]:!text-white',
          },
        ].map((filter) => {
          const isSelected = activeFilters.includes(filter.id as POICategory);
          const showSpinner = isSelected && isPoisLoading;
          return (
            <button
              key={filter.id}
              onClick={() => toggleFilter(filter.id as POICategory)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-all shadow-sm active:scale-95 shrink-0 ${
                isSelected
                  ? 'bg-eris-surface border-eris-primary text-eris-text'
                  : 'bg-eris-surface-alt/80 [.theme-contrasted_&]:bg-eris-surface-alt/90 border-eris-border/50 text-eris-text-muted hover:bg-gray-700'
              }`}
            >
              {/* If loading, show spinning arrows. Otherwise, show normal icon */}
              <span
                className={`material-symbols-outlined text-[16px] transition-all ${
                  isSelected ? filter.color : 'text-inherit'
                } ${showSpinner ? 'animate-spin' : ''}`}
              >
                {showSpinner ? 'sync' : filter.icon}
              </span>
              {filter.label}
            </button>
          );
        })}

        {/* Loading spinner while fetching from Overpass */}
        {isPoisLoading && (
          <div className="flex items-center justify-center px-2">
            <span className="material-symbols-outlined animate-spin text-eris-text-muted text-sm">sync</span>
          </div>
        )}
      </div>

      {/* ─── LOCATION AND WEATHER ─── */}
      <div className="absolute top-[120px] left-4 z-[1000] flex flex-col gap-3 items-start">
        {/* LOCATION WIDGET */}
        {!isLocationExpanded ? (
          <button
            onClick={() => setIsLocationExpanded(true)}
            className={`w-12 h-12 backdrop-blur-md border border-eris-border/50 rounded-full flex items-center justify-center transition-colors shadow-lg active:scale-95 ${
              gpsStatus === 'Connected'
                ? 'bg-eris-success/20 [.theme-contrasted_&]:bg-eris-surface'
                : gpsStatus === 'Locating...'
                  ? 'bg-yellow-500/20 [.theme-contrasted_&]:bg-gray-500'
                  : 'bg-eris-danger/20 [.theme-contrasted_&]:bg-gray-500'
            }`}
            title="Expand Location"
          >
            <div className="relative flex items-center justify-center">
              {/* Satellite status-indicator */}
              <span className={gpsStatus === 'Locating...' ? 'animate-pulse' : ''}>
                <span
                  className={`material-symbols-outlined text-xl transition-all block ${
                    gpsStatus === 'Connected'
                      ? 'text-eris-success'
                      : gpsStatus === 'Locating...'
                        ? 'text-eris-alert animate-spin'
                        : 'text-eris-danger'
                  }`}
                >
                  {gpsStatus === 'Connected'
                    ? 'satellite_alt'
                    : gpsStatus === 'Locating...'
                      ? 'sync'
                      : 'location_disabled'}
                </span>
              </span>
            </div>
          </button>
        ) : (
          <div
            onClick={() => setIsLocationExpanded(false)}
            className="bg-eris-surface/80 backdrop-blur-md border border-eris-border/50 rounded-2xl p-4 shadow-xl cursor-pointer hover:bg-eris-surface/90 transition-colors"
            title="Click to minimize"
          >
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  gpsStatus === 'Connected'
                    ? 'bg-eris-success'
                    : 'bg-yellow-500 [.theme-contrasted_&]:!bg-gray-500 animate-pulse'
                }`}
              />
              <span className="text-eris-text-muted text-xs font-semibold flex-1">{gpsStatus}</span>
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
        )}

        {/* WEATHER WIDGET */}
        {!isWeatherExpanded ? (
          <button
            onClick={() => setIsWeatherExpanded(true)}
            className={`w-12 h-12 backdrop-blur-md border border-eris-border/50 rounded-full flex items-center justify-center transition-colors shadow-lg active:scale-95 ${currentWeather.bg} [.theme-contrasted_&]:bg-eris-surface`}
            title="Expand Weather"
          >
            <span
              className={`material-symbols-outlined text-xl ${currentWeather.color} ${
                currentWeather.icon === 'sync' ? 'animate-spin' : ''
              }`}
            >
              {currentWeather.icon}
            </span>
          </button>
        ) : (
          <div
            onClick={() => setIsWeatherExpanded(false)}
            className="bg-eris-surface/80 backdrop-blur-md border border-eris-border/50 rounded-2xl p-2.5 shadow-xl flex items-center gap-4 cursor-pointer hover:bg-eris-surface/90 transition-colors"
            title="Click to minimize"
          >
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
                <div className="text-eris-text font-bold text-sm leading-none flex justify-between items-center">
                  {currentWeather.temp}°C
                </div>
                <div className="text-eris-text-muted text-[9px] uppercase tracking-wider mt-0.5">
                  {t(currentWeather.condition)}
                </div>
              </div>
            </div>
            <div className="w-px h-6 bg-gray-700/50" />
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevents minimizing the widget when clicking "Report"
                setShowWeatherReport(true);
              }}
              className="w-8 h-8 rounded-full bg-eris-surface-alt/80 flex items-center justify-center text-eris-text-muted hover:text-eris-text hover:bg-gray-700 transition-colors active:scale-95"
              title={t('weather.reportWeather', 'Report Weather')}
            >
              <span className="material-symbols-outlined text-sm">edit_location_alt</span>
            </button>
          </div>
        )}
      </div>

      {/* ─── LAYER MENU + CONTROLS ─── */}
      <div className="absolute top-[120px] right-4 z-[10000] flex flex-col gap-3">
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

        {/* Report hazard button */}
        <button
          onClick={() => setShowHazardReportModal(true)}
          className="w-12 h-12 bg-eris-alert [.theme-dark_&]:bg-orange-400 rounded-full flex items-center justify-center text-white [.theme-contrasted_&]:border-2 [.theme-contrasted_&]:!border-black hover:bg-orange-400 transition-colors shadow-lg shadow-eris-alert/30 active:scale-95"
          title="Report Hazard"
        >
          <span className="material-symbols-outlined [.theme-contrasted_&]:!text-black text-xl">warning</span>
        </button>

        {/* Re-center on my location button */}
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
        <div className="absolute inset-0 z-[18000] bg-eris-bg/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
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
        <div className="absolute inset-0 z-[18000] bg-[#0f141e]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
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

      {/* ─── HAZARD DELETE CONFIRMATION MODAL ─── */}
      {hazardToDelete && (
        <div className="absolute inset-0 z-[19000] bg-[#0f141e]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-gray-900 border border-gray-700/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white text-lg font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-red-500">warning</span>
                {t('hazard.deleteTitle', 'Delete Alert')}
              </h3>
            </div>
            <p className="text-gray-300 text-sm mb-6 leading-relaxed">
              {t('hazard.deleteConfirm', 'Are you sure you want to permanently delete this hazard alert?')}
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setHazardToDelete(null)}
                className="flex-1 py-3 bg-gray-800 text-white rounded-xl font-bold hover:bg-gray-700 transition-colors"
              >
                {t('common.cancel', 'Cancel')}
              </button>
              <button
                onClick={handleDeleteHazard}
                className="flex-1 py-3 bg-red-500/20 border border-red-500/50 text-red-400 rounded-xl font-bold hover:bg-red-500 hover:text-white transition-colors"
              >
                {t('common.delete', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DIAGNOSTICS ─── */}
      {showDiagnostics && <DiagnosticsModal onClose={() => setShowDiagnostics(false)} gpsStatus={gpsStatus} />}

      {/* ─── FALL DETECTION MODAL ─── */}
      {showFallModal && <FallDetectionModal onCancel={() => setShowFallModal(false)} onConfirmSOS={handleSOSConfirm} />}

      {/* ─── INACTIVITY MODAL ─── */}
      {showInactivityModal && <InactivityModal onCancel={handleInactivityCancel} onConfirmSOS={handleInactivitySOS} />}
    </div>
  );
}
