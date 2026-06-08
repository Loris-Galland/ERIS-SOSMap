/*
 * Core SOS dispatch service for the ERIS app.
 * Exports dispatchSOS, flushRetryQueue, and revokeSOS.
 * dispatchSOS orchestrates multi-path delivery: internet via Supabase, hardware
 * fallback (LoRa / Wi-Fi Direct) via the Capacitor plugin, SMS via native deep
 * link, and mesh broadcast. Failed alerts are queued in Dexie for retry.
 * Connects to: Supabase 'sos_alerts', localDb sosQueue and userProfile, and the
 * capacitor-eris-sosmap plugin for native network and mesh capabilities.
 * ERIS-RescueAI reads sos_alerts directly via their own Supabase service-role
 * client — no explicit API call needed from this side.
 */

import { db } from '../db/localDb';
import { supabase } from '../db/supabaseClient';
import { CapacitorErisSosmap } from 'capacitor-eris-sosmap';
import { Capacitor } from '@capacitor/core';
export interface SOSSensorData {
  fall_detected?: boolean;
  crash_detected?: boolean;
  inactivity_detected?: boolean;
}

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
        first_name: item.first_name,
        last_name: item.last_name,
        blood_type: item.blood_type,
        allergies: item.allergies,
        medical_conditions: item.medical_conditions,
        current_condition: item.current_condition
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

// ==========================================
// OFFLINE EMERGENCY NOTIFICATION (SMS)
// ==========================================
const triggerOfflineNotification = async (position: {lat: number, lng: number}, notes: string) => {
  try {
    const mapLink = `https://maps.google.com/?q=${position.lat},${position.lng}`;
    const message = `URGENT (ERIS) : J'ai déclenché un SOS. Ma position : ${mapLink}. Notes : ${notes}`;
    
    // Attempt to retrieve local emergency numbers if they are cached in Dexie
    let phones = "";
    if ((db as any).emergencyContacts) {
      const contacts = await (db as any).emergencyContacts.toArray();
      if (contacts && contacts.length > 0) {
        phones = contacts.map((c: any) => c.phone_number).join(',');
      }
    }

    // Handle the syntax difference between iOS and Android for SMS links
    const separator = Capacitor.getPlatform() === 'ios' ? '&' : '?';
    
    // Open the native SMS application using the cellular fallback network
    window.open(`sms:${phones}${separator}body=${encodeURIComponent(message)}`, '_system');
  } catch (err) {
    console.error("[ERIS] Failed to open the SMS application", err);
  }
};

export const dispatchSOS = async (
  userId: string,
  position: { lat: number; lng: number; alt: number },
  batteryLevel: number = 100,
  notes: string = '',
  sensorData?: SOSSensorData,
) => {
  const isGuest = localStorage.getItem('eris_is_guest') === 'true' || userId.startsWith('guest');

  flushRetryQueue().catch(() => {});

  // Use user input or a default message
  const finalNotes = notes.trim() !== '' ? notes : 'Manual SOS alert triggered';

  // Fetch local user profile to attach medical data even when offline
  let profile = undefined;
  try {
    profile = await db.userProfile.get(userId);
  } catch (e) {
    console.warn('[ERIS] Could not load local profile', e);
  }

  // Payload strictly formatted for Supabase schema
  const supabasePayload = {
    user_id: userId,
    latitude: position.lat,
    longitude: position.lng,
    altitude: position.alt,
    battery_level: batteryLevel,
    notes: finalNotes,
    status: 'pending',
    transmission_method: 'PENDING',
    first_name: profile?.firstName || 'Unknown',
    last_name: profile?.lastName || 'Unknown',
    blood_type: profile?.bloodType || 'Unknown',
    allergies: profile?.allergies || 'None',
    medical_conditions: profile?.medicalConditions || 'None',
    current_condition: profile?.currentCondition || 'Unknown'
  };

  // Payload merged with Dexie specific requirements
  const dexiePayload = {
    ...supabasePayload,
    lat: position.lat,
    lon: position.lng,
    status: 'pending' as any,
    timestamp: Date.now(),
  };

  // Prepare the stringified payload to bounce across the Mesh Network 
  const meshPayload = JSON.stringify({
    ...supabasePayload,
    isRelay: true // Flag to tell receivers this is a relayed message, not their own
  });

  try {
    const nativeResult = await CapacitorErisSosmap.triggerEmergency({
      latitude: position.lat,
      longitude: position.lng,
      userId,
    });

    // Guests skip the Supabase path — SMS + local queue only
    if (nativeResult.transmissionMethod === 'INTERNET' && !isGuest) {
      const { data, error } = await supabase
        .from('sos_alerts')
        .insert({
          ...supabasePayload,
          status: 'delivered',
          transmission_method: 'INTERNET',
        })
        .select();

      if (error) throw error;

      dexiePayload.status = 'delivered';
      dexiePayload.transmission_method = 'INTERNET';
      const localId = await db.sosQueue.add(dexiePayload);

      return { success: true, method: 'INTERNET', supabaseId: data[0].id, localId };
    } else {
      // Handled by Native Wi-Fi / LoRa Fallback
      dexiePayload.status = 'delivered_to_hardware';
      dexiePayload.transmission_method = nativeResult.transmissionMethod;
      const localId = await db.sosQueue.add(dexiePayload);

      // Trigger the SMS fallback notification
      await triggerOfflineNotification(position, finalNotes);

      CapacitorErisSosmap.broadcastMeshMessage({ message: meshPayload }).catch(() => {});

      return { success: true, method: nativeResult.transmissionMethod, localId };
    }
  } catch (error) {
    // Total failure, queue for background retry
    console.error('SOS Dispatch failed, adding to background retry queue:', error);

    dexiePayload.status = 'queued';
    dexiePayload.transmission_method = 'QUEUED_FOR_RETRY';
    const localId = await db.sosQueue.add(dexiePayload);

    // Trigger the SMS fallback
    await triggerOfflineNotification(position, finalNotes);

    CapacitorErisSosmap.broadcastMeshMessage({ message: meshPayload }).catch(() => {});

    return { success: false, method: 'QUEUED_FOR_RETRY', localId };
  }
};

export const revokeSOS = async (userId: string, supabaseId?: string, localId?: number) => {
  try {
    if (supabaseId) {
      await supabase
        .from('sos_alerts')
        .update({ status: 'revoked' })
        .eq('id', supabaseId)
        .eq('user_id', userId);
    }
    if (localId) {
      await db.sosQueue.update(localId, { status: 'revoked' as any });
    }
    return true;
  } catch (error) {
    return false;
  }
};