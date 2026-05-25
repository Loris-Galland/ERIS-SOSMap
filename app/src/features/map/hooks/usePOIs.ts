/*
 * usePOIs — hook that fetches emergency Points of Interest from the Overpass API
 * and renders them as Leaflet markers on the map.
 * Queries are built dynamically from the activeFilters array (POICategory[]) and
 * sent to one of three Overpass mirror endpoints with automatic fallback.
 * Fetches are cancelled via AbortController when filters change or the hook
 * unmounts, and are silently skipped when zoom < 12 to avoid overloading the API.
 * Exports the POICategory union type consumed by MapScreen's filter pill UI.
 */

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

export type POICategory = 
  | 'hospital' | 'police' | 'fire_station' | 'shelter' 
  | 'pharmacy' | 'water' | 'gas' | 'aed' | 'clinic';

interface UsePOIsProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  activeFilters: POICategory[];
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

// Custom icons for each category
const POI_ICONS: Record<POICategory, { icon: string; color: string; bg: string; border: string }> = {
  hospital: { icon: 'local_hospital', color: 'text-hospital', bg: 'bg-poi-bg', border: 'border-hospital'},
  police: { icon: 'local_police', color: 'text-police', bg: 'bg-poi-bg', border: 'border-police'},
  fire_station: { icon: 'local_fire_department', color: 'text-fire-station', bg: 'bg-poi-bg', border: 'border-fire-station'},
  shelter: { icon: 'night_shelter', color: 'text-shelter', bg: 'bg-poi-bg', border: 'border-shelter'},
  pharmacy: { icon: 'local_pharmacy', color: 'text-pharmacie', bg: 'bg-poi-bg', border: 'border-pharmacie'},
  water: { icon: 'water_drop', color: 'text-water-source', bg: 'bg-poi-bg', border: 'border-water-source'},
  gas: { icon: 'local_gas_station', color: 'text-gas-station', bg: 'bg-poi-bg', border: 'border-gas-station'},
  aed: { icon: 'monitor_heart', color: 'text-aed', bg: 'bg-poi-bg', border: 'border-aed'},
  clinic: { icon: 'medical_services', color: 'text-clinic', bg: 'bg-poi-bg', border: 'border-clinic'},
};

export function usePOIs({ mapInstance, activeFilters }: UsePOIsProps) {
  const [isLoading, setIsLoading] = useState(false);
  const markersLayer = useRef<L.LayerGroup | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPOIs = async () => {
    if (!mapInstance.current) {
      setIsLoading(false);
      return;
    }

    // Clear old markers
    if (markersLayer.current) {
      markersLayer.current.remove(); // Safely detaches from any ghost map
      markersLayer.current = null;   // Wipes the memory entirely
    }

    if (activeFilters.length === 0) {
      setIsLoading(false);
      return;
    }

    mapInstance.current.invalidateSize(true);

    // Zoom limit
    if (mapInstance.current.getZoom() < 12) {
      console.warn('Zoomed out too far to fetch POIs. Zoom in closer.');
      setIsLoading(false);
      return; 
    }
    
    // Create layer
    markersLayer.current = L.layerGroup().addTo(mapInstance.current);

    setIsLoading(true);

    // Cancel any pending fetch before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    const bounds = mapInstance.current.getBounds().pad(0.5);
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

    let success = false;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      if (success) break;
        try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: `data=${encodeURIComponent(query)}`,
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
                <div class="w-8 h-8 rounded-full bg-poi-bg border-2 ${style.border} shadow-lg flex items-center justify-center">
                <span class="material-symbols-outlined text-[18px] ${style.color}">${style.icon}</span>
                </div>
                <div class="absolute -bottom-[9px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[8px] border-l-transparent border-r-[8px] border-r-transparent border-t-[12px] border-t-transparent [.theme-contrasted_&]:border-t-black drop-shadow-md -z-10"></div>
                <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[8px] ${style.border} [.theme-contrasted_&]:border-t-white drop-shadow-md"></div>
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
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPOIs();
    }, 400);

    return () => {
      clearTimeout(timer);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [activeFilters]);

  return { isLoading };
}