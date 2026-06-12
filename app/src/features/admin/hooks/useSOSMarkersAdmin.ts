/*
 * Hook that renders live SOS alert markers on the Leaflet map instance for admins.
 * Fetches non-resolved alerts from Supabase and places color-coded pulsing circle
 * markers on the map, each with a popup showing the user name and current status.
 * Subscribes to real-time Postgres changes to refresh markers automatically.
 * Only activates when both isActive and isAdmin are true.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { supabase } from '../../../db/supabaseClient';

interface SOSMarkerAlert {
  id: string;
  latitude: number;
  longitude: number;
  first_name: string;
  last_name: string;
  status: string;
  notes: string;
}

// Returns a colored circle marker based on alert status
function getMarkerColor(status: string): string {
  switch (status) {
    case 'pending': return '#F97316';      // orange
    case 'in_progress': return '#3B82F6';  // blue
    case 'delivered': return '#EF4444';    // red
    default: return '#6B7280';             // gray
  }
}

interface UseSOSMarkersAdminProps {
  mapInstance: React.RefObject<L.Map | null>;
  isActive: boolean;
  isAdmin: boolean;
}

export function useSOSMarkersAdmin({ mapInstance, isActive, isAdmin }: UseSOSMarkersAdminProps) {
  const layerGroup = useRef<L.LayerGroup | null>(null);

  const loadMarkers = async () => {
    if (!mapInstance.current || !isAdmin) return;

    // Fetch only non-resolved alerts
    const { data, error } = await supabase
      .from('sos_alerts')
      .select('id, latitude, longitude, first_name, last_name, status, notes')
      .neq('status', 'resolved')
      .order('created_at', { ascending: false });

    if (error || !data) return;

    // Clear existing markers
    layerGroup.current?.clearLayers();

    data.forEach((alert: SOSMarkerAlert) => {
      if (!alert.latitude || !alert.longitude) return;

      const color = getMarkerColor(alert.status);

      // Pulsing circle marker
      const icon = L.divIcon({
        className: '',
        html: `
          <div style="
            width: 20px; height: 20px;
            background: ${color};
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 4px ${color}44;
            animation: pulse 1.5s infinite;
          "></div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker([alert.latitude, alert.longitude], { icon });

      // Popup with basic info
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 13px; min-width: 160px;">
          <strong>${alert.first_name} ${alert.last_name}</strong><br/>
          <span style="color: ${color}; font-weight: bold; text-transform: capitalize;">${alert.status}</span><br/>
          ${alert.notes ? `<em style="color: #888;">"${alert.notes}"</em>` : ''}
        </div>
      `);

      layerGroup.current?.addLayer(marker);
    });
  };

  useEffect(() => {
    if (!isActive || !isAdmin || !mapInstance.current) return;

    // Create a dedicated layer group for SOS admin markers
    layerGroup.current = L.layerGroup().addTo(mapInstance.current);

    loadMarkers();

    // Real-time subscription — refresh markers on any SOS change
    const channel = supabase
      .channel('admin-sos-map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => {
        loadMarkers();
      })
      .subscribe();

    return () => {
      layerGroup.current?.remove();
      layerGroup.current = null;
      supabase.removeChannel(channel);
    };
  }, [isActive, isAdmin, mapInstance.current]);
}