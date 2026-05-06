import { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import { fetchHazards, reportHazard } from '../../../services/hazardService';
import { supabase } from '../../../db/supabaseClient';

interface UseHazardsProps {
  mapInstance: React.MutableRefObject<L.Map | null>;
  isActive: boolean;
}

export function useHazards({ mapInstance, isActive }: UseHazardsProps) {
  const [hazardsList, setHazardsList] = useState<any[]>([]);
  const [showHazardAlert, setShowHazardAlert] = useState(true);
  const [showHazardReportModal, setShowHazardReportModal] = useState(false);
  const hazardLayerGroup = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!isActive || !mapInstance.current) return;

    if (!hazardLayerGroup.current) {
      hazardLayerGroup.current = L.layerGroup().addTo(mapInstance.current);
    }

    const loadHazards = async () => {
      const hazards = await fetchHazards();
      setHazardsList(hazards);

      hazardLayerGroup.current?.clearLayers();

      hazards.forEach((hazard: any) => {
        let iconHtml = '';
        let colorClass = '';

        switch (hazard.type) {
          case 'fire':
            iconHtml = 'local_fire_department';
            colorClass = 'bg-red-500';
            break;
          case 'flood':
            iconHtml = 'water_drop';
            colorClass = 'bg-blue-500';
            break;
          case 'road_blocked':
            iconHtml = 'block';
            colorClass = 'bg-orange-500';
            break;
          case 'landslide':
            iconHtml = 'landslide';
            colorClass = 'bg-purple-500';
            break;
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
          L.marker([hazard.lat, hazard.lon], { icon }).addTo(hazardLayerGroup.current);
        }
      });
    };

    loadHazards();

    // Realtime Supabase 
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'hazards' }, () => {
        loadHazards();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isActive, mapInstance]);

  const handleReportHazard = async (
    userId: string,
    type: 'fire' | 'flood' | 'road_blocked' | 'landslide',
    lat: number,
    lng: number
  ) => {
    if (lat === 0) return;
    await reportHazard(userId, type, lat, lng);
    setShowHazardReportModal(false);
  };

  return {
    hazardsList,
    showHazardAlert,
    setShowHazardAlert,
    showHazardReportModal,
    setShowHazardReportModal,
    handleReportHazard,
  };
}