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
}

// Define the structure for the local user profile
export interface LocalUserProfile {
  id: string;
  firstName: string;
  lastName?: string;
  bloodType: string;
  allergies: string;
  medicalConditions?: string;
  currentCondition?: string;
}

export class ErisLocalDB extends Dexie {
  sosQueue!: Table<PendingSOS>;
  userProfile!: Table<LocalUserProfile>;
  emergencyContacts!: Table<any, string>;

  constructor() {
    super('ErisLocalDB');
    
    // Define tables and indexes (++id means auto-incremented primary key)
    this.version(3).stores({
      sosQueue: '++id, status, timestamp, user_id',
      userProfile: 'id',
      emergencyContacts: 'id, user_id'
    });
  }
}

// Export a single instance of the database to use across the app
export const db = new ErisLocalDB();