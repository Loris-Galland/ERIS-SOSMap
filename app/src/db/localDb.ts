import Dexie, { type Table } from 'dexie';

// Define the structure for SOS alerts waiting for network sync
export interface PendingSOS {
  id?: number;
  lat: number;
  lon: number;
  notes: string;
  status: 'pending' | 'syncing';
  timestamp: number;
}

// Define the structure for the local user profile
export interface LocalUserProfile {
  id: string;
  firstName: string;
  bloodType: string;
  allergies: string;
}

export class ErisLocalDB extends Dexie {
  sosQueue!: Table<PendingSOS>;
  userProfile!: Table<LocalUserProfile>;

  constructor() {
    super('ErisLocalDB');
    
    // Define tables and indexes (++id means auto-incremented primary key)
    this.version(1).stores({
      sosQueue: '++id, status, timestamp',
      userProfile: 'id'
    });
  }
}

// Export a single instance of the database to use across the app
export const db = new ErisLocalDB();