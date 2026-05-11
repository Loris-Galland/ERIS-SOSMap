import { db } from '../db/localDb';
import { supabase } from '../db/supabaseClient';

export const reportHazard = async (userId: string, type: 'fire' | 'flood' | 'road_blocked' | 'landslide', lat: number, lon: number) => {
  const uuid = crypto.randomUUID();
  const timestamp = Date.now();

  const hazardData = {
    uuid,
    user_id: userId,
    type,
    lat,
    lon,
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
        longitude: lon
      });

      if (error) throw error;
      hazardData.synced = true;
    }
  } catch (error) {
    console.warn('[HAZARD] Offline mode or network error, saving locally only.', error);
  }

  // Save in Dexie for immediate display on the local map
  await db.hazards.add(hazardData);
  
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
          timestamp: new Date(h.created_at).getTime(),
          synced: true
        }));
      }
    } catch (e) {
      console.warn("[HAZARD] Error fetching remote hazards from Supabase", e);
    }
  }

  // Combine remote hazards with the local ones that haven't been synced yet
  const localHazards = await db.hazards.filter(hazard => hazard.synced === false).toArray();
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
    console.warn('[HAZARD] Impossible de supprimer sur Supabase (mode hors-ligne ?)', error);
  }

  try {
    await db.hazards.where('uuid').equals(uuid).delete();
  } catch (err) {
    await db.hazards.delete(uuid as any); 
  }
};