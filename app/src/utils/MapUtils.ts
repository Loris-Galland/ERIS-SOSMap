import L from 'leaflet';
import 'leaflet.offline';

export const TILE_URL = 'https://a.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png';

export const createOfflineLayer = () => {
  // Use (L.tileLayer as any) to tell TS to ignore the missing property
  return (L.tileLayer as any).offline(TILE_URL, {
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
