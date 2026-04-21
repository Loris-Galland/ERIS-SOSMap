import { db } from '../db/localDb';
import { supabase } from '../db/supabaseClient';
import { CapacitorErisSosmap } from 'capacitor-eris-sosmap';

export const dispatchSOS = async (
  userId: string, 
  position: { lat: number; lng: number; alt: number },
  batteryLevel: number = 100
) => {
  
  // Payload strictly formatted for Supabase schema
  const supabasePayload = {
    user_id: userId,
    latitude: position.lat,
    longitude: position.lng,
    altitude: position.alt,
    battery_level: batteryLevel,
    notes: 'Manual SOS alert triggered',
    status: 'pending',
    transmission_method: 'PENDING'
  };

  // Payload merged with Dexie specific requirements (PendingSOS interface)
  const dexiePayload = {
    ...supabasePayload,
    lat: position.lat,
    lon: position.lng,
    timestamp: new Date().toISOString()
  };

  try {
    // Trigger native network check and hardware fallback logic
    const nativeResult = await CapacitorErisSosmap.triggerEmergency({
      latitude: position.lat,
      longitude: position.lng,
      userId: userId
    });

    if (nativeResult.transmissionMethod === 'INTERNET') {
      supabasePayload.transmission_method = 'INTERNET';
      supabasePayload.status = 'delivered';
      
      // Send directly to Supabase
      const { error } = await supabase.from('sos_alerts').insert(supabasePayload);
      if (error) throw error;
      
      // Keep a local history of successful alerts in Dexie
      dexiePayload.transmission_method = 'INTERNET';
      dexiePayload.status = 'delivered';
      await db.sosQueue.add(dexiePayload as any);
      
      return { success: true, method: 'INTERNET' };
      
    } else {
      // Handled by Native Wi-Fi Fallback
      dexiePayload.transmission_method = nativeResult.transmissionMethod;
      dexiePayload.status = 'delivered_to_hardware';
      
      // Store in local queue for history and sync
      await db.sosQueue.add(dexiePayload as any);
      
      return { success: true, method: nativeResult.transmissionMethod };
    }

  } catch (error) {
    // Total failure, queue for background retry
    console.error("SOS Dispatch failed, adding to background retry queue:", error);
    
    dexiePayload.status = 'queued';
    await db.sosQueue.add(dexiePayload as any);
    
    return { success: false, method: 'QUEUED_FOR_RETRY' };
  }
};