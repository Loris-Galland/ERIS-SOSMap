import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

export type POICategory = 
  | 'hospital' | 'police' | 'fire_station' | 'shelter' 
  | 'pharmacy' | 'water' | 'gas' | 'aed' | 'clinic';

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
  pharmacy: { icon: 'local_pharmacy', color: 'text-emerald-500', bg: 'bg-white' },
  water: { icon: 'water_drop', color: 'text-cyan-500', bg: 'bg-white' },
  gas: { icon: 'local_gas_station', color: 'text-slate-600', bg: 'bg-white' },
  aed: { icon: 'monitor_heart', color: 'text-rose-600', bg: 'bg-white' },
  clinic: { icon: 'medical_services', color: 'text-red-400', bg: 'bg-white' },
};

export function usePOIs({ mapInstance, activeFilters }: UsePOIsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPOIs = async () => {
    if (!mapInstance.current) return;

    // Zoom limit
    if (mapInstance.current.getZoom() < 12) {
        console.warn('Zoomed out too far to fetch POIs. Zoom in closer.');
      setIsLoading(false);
      if (markersLayer.current) markersLayer.current.clearLayers();
      return; 
    }
    
    // Create layer if it doesn't exist
    if (!markersLayer.current) {
      markersLayer.current = L.layerGroup().addTo(mapInstance.current);
    }
    
    // Clear old markers
    markersLayer.current.clearLayers();

    if (activeFilters.length === 0) return;

    setIsLoading(true);

    // Cancel any pending fetch before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    const bounds = mapInstance.current.getBounds();
    const bbox = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;

    let query = `[out:json][timeout:25];(`;
    if (activeFilters.includes('hospital')) query += `nwr["amenity"="hospital"](${bbox});`;
    if (activeFilters.includes('police')) query += `nwr["amenity"="police"](${bbox});`;
    if (activeFilters.includes('fire_station')) query += `nwr["amenity"="fire_station"](${bbox});`;
    if (activeFilters.includes('shelter')) {
      query += `nwr["amenity"="social_facility"]["social_facility"="shelter"](${bbox});`;
      query += `nwr["social_facility"="shelter"](${bbox});`; 
      query += `nwr["amenity"="shelter"](${bbox});`; 
    }
    if (activeFilters.includes('pharmacy')) query += `nwr["amenity"="pharmacy"](${bbox});`;
    if (activeFilters.includes('water')) query += `nwr["amenity"="drinking_water"](${bbox});`;
    if (activeFilters.includes('gas')) query += `nwr["amenity"="fuel"](${bbox});`;
    if (activeFilters.includes('aed')) query += `nwr["emergency"="defibrillator"](${bbox});`;
    if (activeFilters.includes('clinic')) query += `nwr["amenity"="clinic"](${bbox});`;
    query += `);out center;`;

    try {
      const encodedQuery = encodeURIComponent(query);
      
      const response = await fetch(`https://overpass-api.de/api/interpreter?data=${encodedQuery}`, {
        method: 'GET',
        signal, 
      });

      if (!response.ok) {
        throw new Error(`Overpass API Error: ${response.status}`);
      }

      const data = await response.json();

      data.elements.forEach((element: any) => {
        const lat = element.lat || element.center?.lat;
        const lon = element.lon || element.center?.lon;

        
        if (!lat || !lon) return;

        let category: POICategory | null = null;
        if (element.tags?.amenity === 'hospital') category = 'hospital';
        else if (element.tags?.amenity === 'police') category = 'police';
        else if (element.tags?.amenity === 'fire_station') category = 'fire_station';
        else if (element.tags?.social_facility === 'shelter' || element.tags?.amenity === 'shelter') category = 'shelter';
        else if (element.tags?.amenity === 'pharmacy') category = 'pharmacy';
        else if (element.tags?.amenity === 'drinking_water') category = 'water';
        else if (element.tags?.amenity === 'fuel') category = 'gas';
        else if (element.tags?.emergency === 'defibrillator') category = 'aed';
        else if (element.tags?.amenity === 'clinic') category = 'clinic';

        if (!category) return;

        const style = POI_ICONS[category];
        
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

        let name = element.tags?.name;
        if (!name) {
           if (category === 'water') name = 'Drinking Water';
           else if (category === 'aed') name = 'Defibrillator (AED)';
           else name = 'Unknown Facility';
        }

        L.marker([lat, lon], { icon: customIcon })
          .bindPopup(`<strong class="text-sm font-sans">${name}</strong>`)
          .addTo(markersLayer.current!);
      });
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Fetch aborted.');
      } else {
        console.error("Failed to fetch POIs:", error);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Refetch ONLY when filters change
  useEffect(() => {
    fetchPOIs();
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [activeFilters]);

  return { isLoading };
}