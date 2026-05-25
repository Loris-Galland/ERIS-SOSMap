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
    crossOrigin: true,
  });
};

export const PRESET_REGIONS = [
  {
    id: 1,
    name: 'Paris & Île-de-France',
    size: '345 MB',
    detail: 'Île-de-France',
    bounds: L.latLngBounds([48.5, 2.0], [49.0, 2.7]),
  },
  {
    id: 2,
    name: 'Lyon Metropolitan',
    size: '180 MB',
    detail: 'Auvergne-Rhône-Alpes',
    bounds: L.latLngBounds([45.6, 4.7], [45.9, 5.0]),
  },
  {
    id: 3,
    name: 'Marseille & Calanques',
    size: '210 MB',
    detail: 'PACA',
    bounds: L.latLngBounds([43.1, 5.2], [43.4, 5.5]),
  },
  {
    id: 4,
    name: 'French Alps Sector',
    size: '420 MB',
    detail: 'Savoie / Haute-Savoie',
    bounds: L.latLngBounds([44.5, 5.5], [46.5, 7.5]),
  },
  {
    id: 5,
    name: 'Bordeaux & Gironde',
    size: '150 MB',
    detail: 'Nouvelle-Aquitaine',
    bounds: L.latLngBounds([44.7, -0.7], [45.0, -0.4]),
  },
];
