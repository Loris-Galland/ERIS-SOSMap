import L from 'leaflet';
import 'leaflet.offline';

export const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png';

export const createOfflineLayer = () => {
  // Use (L.tileLayer as any) to tell TS to ignore the missing property
  return (L.tileLayer as any).offline(TILE_URL, {
    attribution: 'ERIS Safety',
    subdomains: 'abcd',
    minZoom: 12,
    maxZoom: 15,
    crossOrigin: true,
  });
};
