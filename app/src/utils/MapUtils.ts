/*
 * Shared map utilities for the ERIS app.
 * Exports MAP_STYLES (tile provider URLs and metadata), PRESET_REGIONS
 * (predefined French geographic areas for offline download), and
 * createOfflineLayer (factory for leaflet.offline tile layers).
 * Consumed by OfflineMapViewer and the offline feature's download UI.
 */

import L from 'leaflet';
import 'leaflet.offline';

// ─── MAP STYLES DICTIONARY ───
export const MAP_STYLES = {
  dark: {
    id: 'dark',
    name: 'Dark Mode',
    url: 'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png',
    icon: 'dark_mode',
    estimatedSizeFactor: 1, // Base size
  },
  light: {
    id: 'light',
    name: 'Light Mode',
    url: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    icon: 'light_mode',
    estimatedSizeFactor: 1.1,
  },
  contrasted: {
    id: 'contrast',
    name: 'High Contrast',
    url: 'https://tiles.stadiamaps.com/tiles/stamen_toner/{z}/{x}/{y}{r}.png',
    icon: 'contrast',
    estimatedSizeFactor: 1.5,
  },
  terrain: {
    id: 'terrain',
    name: 'Terrain',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    icon: 'terrain',
    estimatedSizeFactor: 1.5,
  },
  terrain_dark: {
    id: 'terrain_dark',
    name: 'Terrain (Dark Mode)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', // Same URL!
    icon: 'nights_stay',
    estimatedSizeFactor: 1.5,
  },
  satellite: {
    id: 'satellite',
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    icon: 'satellite',
    estimatedSizeFactor: 2.5, // Satellite tiles are much heavier
  },
};

export const createOfflineLayer = (url: string = MAP_STYLES.dark.url) => {
  // Use (L.tileLayer as any) to tell TS to ignore the missing property
  return (L.tileLayer as any).offline(url, {
    attribution: 'ERIS Safety',
    minZoom: 12,
    maxZoom: 17,
    crossOrigin: true
  });
};

export const PRESET_REGIONS = [
  {
    id: 1,
    name: 'regions.paris.name',
    size: '150 MB',
    detail: 'regions.paris.country',
    bounds: L.latLngBounds([48.815, 2.225], [48.902, 2.469]),
  },
  {
    id: 2,
    name: 'regions.new_york.name',
    size: '450 MB',
    detail: 'regions.new_york.country',
    bounds: L.latLngBounds([40.477, -74.259], [40.917, -73.700]),
  },
  {
    id: 3,
    name: 'regions.antananarivo.name',
    size: '120 MB',
    detail: 'regions.antananarivo.country',
    bounds: L.latLngBounds([-18.980, 47.440], [-18.760, 47.590]),
  },
  {
    id: 4,
    name: 'regions.hanoi.name',
    size: '180 MB',
    detail: 'regions.hanoi.country',
    bounds: L.latLngBounds([20.950, 105.750], [21.100, 105.900]),
  },
  {
    id: 5,
    name: 'regions.beijing.name',
    size: '420 MB',
    detail: 'regions.beijing.country',
    bounds: L.latLngBounds([39.700, 116.200], [40.100, 116.600]),
  }
];