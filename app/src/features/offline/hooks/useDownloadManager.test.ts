/*
 * useDownloadManager.test.ts
 * Vitest unit tests for the useDownloadManager hook. Covers initial state
 * hydration from localStorage, getBoundsForRegion for preset and custom regions,
 * handleDelete dialog flow and localStorage persistence, and setCustomRegions.
 * Leaflet and leaflet.offline are fully mocked to keep tests browser-free.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('leaflet', () => ({
  default: {
    latLngBounds: vi.fn((sw, ne) => ({ sw, ne, isValid: () => true })),
    tileLayer: { offline: vi.fn(() => ({})) },
    map: vi.fn().mockReturnValue({
      fitBounds: vi.fn(),
      remove: vi.fn(),
      whenReady: vi.fn(),
      addLayer: vi.fn(),
    }),
    control: vi.fn(),
    layerGroup: vi.fn().mockReturnValue({ addTo: vi.fn().mockReturnThis() }),
  },
}));
vi.mock('leaflet.offline', () => ({}));

import { useDownloadManager } from './useDownloadManager';

const t = (key: string, fallback?: string) => fallback ?? key;
const openDialog = vi.fn();
const closeDialog = vi.fn();
const showAlert = vi.fn();

const HOOKS_ARGS = { t, openDialog, closeDialog, showAlert };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();

  Object.defineProperty(navigator, 'storage', {
    value: { estimate: vi.fn().mockResolvedValue({ usage: 1024 * 1024 * 10 }) },
    configurable: true,
  });
});

// ─── State initialization ───

describe('useDownloadManager — state initialization', () => {
  it('starts with empty downloadedRegions when localStorage is empty', () => {
    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));
    expect(result.current.downloadedRegions).toEqual([]);
  });

  it('loads downloadedRegions from localStorage', () => {
    localStorage.setItem('eris_offline_regions', JSON.stringify([1, 2]));
    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));

    expect(result.current.downloadedRegions).toEqual([1, 2]);
  });

  it('loads customRegions from localStorage', () => {
    const custom = [{ id: 'custom_1', name: 'My Zone', bounds: {} }];
    localStorage.setItem('eris_custom_regions', JSON.stringify(custom));
    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));

    expect(result.current.customRegions).toEqual(custom);
  });

  it('loads metadata from localStorage', () => {
    const meta = { 1: { lastUpdate: 1700000000000, styles: ['dark'] } };
    localStorage.setItem('eris_offline_metadata', JSON.stringify(meta));
    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));

    expect(result.current.metadata[1]).toMatchObject({ styles: ['dark'] });
  });

  it('handles missing localStorage keys gracefully', () => {
    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));

    expect(result.current.downloadedRegions).toEqual([]);
    expect(result.current.customRegions).toEqual([]);
    expect(result.current.metadata).toEqual({});
  });
});

// ─── getBoundsForRegion ───

describe('useDownloadManager — getBoundsForRegion', () => {
  it('returns undefined for an unknown region ID', () => {
    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));
    expect(result.current.getBoundsForRegion(999)).toBeUndefined();
  });

  it('returns bounds for a known preset region', () => {
    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));
    const bounds = result.current.getBoundsForRegion(1);
    expect(bounds).toBeDefined();
  });

  it('returns bounds for a custom region', () => {
    const custom = [{
      id: 'custom_abc',
      name: 'Custom Zone',
      bounds: { southWest: [44.5, 5.5], northEast: [46.5, 7.5] },
    }];
    localStorage.setItem('eris_custom_regions', JSON.stringify(custom));
    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));

    const bounds = result.current.getBoundsForRegion('custom_abc');
    expect(bounds).toBeDefined();
  });
});

// ─── handleDelete ───

describe('useDownloadManager — handleDelete', () => {
  it('calls openDialog with a danger confirm dialog', () => {
    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));

    act(() => {
      result.current.handleDelete(1, 'Paris');
    });

    expect(openDialog).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'danger', isConfirm: true }),
    );
  });

  it("removes the region from downloadedRegions when onConfirm is called", async () => {
    localStorage.setItem('eris_offline_regions', JSON.stringify([1, 2]));

    let capturedOnConfirm: (() => void) | null = null;
    openDialog.mockImplementation(({ onConfirm }: any) => {
      capturedOnConfirm = onConfirm;
    });

    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));

    act(() => {
      result.current.handleDelete(1, 'Paris');
    });

    act(() => {
      capturedOnConfirm?.();
    });

    await waitFor(() => {
      expect(result.current.downloadedRegions).not.toContain(1);
      expect(result.current.downloadedRegions).toContain(2);
    });
  });

  it("persists the updated downloadedRegions to localStorage after delete", async () => {
    localStorage.setItem('eris_offline_regions', JSON.stringify([1, 2]));

    let capturedOnConfirm: (() => void) | null = null;
    openDialog.mockImplementation(({ onConfirm }: any) => {
      capturedOnConfirm = onConfirm;
    });

    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));

    act(() => {
      result.current.handleDelete(2, 'Lyon');
    });

    act(() => {
      capturedOnConfirm?.();
    });

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('eris_offline_regions')!);
      expect(stored).not.toContain(2);
    });
  });

  it('calls closeDialog when cancel is triggered', () => {
    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));

    let capturedOnCancel: (() => void) | null = null;
    openDialog.mockImplementation(({ onCancel }: any) => {
      capturedOnCancel = onCancel;
    });

    act(() => {
      result.current.handleDelete(1, 'Paris');
    });

    act(() => {
      capturedOnCancel?.();
    });

    expect(closeDialog).toHaveBeenCalledOnce();
  });
});

// ─── setCustomRegions ───

describe('useDownloadManager — setCustomRegions', () => {
  it('updates the customRegions state', () => {
    const { result } = renderHook(() => useDownloadManager(HOOKS_ARGS));
    const newRegions = [{ id: 'custom_1', name: 'Test Zone' }];

    act(() => {
      result.current.setCustomRegions(newRegions as any);
    });

    expect(result.current.customRegions).toEqual(newRegions);
  });
});
