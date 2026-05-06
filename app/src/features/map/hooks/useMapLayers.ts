import { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import { MAP_STYLES, createOfflineLayer } from '../../../utils/MapUtils';

interface UseMapLayersProps {
  mapRef: React.RefObject<HTMLDivElement | null>;
  isActive: boolean;
  visualTheme: string;
}

export function useMapLayers({ mapRef, isActive, visualTheme }: UseMapLayersProps) {
  const mapInstance = useRef<L.Map | null>(null);
  const baseLayerRef = useRef<any>(null);
  const [showLayerMenu, setShowLayerMenu] = useState(false);
  const [currentMapStyle, setCurrentMapStyle] = useState<string>(() => {
    const theme = localStorage.getItem('eris_theme') || 'dark';
    return theme === 'light' ? 'light' : theme === 'contrasted' ? 'contrasted' : 'dark';
  });

  useEffect(() => {
    if (!isActive || !mapRef.current || mapInstance.current) return;

    const styleKey = visualTheme === 'light' ? 'light' : visualTheme === 'contrasted' ? 'contrasted' : 'dark';
    const initialUrl = MAP_STYLES[styleKey as keyof typeof MAP_STYLES].url;

    mapInstance.current = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([20, 0], 3);

    baseLayerRef.current = createOfflineLayer(initialUrl);
    baseLayerRef.current.addTo(mapInstance.current);

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
      baseLayerRef.current = null;
    };
  }, [isActive, mapRef, visualTheme]);

  // Met à jour le style quand le thème change
  useEffect(() => {
    if (!mapInstance.current || !baseLayerRef.current) return;
    const styleKey = visualTheme === 'light' ? 'light' : visualTheme === 'contrasted' ? 'contrasted' : 'dark';
    baseLayerRef.current.setUrl(MAP_STYLES[styleKey as keyof typeof MAP_STYLES].url);
    setCurrentMapStyle(styleKey);
  }, [visualTheme]);

  const changeMapStyle = (styleKey: string) => {
    if (!baseLayerRef.current) return;
    baseLayerRef.current.setUrl(MAP_STYLES[styleKey as keyof typeof MAP_STYLES].url);
    setCurrentMapStyle(styleKey);
    setShowLayerMenu(false);
  };

  return {
    mapInstance,
    baseLayerRef,
    showLayerMenu,
    setShowLayerMenu,
    currentMapStyle,
    changeMapStyle,
  };
}