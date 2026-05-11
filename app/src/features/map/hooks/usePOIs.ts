import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

export type POICategory = 'hospital' | 'police' | 'fire_station' | 'shelter';

interface UsePOIsProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  activeFilters: POICategory[];
}

// Custom icons for each category
const POI_ICONS: Record<POICategory, { icon: string; color: string; bg: string }> = {
  hospital: { icon: 'local_hospital', color: 'text-red-500', bg: 'bg-white' },
  police: { icon: 'local_police', color: 'text-blue-600', bg: 'bg-white' },
  fire_station: { icon: 'local_fire_department', color: 'text-orange-500', bg: 'bg-white' },
  shelter: { icon: 'night_shelter', color: 'text-green-600', bg: 'bg-white' },
};

export function usePOIs({ mapInstance, activeFilters }: UsePOIsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const markersLayer = useRef<L.LayerGroup | null>(null);

  // Initialize the LayerGroup once
  useEffect(() => {
    if (mapInstance.current && !markersLayer.current) {
      markersLayer.current = L.layerGroup().addTo(mapInstance.current);
    }
  }, [mapInstance.current]);

  const fetchPOIs = async () => {
    if (!mapInstance.current || !markersLayer.current) return;
    
    // Clear existing markers
    markersLayer.current.clearLayers();

    if (activeFilters.length === 0) return;

    setIsLoading(true);

    // Get the current visible boundaries of the map
    const bounds = mapInstance.current.getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

    // Build the Overpass query based on active filters
    let query = `[out:json][timeout:25];(`;
    if (activeFilters.includes('hospital')) query += `node["amenity"="hospital"](${bbox});`;
    if (activeFilters.includes('police')) query += `node["amenity"="police"](${bbox});`;
    if (activeFilters.includes('fire_station')) query += `node["amenity"="fire_station"](${bbox});`;
    if (activeFilters.includes('shelter')) {
      query += `node["amenity"="social_facility"]["social_facility"="shelter"](${bbox});`;
      query += `node["social_facility"="shelter"](${bbox});`; // Backup tag
    }
    query += `);out body;>;out skel qt;`;

    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: query,
      });
      const data = await response.json();

      data.elements.forEach((node: any) => {
        if (node.type !== 'node') return;

        // Determine category for the icon
        let category: POICategory | null = null;
        if (node.tags?.amenity === 'hospital') category = 'hospital';
        else if (node.tags?.amenity === 'police') category = 'police';
        else if (node.tags?.amenity === 'fire_station') category = 'fire_station';
        else if (node.tags?.social_facility === 'shelter') category = 'shelter';

        if (!category) return;

        const style = POI_ICONS[category];
        
        // Create a beautiful HTML icon using Tailwind and Material Symbols
        const customIcon = L.divIcon({
          className: 'custom-poi-marker',
          html: `
            <div class="w-8 h-8 rounded-full ${style.bg} border-2 border-gray-200 shadow-lg flex items-center justify-center">
              <span class="material-symbols-outlined text-[18px] ${style.color}">${style.icon}</span>
            </div>
            <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] border-t-white drop-shadow-md"></div>
          `,
          iconSize: [32, 40],
          iconAnchor: [16, 40],
          popupAnchor: [0, -40],
        });

        // Add to map with a popup containing the name
        const name = node.tags?.name || 'Unknown Facility';
        L.marker([node.lat, node.lon], { icon: customIcon })
          .bindPopup(`<strong class="text-sm font-sans">${name}</strong>`)
          .addTo(markersLayer.current!);
      });
    } catch (error) {
      console.error("Failed to fetch POIs", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Refetch when filters change or when the map stops moving
  useEffect(() => {
    if (!mapInstance.current) return;
    
    fetchPOIs();

    const handleMoveEnd = () => fetchPOIs();
    mapInstance.current.on('moveend', handleMoveEnd);

    return () => {
      mapInstance.current?.off('moveend', handleMoveEnd);
    };
  }, [activeFilters, mapInstance.current]);

  return { isLoading };
}