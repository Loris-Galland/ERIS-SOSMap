/*
 * useHazards — hook that loads, renders, and manages hazard markers on the
 * Leaflet map via hazardService (fetchHazards, reportHazard, removeHazard).
 * Subscribes to Supabase Realtime INSERT/DELETE events on the hazards table
 * so markers update automatically without a manual refresh.
 * Admins can delete markers through a confirmation modal (hazardToDelete state).
 * Exposes reporting and deletion handlers plus modal visibility state.
 * Used by MapScreen; depends on supabaseClient for the realtime subscription.
 */

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
  
  // State to temporarily store the drawn shape before validation
  const [pendingGeometry, setPendingGeometry] = useState<any>(null);

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
      let hexColor = '#ef4444'; //Default color (red) for the drawing

      switch (hazard.type) {
        case 'fire': iconHtml = 'local_fire_department'; colorClass = 'bg-red-500'; hexColor = '#ef4444'; break;
        case 'flood': iconHtml = 'water_drop'; colorClass = 'bg-blue-500'; hexColor = '#3b82f6'; break;
        case 'road_blocked': iconHtml = 'block'; colorClass = 'bg-orange-500'; hexColor = '#f97316'; break;
        case 'landslide': iconHtml = 'landslide'; colorClass = 'bg-purple-500'; hexColor = '#a855f7'; break;
        case 'other': iconHtml = 'warning'; colorClass = 'bg-yellow-500'; hexColor = '#eab308'; break;
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
        // Add the classic marker (kept intact)
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

        // Draw the geometric shape around the marker if it exists
        if (hazard.shape_type === 'circle' && hazard.shape_metadata?.radius) {
          L.circle([hazard.lat, hazard.lon], {
            radius: hazard.shape_metadata.radius,
            color: hexColor,
            fillOpacity: 0.3,
            weight: 2
          }).addTo(hazardLayerGroup.current);
        } else if (hazard.shape_type === 'rectangle' && hazard.shape_metadata?.bounds) {
          L.rectangle(hazard.shape_metadata.bounds, {
            color: hexColor,
            fillOpacity: 0.3,
            weight: 2
          }).addTo(hazardLayerGroup.current);
        }
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

  // Modified to use pendingGeometry if the user has drawn something
  const handleReportHazard = async (
    userId: string,
    type: 'fire' | 'flood' | 'road_blocked' | 'landslide' | string,
    lat: number,
    lng: number
  ) => {
    let finalLat = lat;
    let finalLng = lng;
    let shapeType: 'point' | 'circle' | 'rectangle' = 'point';
    let shapeMetadata = undefined;

    // If a shape was drawn with Leaflet Draw, we replace the simple point with the shape
    if (pendingGeometry) {
      finalLat = pendingGeometry.lat;
      finalLng = pendingGeometry.lng;
      shapeType = pendingGeometry.shape_type;
      shapeMetadata = pendingGeometry.shape_metadata;
    }

    if (finalLat === 0) return;

    // The service call now uses the shape parameters
    await reportHazard(userId, type as any, finalLat, finalLng, shapeType as any, shapeMetadata);
    
    setShowHazardReportModal(false);
    setPendingGeometry(null); // Clear the drawing after submission
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
    handleDeleteHazard,
    pendingGeometry, 
    setPendingGeometry 
  };
}