/*
 * Dexie (IndexedDB) database definition for offline-first data storage.
 * Declares the ErisLocalDB class with six tables: sosQueue (pending SOS alerts
 * awaiting network sync), userProfile, emergencyContacts, hazards, riskEvents
 * (AI detection history), and pendingAudioUploads (recordings queued for
 * Supabase Storage). Used by sosService, hazardService, audio hooks, and risk
 * detection features throughout the app.
 */
import Dexie, { type Table } from 'dexie';
import type { RiskEventRecord } from '../features/risk/types';

// Pending audio recording waiting to be uploaded to Supabase Storage (offline fallback)
export interface PendingAudioUpload {
  id?: number;
  user_id: string;
  trigger_type: 'fall' | 'crash';
  blob: Blob;
  duration_seconds: number;
  created_at: number;
  retry_count: number;
}

// Define the structure for SOS alerts waiting for network sync
export interface PendingSOS {
  id?: number;
  user_id: string;
  lat: number;
  lon: number;
  altitude: number;
  battery_level: number;
  notes: string;
  status: 'pending' | 'queued' | 'delivered' | 'delivered_to_hardware';
  transmission_method: string;
  timestamp: number;
  first_name?: string;
  last_name?: string;
  blood_type?: string;
  allergies?: string;
  medical_conditions?: string;
  current_condition?: string;
  is_relay?: boolean;
}

export interface LocalUserProfile {
  id: string;
  firstName: string;
  lastName?: string;
  bloodType: string;
  allergies: string;
  medicalConditions?: string;
  currentCondition?: string;
}

// Structure for reported hazards
export interface HazardAlert {
  id?: number;
  uuid: string;
  user_id: string;
  type: 'fire' | 'flood' | 'road_blocked' | 'landslide';
  lat: number;
  lon: number;
  timestamp: number;
  synced: boolean;
}

export class ErisLocalDB extends Dexie {
  sosQueue!: Table<PendingSOS>;
  userProfile!: Table<LocalUserProfile>;
  emergencyContacts!: Table<any, string>;
  hazards!: Table<HazardAlert>;
  riskEvents!: Table<RiskEventRecord>;
  pendingAudioUploads!: Table<PendingAudioUpload>;

  constructor() {
    super('ErisLocalDB');

    this.version(4).stores({
      sosQueue: '++id, status, timestamp, user_id',
      userProfile: 'id',
      emergencyContacts: 'id, user_id',
      hazards: '++id, uuid, type, synced, timestamp'
    });

    // Version 5 — add riskEvents table for AI risk detection audit history
    this.version(5).stores({
      sosQueue:          '++id, status, timestamp, user_id',
      userProfile:       'id',
      emergencyContacts: 'id, user_id',
      hazards:           '++id, uuid, type, synced, timestamp',
      riskEvents:        '++id, pattern, level, detectedAt, dismissed',
    });

    // Version 6 — add pendingAudioUploads for offline audio recording fallback
    this.version(6).stores({
      sosQueue:             '++id, status, timestamp, user_id',
      userProfile:          'id',
      emergencyContacts:    'id, user_id',
      hazards:              '++id, uuid, type, synced, timestamp',
      riskEvents:           '++id, pattern, level, detectedAt, dismissed',
      pendingAudioUploads:  '++id, user_id, created_at',
    });
  }
}

export const db = new ErisLocalDB();
