/*
 * Vitest unit tests for hazardService.ts.
 * Covers reportHazard, fetchHazards, and removeHazard across online and offline
 * scenarios. Supabase and Dexie are fully mocked to isolate service logic.
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
    hazards: {
      add: vi.fn(),
      where: vi.fn(),
      filter: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { reportHazard, fetchHazards, removeHazard } from './hazardService';
import { supabase } from '../db/supabaseClient';
import { db } from '../db/localDb';

const mockFrom = vi.mocked(supabase.from);
const mockHazardsAdd = vi.mocked(db.hazards.add);
const mockHazardsWhere = vi.mocked(db.hazards.where);
const mockHazardsFilter = vi.mocked(db.hazards.filter);

const USER_ID = 'user-abc';
const TEST_HAZARD = { type: 'fire' as const, lat: 48.85, lon: 2.35 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid-1234-5678-abcd' as `${string}-${string}-${string}-${string}-${string}`);
  mockHazardsAdd.mockResolvedValue(1);
});

// ─── reportHazard ───

describe('reportHazard', () => {
  it('inserts into Supabase and Dexie when online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockFrom.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) } as any);

    const result = await reportHazard(USER_ID, TEST_HAZARD.type, TEST_HAZARD.lat, TEST_HAZARD.lon);

    expect(mockFrom).toHaveBeenCalledWith('hazards');
    expect(mockHazardsAdd).toHaveBeenCalledOnce();
    expect(result.synced).toBe(true);
    expect(result.uuid).toBe('test-uuid-1234-5678-abcd');
    expect(result.type).toBe('fire');
  });

  it('skips Supabase and saves locally when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const result = await reportHazard(USER_ID, TEST_HAZARD.type, TEST_HAZARD.lat, TEST_HAZARD.lon);

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockHazardsAdd).toHaveBeenCalledOnce();
    expect(result.synced).toBe(false);
  });

  it('falls back to local-only save when Supabase throws', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockFrom.mockReturnValue({ insert: vi.fn().mockRejectedValue(new Error('network error')) } as any);

    const result = await reportHazard(USER_ID, TEST_HAZARD.type, TEST_HAZARD.lat, TEST_HAZARD.lon);

    expect(mockHazardsAdd).toHaveBeenCalledOnce();
    expect(result.synced).toBe(false);
  });

  it('returns the hazard with correct coordinates and userId', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const result = await reportHazard(USER_ID, 'flood', 45.75, 4.85);

    expect(result).toMatchObject({ user_id: USER_ID, type: 'flood', lat: 45.75, lon: 4.85 });
  });
});

// ─── fetchHazards ───

describe('fetchHazards', () => {
  const remoteHazardRaw = {
    id: 'remote-uuid',
    user_id: USER_ID,
    type: 'fire',
    latitude: 48.85,
    longitude: 2.35,
    created_at: '2025-01-01T00:00:00Z',
  };
  const localUnsyncedHazard = {
    uuid: 'local-uuid',
    user_id: USER_ID,
    type: 'flood',
    lat: 45.75,
    lon: 4.85,
    timestamp: Date.now(),
    synced: false,
  };

  beforeEach(() => {
    mockHazardsWhere.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([localUnsyncedHazard]) }),
    } as any);
  });

  it('merges remote and unsynced local hazards when online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [remoteHazardRaw], error: null }),
    } as any);

    const hazards = await fetchHazards();

    expect(hazards).toHaveLength(2);
    expect(hazards[0].uuid).toBe('remote-uuid');
    expect(hazards[1].uuid).toBe('local-uuid');
  });

  it('returns only local hazards when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    const hazards = await fetchHazards();

    expect(mockFrom).not.toHaveBeenCalled();
    expect(hazards).toHaveLength(1);
    expect(hazards[0].uuid).toBe('local-uuid');
  });

  it('correctly maps Supabase fields to the internal format', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    mockFrom.mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [remoteHazardRaw], error: null }),
    } as any);
    mockHazardsWhere.mockReturnValue({
      equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) }),
    } as any);

    const hazards = await fetchHazards();

    expect(hazards[0]).toMatchObject({
      uuid: 'remote-uuid',
      user_id: USER_ID,
      type: 'fire',
      lat: 48.85,
      lon: 2.35,
      synced: true,
    });
  });
});

// ─── removeHazard ───

describe('removeHazard', () => {
  beforeEach(() => {
    mockHazardsFilter.mockReturnValue({ delete: vi.fn().mockResolvedValue(undefined) } as any);
  });

  it('deletes from Supabase (scoped to the owner) and Dexie when online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const eqMock = vi.fn();
    const chainable: any = { eq: eqMock };
    eqMock.mockReturnValue(chainable);
    chainable.then = (resolve: any) => resolve({ error: null });
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue(chainable),
    } as any);

    await removeHazard('target-uuid', USER_ID);

    expect(mockFrom).toHaveBeenCalledWith('hazards');
    expect(eqMock).toHaveBeenCalledWith('id', 'target-uuid');
    expect(eqMock).toHaveBeenCalledWith('user_id', USER_ID);
    expect(mockHazardsFilter).toHaveBeenCalledOnce();
  });

  it('lets admins delete a hazard without scoping to user_id', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const eqMock = vi.fn();
    const chainable: any = { eq: eqMock };
    eqMock.mockReturnValue(chainable);
    chainable.then = (resolve: any) => resolve({ error: null });
    mockFrom.mockReturnValue({
      delete: vi.fn().mockReturnValue(chainable),
    } as any);

    await removeHazard('target-uuid', USER_ID, true);

    expect(eqMock).toHaveBeenCalledWith('id', 'target-uuid');
    expect(eqMock).not.toHaveBeenCalledWith('user_id', USER_ID);
  });

  it('deletes only from Dexie when offline', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

    await removeHazard('target-uuid', USER_ID);

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockHazardsFilter).toHaveBeenCalledOnce();
  });
});
