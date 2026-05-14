import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('@capacitor/geolocation', () => ({
  Geolocation: {
    requestPermissions: vi.fn().mockResolvedValue({ location: 'granted' }),
    watchPosition: vi.fn(),
    clearWatch: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: vi.fn().mockReturnValue(false),
  },
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: vi.fn(() => ({ type: 'div-icon' })),
    marker: vi.fn(() => ({
      addTo: vi.fn().mockReturnThis(),
      setLatLng: vi.fn().mockReturnThis(),
    })),
  },
}));

import { useGPS } from './useGPS';
import { Geolocation } from '@capacitor/geolocation';

const mockWatchPosition = vi.mocked(Geolocation.watchPosition);
const mockClearWatch = vi.mocked(Geolocation.clearWatch);

const CACHED_POSITION = { lat: 48.85, lng: 2.35, alt: 100 };
const CACHE_KEY = 'sosmap_last_location';

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

// ─── Initial position ───

describe('useGPS — initial position', () => {
  it('returns the default position (0,0,0) when there is no cache', () => {
    const mapRef = { current: null } as any;
    const { result } = renderHook(() => useGPS({ mapInstance: mapRef, isActive: false }));

    expect(result.current.userPosition).toEqual({ lat: 0, lng: 0, alt: 0 });
  });

  it('initializes position from the localStorage cache', () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(CACHED_POSITION));
    const mapRef = { current: null } as any;

    const { result } = renderHook(() => useGPS({ mapInstance: mapRef, isActive: false }));

    expect(result.current.userPosition).toEqual(CACHED_POSITION);
  });

  it('falls back to (0,0,0) when the localStorage cache is invalid JSON', () => {
    localStorage.setItem(CACHE_KEY, 'not-valid-json');
    const mapRef = { current: null } as any;

    const { result } = renderHook(() => useGPS({ mapInstance: mapRef, isActive: false }));

    expect(result.current.userPosition).toEqual({ lat: 0, lng: 0, alt: 0 });
  });
});

// ─── GPS status ───

describe('useGPS — GPS status', () => {
  it('displays "Locating..." on startup', () => {
    const mapRef = { current: null } as any;
    const { result } = renderHook(() => useGPS({ mapInstance: mapRef, isActive: false }));

    expect(result.current.gpsStatus).toBe('Locating...');
  });

  it('updates position and status when the watchPosition callback fires', async () => {
    let capturedCallback: ((pos: any, err: any) => void) | null = null;
    mockWatchPosition.mockImplementation(async (_, callback) => {
      capturedCallback = callback;
      return 'watch-id-1';
    });

    const mapInstance = { setView: vi.fn(), removeLayer: vi.fn() } as any;
    const mapRef = { current: mapInstance };

    const { result } = renderHook(() => useGPS({ mapInstance: mapRef, isActive: true }));

    await act(async () => {
      capturedCallback?.({ coords: { latitude: 48.85, longitude: 2.35, altitude: 200 } }, null);
    });

    expect(result.current.userPosition).toEqual({ lat: 48.85, lng: 2.35, alt: 200 });
    expect(result.current.gpsStatus).toBe('Connected');
  });

  it('caches the updated position to localStorage', async () => {
    let capturedCallback: ((pos: any, err: any) => void) | null = null;
    mockWatchPosition.mockImplementation(async (_, callback) => {
      capturedCallback = callback;
      return 'watch-id-2';
    });

    const mapRef = { current: { setView: vi.fn(), removeLayer: vi.fn() } as any };
    renderHook(() => useGPS({ mapInstance: mapRef, isActive: true }));

    await act(async () => {
      capturedCallback?.({ coords: { latitude: 45.75, longitude: 4.85, altitude: 50 } }, null);
    });

    const cached = JSON.parse(localStorage.getItem(CACHE_KEY)!);
    expect(cached).toEqual({ lat: 45.75, lng: 4.85, alt: 50 });
  });
});

// ─── Lifecycle ───

describe('useGPS — lifecycle', () => {
  it('does not start tracking when isActive is false', () => {
    const mapRef = { current: null } as any;
    renderHook(() => useGPS({ mapInstance: mapRef, isActive: false }));

    expect(mockWatchPosition).not.toHaveBeenCalled();
  });

  it('starts tracking when isActive is true', async () => {
    mockWatchPosition.mockResolvedValue('watch-id-3');
    const mapRef = { current: { setView: vi.fn() } as any };

    renderHook(() => useGPS({ mapInstance: mapRef, isActive: true }));

    await vi.waitFor(() => {
      expect(mockWatchPosition).toHaveBeenCalledOnce();
    });
  });

  it('clears the GPS watch when the component unmounts', async () => {
    mockWatchPosition.mockResolvedValue('watch-id-4');
    const mapRef = { current: { setView: vi.fn(), removeLayer: vi.fn() } as any };

    const { unmount } = renderHook(() => useGPS({ mapInstance: mapRef, isActive: true }));

    await vi.waitFor(() => expect(mockWatchPosition).toHaveBeenCalled());
    unmount();

    await vi.waitFor(() => {
      expect(mockClearWatch).toHaveBeenCalledWith({ id: 'watch-id-4' });
    });
  });
});
