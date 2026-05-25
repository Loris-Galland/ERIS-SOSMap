import { useState, useRef, useEffect, useCallback } from 'react';
import L from 'leaflet';
import { fetchHazards, reportHazard, removeHazard } from '../../../services/hazardService';
import { supabase } from '../../../db/supabaseClient';

interface UseHazardsProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  isActive: boolean;
  isAdmin: boolean;
  isMapReady: boolean;
}

export function useHazards({ mapInstance, isActive, isAdmin, isMapReady }: UseHazardsProps) {
  const [hazardsList, setHazardsList] = useState<any[]>([]);
  const [showHazardAlert, setShowHazardAlert] = useState(true);
  const [showHazardReportModal, setShowHazardReportModal] = useState(false);
  const [hazardToDelete, setHazardToDelete] = useState<string | null>(null);
  const hazardLayerGroup = useRef<L.LayerGroup | null>(null);

  const loadHazards = useCallback(async () => {
    if (!mapInstance.current) return;

    if (!hazardLayerGroup.current) {
      hazardLayerGroup.current = L.layerGroup().addTo(mapInstance.current);
    }

    const hazards = await fetchHazards();
    setHazardsList(hazards);

    hazardLayerGroup.current?.clearLayers();

    hazards.forEach((hazard: any) => {
      let iconHtml = '';
      let colorClass = '';

      switch (hazard.type) {
        case 'fire': iconHtml = 'local_fire_department'; colorClass = 'bg-red-500'; break;
        case 'flood': iconHtml = 'water_drop'; colorClass = 'bg-blue-500'; break;
        case 'road_blocked': iconHtml = 'block'; colorClass = 'bg-orange-500'; break;
        case 'landslide': iconHtml = 'landslide'; colorClass = 'bg-purple-500'; break;
      }

      const icon = L.divIcon({
        className: '',
        html: `<div class="w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-md ${colorClass} [.theme-contrasted_&]:!bg-black [.theme-contrasted_&]:!border-white [.theme-contrasted_&]:!shadow-none">
            <span class="material-symbols-outlined text-white text-[18px]">${iconHtml}</span>
          </div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      if (hazardLayerGroup.current) {
        const marker = L.marker([hazard.lat, hazard.lon], { icon });
        
        marker.on('click', () => {
          // Only admins can delete the hazard
          if (isAdmin) {
            // Trigger the custom modal instead of window.confirm
            setHazardToDelete(hazard.uuid || hazard.id);
          } else {
            // Show standard popup for non-admin users
            marker.bindPopup(`<b class="font-sans text-sm">Hazard Alert</b>`).openPopup();
          }
        });

        marker.addTo(hazardLayerGroup.current);
      }
    });
  }, [mapInstance, isAdmin]);

  useEffect(() => {
    if (!isActive || !mapInstance.current || !isMapReady) return;

    loadHazards();

    // Listen to Realtime database changes
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hazards' }, () => {
        loadHazards();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'hazards' }, () => {
        loadHazards();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isActive, mapInstance, loadHazards, isMapReady]);

  const handleReportHazard = async (
    userId: string,
    type: 'fire' | 'flood' | 'road_blocked' | 'landslide',
    lat: number,
    lng: number
  ) => {
    if (lat === 0) return;
    await reportHazard(userId, type, lat, lng);
    setShowHazardReportModal(false);
    loadHazards();
  };

  // Function to handle the actual deletion from the modal
  const handleDeleteHazard = async () => {
    if (!hazardToDelete) return;
    await removeHazard(hazardToDelete);
    setHazardToDelete(null); // Close the modal
    loadHazards(); // Refresh the map
  };

  return {
    hazardsList, 
    showHazardAlert, 
    setShowHazardAlert,
    showHazardReportModal, 
    setShowHazardReportModal, 
    handleReportHazard,
    hazardToDelete, 
    setHazardToDelete, 
    handleDeleteHazard 
  };
}