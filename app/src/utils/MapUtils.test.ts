import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('leaflet', () => ({
  default: {
    latLngBounds: vi.fn((sw, ne) => ({ sw, ne })),
    tileLayer: {
      offline: vi.fn(() => ({ type: 'offline-layer' })),
    },
  },
}));
vi.mock('leaflet.offline', () => ({}));

import { MAP_STYLES, PRESET_REGIONS, createOfflineLayer } from './MapUtils';
import L from 'leaflet';

// ─── MAP_STYLES ───

describe('MAP_STYLES', () => {
  it('contains all expected map style keys', () => {
    expect(Object.keys(MAP_STYLES)).toEqual(['dark', 'light', 'contrasted', 'terrain', 'satellite']);
  });

  it.each(Object.entries(MAP_STYLES))('style "%s" has all required fields', (_, style) => {
    expect(style).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      url: expect.any(String),
      icon: expect.any(String),
      estimatedSizeFactor: expect.any(Number),
    });
  });

  it('all URLs are non-empty strings', () => {
    Object.values(MAP_STYLES).forEach((style) => {
      expect(style.url.length).toBeGreaterThan(0);
    });
  });

  it('estimatedSizeFactor is positive for all styles', () => {
    Object.values(MAP_STYLES).forEach((style) => {
      expect(style.estimatedSizeFactor).toBeGreaterThan(0);
    });
  });
});

// ─── PRESET_REGIONS ───

describe('PRESET_REGIONS', () => {
  it('contains exactly 5 regions', () => {
    expect(PRESET_REGIONS).toHaveLength(5);
  });

  it('IDs are unique and sequential', () => {
    const ids = PRESET_REGIONS.map((r) => r.id);
    expect(ids).toEqual([1, 2, 3, 4, 5]);
  });

  it.each(PRESET_REGIONS)('region "$name" has all required fields', (region) => {
    expect(region.id).toBeGreaterThan(0);
    expect(region.name).toBeTruthy();
    expect(region.size).toMatch(/\d+ MB/);
    expect(region.detail).toBeTruthy();
    expect(region.bounds).toBeDefined();
  });
});

// ─── createOfflineLayer ───

describe('createOfflineLayer', () => {
  beforeEach(() => {
    vi.mocked((L.tileLayer as any).offline).mockClear();
  });

  it('uses the dark style URL by default', () => {
    createOfflineLayer();
    expect((L.tileLayer as any).offline).toHaveBeenCalledWith(
      MAP_STYLES.dark.url,
      expect.any(Object),
    );
  });

  it('uses the URL passed as parameter', () => {
    const customUrl = 'https://custom.tiles/{z}/{x}/{y}.png';
    createOfflineLayer(customUrl);
    expect((L.tileLayer as any).offline).toHaveBeenCalledWith(customUrl, expect.any(Object));
  });

  it('configures correct min/max zoom levels', () => {
    createOfflineLayer();
    const [, options] = vi.mocked((L.tileLayer as any).offline).mock.lastCall!;
    expect(options).toMatchObject({ minZoom: 12, maxZoom: 17 });
  });

  it('returns the layer created by Leaflet', () => {
    const layer = createOfflineLayer();
    expect(layer).toEqual({ type: 'offline-layer' });
  });
});
