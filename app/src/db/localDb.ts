import Dexie, { type Table } from 'dexie';

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

  constructor() {
    super('ErisLocalDB');
    
    // Update to version 4 and add the hazards table
    this.version(4).stores({
      sosQueue: '++id, status, timestamp, user_id',
      userProfile: 'id',
      emergencyContacts: 'id, user_id',
      hazards: '++id, uuid, type, synced, timestamp'
    });
  }
}

export const db = new ErisLocalDB();