/*
 * useWeather — hook that fetches current weather conditions from the Open-Meteo
 * API for a given latitude/longitude and maps WMO weather codes to icon, color,
 * condition key, and background class used by the weather widget in MapScreen.
 * Skips all network calls when offlineMode is true or navigator.onLine is false.
 * Exposes currentWeather state, its setter (for manual user reports), a
 * showWeatherReport toggle, and the fetchWeather callback.
 */

import { useState, useCallback } from 'react';

const getWeatherDetails = (code: number) => {
  if (code === 0) return { condition: 'weather.clear', icon: 'sunny', color: 'text-eris-weather-clear', bg: 'bg-eris-weather-clear/20' };
  if (code === 1 || code === 2) return { condition: 'weather.partlyCloudy', icon: 'partly_cloudy_day', color: 'text-eris-weather-partly', bg: 'bg-eris-weather-partly/20' };
  if (code === 3) return { condition: 'weather.cloudy', icon: 'cloud', color: 'text-eris-weather-cloudy', bg: 'bg-eris-weather-cloudy/20' };
  if ([45, 48].includes(code)) return { condition: 'weather.fog', icon: 'foggy', color: 'text-eris-weather-fog', bg: 'bg-eris-weather-fog/20' };
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { condition: 'weather.rain', icon: 'rainy', color: 'text-eris-weather-rainy', bg: 'bg-eris-weather-rainy/20' };
  if ([71, 73, 75, 85, 86].includes(code)) return { condition: 'weather.snow', icon: 'weather_snowy', color: 'text-eris-weather-snow', bg: 'bg-eris-weather-snow/20' };
  if ([77].includes(code)) return { condition: 'weather.hail', icon: 'grain', color: 'text-eris-weather-hail', bg: 'bg-eris-weather-hail/20' };
  if ([95, 96, 99].includes(code)) return { condition: 'weather.storm', icon: 'thunderstorm', color: 'text-eris-weather-storm', bg: 'bg-eris-weather-storm/20' };
  return { condition: 'profile.unknown', icon: 'cloud', color: 'text-eris-weather-cloudy', bg: 'bg-eris-weather-cloudy/20' };
};

export function useWeather(offlineMode: boolean) {
  const [currentWeather, setCurrentWeather] = useState({
    temp: '--',
    condition: 'profile.loading',
    icon: 'sync',
    color: 'text-eris-primary',
    bg: 'bg-eris-primary/20',
  });
  const [showWeatherReport, setShowWeatherReport] = useState(false);

  const fetchWeather = useCallback(async (lat: number, lng: number) => {
    if (offlineMode || !navigator.onLine) return;
    try {
      const res = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true`
      );
      const data = await res.json();
      if (data.current_weather) {
        const { temperature, weathercode } = data.current_weather;
        const details = getWeatherDetails(weathercode);
        setCurrentWeather({
          temp: Math.round(temperature).toString(),
          ...details,
        });
      }
    } catch (e) {
      console.error('Error weather forecast API:', e);
    }
  }, [offlineMode]);

  return { currentWeather, setCurrentWeather, showWeatherReport, setShowWeatherReport, fetchWeather };
}