/*
 * Service module for hazard reporting and retrieval in the ERIS app.
 * Exports reportHazard, fetchHazards, and removeHazard.
 * Each operation targets both the Supabase 'hazards' table (when online) and
 * the local Dexie database for offline-first support. Unsynced records are
 * merged with remote data when fetchHazards is called while online.
 */

import { db } from '../db/localDb';
import { supabase } from '../db/supabaseClient';

export const reportHazard = async (
  userId: string, 
  type: 'fire' | 'flood' | 'road_blocked' | 'landslide' | string, 
  lat: number, 
  lon: number,
  shape_type: 'point' | 'circle' | 'rectangle' = 'point',
  shape_metadata?: any
) => {
  const uuid = crypto.randomUUID();
  const timestamp = Date.now();

  const hazardData = {
    uuid,
    user_id: userId,
    type,
    lat,
    lon,
    shape_type,
    shape_metadata,
    timestamp,
    synced: false
  };

  try {
    if (navigator.onLine) {
      // Send directly to Supabase if online
      const { error } = await supabase.from('hazards').insert({
        id: uuid,
        user_id: userId,
        type: type,
        latitude: lat,
        longitude: lon,
        shape_type: shape_type,
        shape_metadata: shape_metadata
      });

      if (error) throw error;
      hazardData.synced = true;
    }
  } catch (error) {
    console.warn('[HAZARD] Offline mode or network error, saving locally only.', error);
  }

  // Save in Dexie for immediate display on the local map
  await db.hazards.add(hazardData as any);
  
  return hazardData;
};

// Function to fetch all hazards (remote + local unsynced)
export const fetchHazards = async () => {
  let remoteHazards: any[] = [];
  
  if (navigator.onLine) {
    try {
      const { data, error } = await supabase.from('hazards').select('*');
      if (!error && data) {
        remoteHazards = data.map(h => ({
          uuid: h.id,
          user_id: h.user_id,
          type: h.type,
          lat: h.latitude,
          lon: h.longitude,
          shape_type: h.shape_type || 'point',
          shape_metadata: h.shape_metadata,
          timestamp: new Date(h.created_at).getTime(),
          synced: true
        }));
      }
    } catch (e) {
      console.warn("[HAZARD] Error fetching remote hazards from Supabase", e);
    }
  }

  // Combine remote hazards with the local ones that haven't been synced yet
  const localHazards = await db.hazards.where('synced').equals('false').toArray();
  return [...remoteHazards, ...localHazards];
};

export const removeHazard = async (uuid: string) => {
  try {
    if (navigator.onLine) {
      // Delete from Supabase 
      const { error } = await supabase.from('hazards').delete().eq('id', uuid);
      if (error) throw error;
    }
  } catch (error) {
    console.warn('[HAZARD] Offline mode or error deleting from Supabase:', error);
  }

  // Delete from local Dexie DB
  try {
    await db.hazards.filter((hazard: any) => hazard.uuid === uuid).delete();
  } catch (err) {
    await db.hazards.delete(uuid as any); 
  }
};