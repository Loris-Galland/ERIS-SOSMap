/*
 * useWeather.test.ts — Vitest unit tests for the useWeather hook.
 * Stubs the global fetch and navigator.onLine to run entirely in-memory.
 * Covers offline/no-network guard conditions, all WMO weather code mappings,
 * temperature rounding, correct API URL construction, graceful network error
 * handling, and the showWeatherReport state toggle.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWeather } from './useWeather';

const buildWeatherResponse = (temperature: number, weathercode: number) => ({
  ok: true,
  json: vi.fn().mockResolvedValue({ current_weather: { temperature, weathercode } }),
});

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(buildWeatherResponse(20, 0)));
});

// ─── Fetch guard conditions ───

describe('useWeather — fetch guard conditions', () => {
  it('does not call fetch when offlineMode is true', async () => {
    const { result } = renderHook(() => useWeather(true));

    await act(async () => {
      await result.current.fetchWeather(48.85, 2.35);
    });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not call fetch when navigator.onLine is false', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    const { result } = renderHook(() => useWeather(false));

    await act(async () => {
      await result.current.fetchWeather(48.85, 2.35);
    });

    expect(fetch).not.toHaveBeenCalled();
  });
});

// ─── Weather code mapping ───

describe('useWeather — weather code mapping', () => {
  it.each([
    [0, 'weather.clear', 'sunny'],
    [1, 'weather.partlyCloudy', 'partly_cloudy_day'],
    [3, 'weather.cloudy', 'cloud'],
    [45, 'weather.fog', 'foggy'],
    [61, 'weather.rain', 'rainy'],
    [71, 'weather.snow', 'weather_snowy'],
    [77, 'weather.hail', 'grain'],
    [95, 'weather.storm', 'thunderstorm'],
    [999, 'profile.unknown', 'cloud'],
  ])('weathercode %i maps to condition "%s" with icon "%s"', async (code, expectedCondition, expectedIcon) => {
    vi.mocked(fetch).mockResolvedValue(buildWeatherResponse(15, code) as any);
    const { result } = renderHook(() => useWeather(false));

    await act(async () => {
      await result.current.fetchWeather(48.85, 2.35);
    });

    expect(result.current.currentWeather.condition).toBe(expectedCondition);
    expect(result.current.currentWeather.icon).toBe(expectedIcon);
  });
});

// ─── Successful fetch ───

describe('useWeather — successful fetch', () => {
  it('updates currentWeather with the fetched temperature', async () => {
    vi.mocked(fetch).mockResolvedValue(buildWeatherResponse(22, 0) as any);
    const { result } = renderHook(() => useWeather(false));

    await act(async () => {
      await result.current.fetchWeather(48.85, 2.35);
    });

    expect(result.current.currentWeather.temp).toBe('22');
  });

  it('rounds the temperature to the nearest integer', async () => {
    vi.mocked(fetch).mockResolvedValue(buildWeatherResponse(18.7, 0) as any);
    const { result } = renderHook(() => useWeather(false));

    await act(async () => {
      await result.current.fetchWeather(48.85, 2.35);
    });

    expect(result.current.currentWeather.temp).toBe('19');
  });

  it('calls the Open-Meteo API with the correct coordinates', async () => {
    const { result } = renderHook(() => useWeather(false));

    await act(async () => {
      await result.current.fetchWeather(45.75, 4.85);
    });

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('latitude=45.75'),
    );
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('longitude=4.85'),
    );
  });

  it('does not throw when the API returns an error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useWeather(false));

    await expect(
      act(async () => {
        await result.current.fetchWeather(48.85, 2.35);
      }),
    ).resolves.not.toThrow();
  });
});

// ─── Weather report toggle ───

describe('useWeather — weather report toggle', () => {
  it('initializes showWeatherReport as false', () => {
    const { result } = renderHook(() => useWeather(false));
    expect(result.current.showWeatherReport).toBe(false);
  });

  it('updates showWeatherReport via the setter', () => {
    const { result } = renderHook(() => useWeather(false));

    act(() => {
      result.current.setShowWeatherReport(true);
    });

    expect(result.current.showWeatherReport).toBe(true);
  });
});
