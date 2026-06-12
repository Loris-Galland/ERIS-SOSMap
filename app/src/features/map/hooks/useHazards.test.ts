/*
 * useHazards.test.ts — Vitest unit tests for the useHazards hook.
 * Mocks hazardService, supabaseClient, and leaflet to keep tests isolated.
 * Covers initial state values, handleReportHazard (valid/invalid coordinates,
 * all hazard types, modal dismissal), handleDeleteHazard (guard against null,
 * correct UUID forwarded, state reset), and individual state setters.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../../services/hazardService', () => ({
  fetchHazards: vi.fn().mockResolvedValue([]),
  reportHazard: vi.fn().mockResolvedValue({ uuid: 'new-uuid', type: 'fire' }),
  removeHazard: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../db/supabaseClient', () => ({
  supabase: {
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn().mockReturnValue({}),
    }),
    removeChannel: vi.fn(),
  },
}));

vi.mock('leaflet', () => ({
  default: {
    layerGroup: vi.fn().mockReturnValue({
      addTo: vi.fn().mockReturnThis(),
      clearLayers: vi.fn(),
    }),
    marker: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      bindPopup: vi.fn().mockReturnThis(),
      openPopup: vi.fn().mockReturnThis(),
    }),
    divIcon: vi.fn().mockReturnValue({}),
  },
}));

import { useHazards } from './useHazards';
import { reportHazard, removeHazard } from '../../../services/hazardService';

const mockReportHazard = vi.mocked(reportHazard);
const mockRemoveHazard = vi.mocked(removeHazard);

// mapInstance with null current so loadHazards returns early (no map needed)
const NULL_MAP_REF = { current: null } as any;

const DEFAULT_PROPS = {
  mapInstance: NULL_MAP_REF,
  isActive: false,
  isAdmin: false,
  isMapReady: false,
  userId: 'user-1',
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Initial state ───

describe('useHazards — initial state', () => {
  it('starts with an empty hazards list', () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));
    expect(result.current.hazardsList).toEqual([]);
  });

  it('starts with showHazardAlert set to true', () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));
    expect(result.current.showHazardAlert).toBe(true);
  });

  it('starts with showHazardReportModal set to false', () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));
    expect(result.current.showHazardReportModal).toBe(false);
  });

  it('starts with hazardToDelete set to null', () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));
    expect(result.current.hazardToDelete).toBeNull();
  });
});

// ─── handleReportHazard ───

describe('useHazards — handleReportHazard', () => {
  it('calls reportHazard with the correct arguments', async () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));

    await act(async () => {
      await result.current.handleReportHazard('user-1', 'fire', 48.85, 2.35);
    });

    expect(mockReportHazard).toHaveBeenCalledWith('user-1', 'fire', 48.85, 2.35);
  });

  it('does nothing when lat is 0 (no GPS fix)', async () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));

    await act(async () => {
      await result.current.handleReportHazard('user-1', 'flood', 0, 2.35);
    });

    expect(mockReportHazard).not.toHaveBeenCalled();
  });

  it('closes the report modal after successful submission', async () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));

    act(() => {
      result.current.setShowHazardReportModal(true);
    });

    await act(async () => {
      await result.current.handleReportHazard('user-1', 'fire', 48.85, 2.35);
    });

    expect(result.current.showHazardReportModal).toBe(false);
  });

  it('supports all hazard types', async () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));
    const types = ['fire', 'flood', 'road_blocked', 'landslide'] as const;

    for (const type of types) {
      await act(async () => {
        await result.current.handleReportHazard('user-1', type, 48.85, 2.35);
      });
    }

    expect(mockReportHazard).toHaveBeenCalledTimes(4);
  });
});

// ─── handleDeleteHazard ───

describe('useHazards — handleDeleteHazard', () => {
  it('does nothing when hazardToDelete is null', async () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));

    await act(async () => {
      await result.current.handleDeleteHazard();
    });

    expect(mockRemoveHazard).not.toHaveBeenCalled();
  });

  it('calls removeHazard with the current hazardToDelete value', async () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));

    act(() => {
      result.current.setHazardToDelete('target-uuid');
    });

    await act(async () => {
      await result.current.handleDeleteHazard();
    });

    expect(mockRemoveHazard).toHaveBeenCalledWith('target-uuid', DEFAULT_PROPS.userId, DEFAULT_PROPS.isAdmin);
  });

  it('resets hazardToDelete to null after deletion', async () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));

    act(() => {
      result.current.setHazardToDelete('target-uuid');
    });

    await act(async () => {
      await result.current.handleDeleteHazard();
    });

    expect(result.current.hazardToDelete).toBeNull();
  });
});

// ─── State setters ───

describe('useHazards — state setters', () => {
  it('setShowHazardAlert updates the state', () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));

    act(() => {
      result.current.setShowHazardAlert(false);
    });

    expect(result.current.showHazardAlert).toBe(false);
  });

  it('setShowHazardReportModal updates the state', () => {
    const { result } = renderHook(() => useHazards(DEFAULT_PROPS));

    act(() => {
      result.current.setShowHazardReportModal(true);
    });

    expect(result.current.showHazardReportModal).toBe(true);
  });
});
