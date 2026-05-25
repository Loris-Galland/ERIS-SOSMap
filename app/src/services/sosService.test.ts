/*
 * Vitest unit tests for sosService.ts.
 * Covers dispatchSOS (INTERNET, hardware fallback, total failure paths),
 * flushRetryQueue (empty queue, successful flush, Supabase error),
 * and revokeSOS. Supabase, Dexie, and the Capacitor plugin are fully mocked.
 * Run with: npm run test (from app/).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

vi.mock('../db/localDb', () => ({
  db: {
    sosQueue: {
      where: vi.fn(),
      add: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    userProfile: {
      get: vi.fn(),
    },
  },
}));

vi.mock('capacitor-eris-sosmap', () => ({
  CapacitorErisSosmap: {
    triggerEmergency: vi.fn(),
    broadcastMeshMessage: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    getPlatform: vi.fn().mockReturnValue('android'),
  },
}));

import { dispatchSOS, flushRetryQueue, revokeSOS } from './sosService';
import { supabase } from '../db/supabaseClient';
import { db } from '../db/localDb';
import { CapacitorErisSosmap } from 'capacitor-eris-sosmap';

const mockFrom = vi.mocked(supabase.from);
const mockTriggerEmergency = vi.mocked(CapacitorErisSosmap.triggerEmergency);
const mockSosQueueAdd = vi.mocked(db.sosQueue.add);
const mockSosQueueWhere = vi.mocked(db.sosQueue.where);
const mockSosQueueUpdate = vi.mocked(db.sosQueue.update);
const mockSosQueueDelete = vi.mocked(db.sosQueue.delete);
const mockUserProfileGet = vi.mocked(db.userProfile.get);

const USER_ID = 'user-123';
const POSITION = { lat: 48.85, lng: 2.35, alt: 50 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('open', vi.fn());

  // Empty queue by default so flushRetryQueue is a no-op
  mockSosQueueWhere.mockReturnValue({
    equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
  } as any);

  mockUserProfileGet.mockResolvedValue(undefined);

  // Default Supabase mock: insert → select → success (INTERNET path)
  mockFrom.mockReturnValue({
    insert: vi.fn().mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ id: 'sup-abc' }], error: null }),
    }),
    delete: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }),
  } as any);

  mockSosQueueAdd.mockResolvedValue(99);
});

// ─── flushRetryQueue ───

describe('flushRetryQueue', () => {
  it('does not contact Supabase when the queue is empty', async () => {
    await flushRetryQueue();
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('sends queued items to Supabase and marks them as delivered', async () => {
    const queuedItem = {
      id: 10,
      user_id: USER_ID,
      lat: 48.85,
      lon: 2.35,
      altitude: 50,
      battery_level: 80,
      notes: 'queued alert',
      status: 'queued',
    };

    mockSosQueueWhere.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([queuedItem]) }),
    } as any);
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
    } as any);

    await flushRetryQueue();

    expect(mockFrom).toHaveBeenCalledWith('sos_alerts');
    expect(mockSosQueueUpdate).toHaveBeenCalledWith(10, {
      status: 'delivered',
      transmission_method: 'INTERNET_RETRY',
    });
  });

  it('keeps items queued when Supabase returns an error', async () => {
    const queuedItem = { id: 11, user_id: USER_ID, lat: 0, lon: 0, altitude: 0, battery_level: 0, notes: '' };
    mockSosQueueWhere.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([queuedItem]) }),
    } as any);
    mockFrom.mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: new Error('Network error') }),
    } as any);

    await flushRetryQueue();

    expect(mockSosQueueUpdate).not.toHaveBeenCalled();
  });
});

// ─── dispatchSOS ───

describe('dispatchSOS', () => {
  it('sends via INTERNET and returns the Supabase ID', async () => {
    mockTriggerEmergency.mockResolvedValue({ success: true, transmissionMethod: 'INTERNET' });

    const result = await dispatchSOS(USER_ID, POSITION, 75, 'Test SOS');

    expect(result.success).toBe(true);
    expect(result.method).toBe('INTERNET');
    expect(result.supabaseId).toBe('sup-abc');
    expect(result.localId).toBe(99);
  });

  it('uses hardware fallback when transmissionMethod is not INTERNET', async () => {
    mockTriggerEmergency.mockResolvedValue({ success: true, transmissionMethod: 'LORA' });

    const result = await dispatchSOS(USER_ID, POSITION, 50, 'Offline SOS');

    expect(result.success).toBe(true);
    expect(result.method).toBe('LORA');
    expect(mockSosQueueAdd).toHaveBeenCalledOnce();
  });

  it('queues alert for retry and returns success=false on total failure', async () => {
    mockTriggerEmergency.mockRejectedValue(new Error('Hardware failure'));

    const result = await dispatchSOS(USER_ID, POSITION, 20, 'Critical');

    expect(result.success).toBe(false);
    expect(result.method).toBe('QUEUED_FOR_RETRY');
    expect(mockSosQueueAdd).toHaveBeenCalledOnce();
  });

  it('uses the default message when notes is blank', async () => {
    mockTriggerEmergency.mockResolvedValue({ success: true, transmissionMethod: 'INTERNET' });

    await dispatchSOS(USER_ID, POSITION, 100, '   ');

    const addCall = mockSosQueueAdd.mock.calls[0][0];
    expect(addCall.notes).toBe('Manual SOS alert triggered');
  });

  it('attaches medical data from the local profile when available', async () => {
    mockTriggerEmergency.mockResolvedValue({ success: true, transmissionMethod: 'INTERNET' });
    mockUserProfileGet.mockResolvedValue({
      id: USER_ID,
      firstName: 'Jean',
      lastName: 'Dupont',
      bloodType: 'O+',
      allergies: 'Penicillin',
      medicalConditions: 'Diabetes',
      currentCondition: 'Stable',
    });

    await dispatchSOS(USER_ID, POSITION, 80, 'SOS with profile');

    const insertArgs = vi.mocked(mockFrom.mock.results[0].value.insert).mock.calls[0][0];
    expect(insertArgs.first_name).toBe('Jean');
    expect(insertArgs.blood_type).toBe('O+');
  });
});

// ─── revokeSOS ───

describe('revokeSOS', () => {
  it('deletes from Supabase when supabaseId is provided', async () => {
    const result = await revokeSOS('sup-abc', undefined);

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('sos_alerts');
  });

  it('deletes from Dexie when localId is provided', async () => {
    const result = await revokeSOS(undefined, 42);

    expect(result).toBe(true);
    expect(mockSosQueueDelete).toHaveBeenCalledWith(42);
  });

  it('deletes from both sources when both IDs are provided', async () => {
    const result = await revokeSOS('sup-abc', 42);

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('sos_alerts');
    expect(mockSosQueueDelete).toHaveBeenCalledWith(42);
  });

  it('returns false when an error is thrown', async () => {
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockRejectedValue(new Error('DB error')),
      }),
    } as any);

    const result = await revokeSOS('bad-id', undefined);

    expect(result).toBe(false);
  });
});
