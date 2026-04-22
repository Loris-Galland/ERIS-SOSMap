import { db } from '../db/localDb';
import { supabase } from '../db/supabaseClient';
import { CapacitorErisSosmap } from 'capacitor-eris-sosmap';

// Background retry engine
// This runs whenever dispatchSOS is called and flushes any previously queued alerts.
export const flushRetryQueue = async () => {
  const pending = await db.sosQueue.where('status').equals('queued').toArray();
  for (const item of pending) {
    try {
      const { error } = await supabase.from('sos_alerts').insert({
        user_id: item.user_id,
        latitude: item.lat,
        longitude: item.lon,
        altitude: item.altitude,
        battery_level: item.battery_level,
        notes: item.notes,
        status: 'delivered',
        transmission_method: 'INTERNET_RETRY',
      });
      if (!error) {
        await db.sosQueue.update(item.id!, {
          status: 'delivered',
          transmission_method: 'INTERNET_RETRY',
        });
        console.log('[ERIS] Queued SOS successfully flushed:', item.id);
      }
    } catch {
      // Keep it queued for the next attempt
      console.warn('[ERIS] Could not flush retry queue item:', item.id);
    }
  }
};

export const dispatchSOS = async (
  userId: string,
  position: { lat: number; lng: number; alt: number },
  batteryLevel: number = 100,
  notes: string = '',
) => {
  // Try to flush any previously failed SOS alerts first
  await flushRetryQueue();

  const finalNotes = notes.trim() !== '' ? notes : 'Manual SOS alert triggered';

  // Payload strictly formatted for Supabase schema
  const supabasePayload = {
    user_id: userId,
    latitude: position.lat,
    longitude: position.lng,
    altitude: position.alt,
    battery_level: batteryLevel,
    notes: finalNotes, // <-- 3. UTILISÉ ICI
    status: 'pending',
    transmission_method: 'PENDING',
  };

  // Payload merged with Dexie specific requirements (PendingSOS interface)
  const dexiePayload = {
    user_id: userId,
    lat: position.lat,
    lon: position.lng,
    altitude: position.alt,
    battery_level: batteryLevel,
    notes: finalNotes,
    status: 'pending' as any,
    transmission_method: 'PENDING',
    timestamp: Date.now(),
  };

  try {
    // Trigger native network check and hardware fallback logic
    const nativeResult = await CapacitorErisSosmap.triggerEmergency({
      latitude: position.lat,
      longitude: position.lng,
      userId,
    });

    if (nativeResult.transmissionMethod === 'INTERNET') {
      // Send directly to Supabase
      const { error } = await supabase.from('sos_alerts').insert({
        ...supabasePayload,
        status: 'delivered',
        transmission_method: 'INTERNET',
      });

      if (error) throw error;

      // Keep a local history of successful alerts in Dexie
      dexiePayload.status = 'delivered';
      dexiePayload.transmission_method = 'INTERNET';
      await db.sosQueue.add(dexiePayload);

      return { success: true, method: 'INTERNET' };
    } else {
      // Handled by Native Wi-Fi Fallback
      // Store in local queue for history and sync
      dexiePayload.status = 'delivered_to_hardware';
      dexiePayload.transmission_method = nativeResult.transmissionMethod;
      await db.sosQueue.add(dexiePayload);

      return { success: true, method: nativeResult.transmissionMethod };
    }
  } catch (error) {
    // Total failure, queue for background retry
    console.error('SOS Dispatch failed, adding to background retry queue:', error);

    dexiePayload.status = 'queued';
    dexiePayload.transmission_method = 'QUEUED_FOR_RETRY';
    await db.sosQueue.add(dexiePayload);

    return { success: false, method: 'QUEUED_FOR_RETRY' };
  }
};
