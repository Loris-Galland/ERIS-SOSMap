/*
 * Hook that fetches and maintains a real-time list of SOS alerts for the admin dashboard.
 * Performs an initial load from the sos_alerts Supabase table, then subscribes to
 * INSERT and UPDATE events via Postgres changes to keep the list live. Exports
 * updateAlertStatus, which calls the update_sos_alert_status RPC (server-side admin
 * check) with an optimistic UI update.
 * Consumed by SOSAlertDashboard and types are shared with useSOSMarkersAdmin.
 */

import { useState, useEffect } from 'react';
import { supabase } from '../../../db/supabaseClient';

export type AlertStatus = 'pending' | 'in_progress' | 'resolved' | 'delivered' | 'queued';

export interface SOSAlertAdmin {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  status: AlertStatus;
  transmission_method: string;
  latitude: number;
  longitude: number;
  altitude: number;
  battery_level: number;
  notes: string;
  created_at: string;
  incident_type?: string;
  victim_count?: number;
  trigger_source?: string;
  photo_data?: string;
  blood_type?: string;
  allergies?: string;
  medical_conditions?: string;
  current_condition?: string;
}

export function useSOSAlerts() {
  const [alerts, setAlerts] = useState<SOSAlertAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initial fetch — all alerts, newest first
  const fetchAlerts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('sos_alerts')
      .select('id, user_id, first_name, last_name, status, transmission_method, latitude, longitude, altitude, battery_level, notes, created_at, incident_type, victim_count, trigger_source, photo_data, blood_type, allergies, medical_conditions, current_condition')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      setError(error.message);
    } else {
      setAlerts(data as SOSAlertAdmin[]);
    }
    setLoading(false);
  };

  // Update a single alert status via the update_sos_alert_status RPC
  // (SECURITY DEFINER, verifies the caller is an admin server-side)
  const updateAlertStatus = async (id: string, status: AlertStatus) => {
    const { error } = await supabase.rpc('update_sos_alert_status', {
      alert_id: id,
      new_status: status,
    });

    if (!error) {
      // Optimistic update — reflect change immediately in the UI
      setAlerts((prev) =>
        prev.map((alert) => (alert.id === id ? { ...alert, status } : alert))
      );
    }
    return !error;
  };

  useEffect(() => {
    fetchAlerts();

    // Real-time subscription — listen for any INSERT or UPDATE on sos_alerts
    const channel = supabase
      .channel('admin-sos-alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sos_alerts' },
        (payload) => {
          // Prepend new alert to the top of the list
          setAlerts((prev) => [payload.new as SOSAlertAdmin, ...prev]);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sos_alerts' },
        (payload) => {
          setAlerts((prev) =>
            prev.map((alert) =>
              alert.id === payload.new.id ? (payload.new as SOSAlertAdmin) : alert
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { alerts, loading, error, updateAlertStatus, refetch: fetchAlerts };
}