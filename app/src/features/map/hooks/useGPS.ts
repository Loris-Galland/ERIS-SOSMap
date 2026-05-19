import { useEffect, useRef, useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Capacitor } from '@capacitor/core';
import L from 'leaflet';

const CACHE_KEY = 'sosmap_last_location';

export interface UserPosition {
  lat: number;
  lng: number;
  alt: number;
  speed: number;
}

interface UseGPSProps {
  mapInstance?: React.MutableRefObject<L.Map | null>;
  isActive: boolean;
}

export function useGPS({ mapInstance, isActive }: UseGPSProps) {
  const [userPosition, setUserPosition] = useState<UserPosition>(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        // Ensure speed exists even in older cached data
        return { lat: parsed.lat, lng: parsed.lng, alt: parsed.alt, speed: parsed.speed || 0 };
      } catch (e) {
        console.error('Failed to parse cached location', e);
      }
    }
    return { lat: 0, lng: 0, alt: 0, speed: 0 };
  });
  
  const [gpsStatus, setGpsStatus] = useState('Locating...');
  const userMarker = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!isActive) return;

    let watchId: string | null = null;

    const updateMarker = (lat: number, lng: number, shouldSetView: boolean) => {
      if (!mapInstance?.current) return;

      if (userMarker.current) {
        userMarker.current.setLatLng([lat, lng]);
      } else {
        const icon = L.divIcon({
          className: '',
          html: `<div class="w-[18px] h-[18px] rounded-full border-[3px] border-white [.theme-contrasted_&]:!shadow-none" style="background-color: rgb(var(--eris-position)); box-shadow: 0 0 15px rgba(var(--eris-position), 0.6);"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        userMarker.current = L.marker([lat, lng], { icon }).addTo(mapInstance.current);
        if (shouldSetView) {
          mapInstance.current.setView([lat, lng], 15);
        }
      }
    };

    if (!userMarker.current) {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          updateMarker(parsed.lat, parsed.lng, true);
        } catch (e) { }
      }
    }

    const startTracking = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          await Geolocation.requestPermissions();
        }

        watchId = await Geolocation.watchPosition(
          {
            enableHighAccuracy: true,
            timeout: 30000,
            maximumAge: 0,
          },
          (position, err) => {
            if (err) {
              console.warn('[GPS] Error:', err);
              return;
            }
            if (position) {
              const { latitude, longitude, altitude, speed } = position.coords;

              const currentSpeedKmh = speed ? speed * 3.6 : 0;

              const newPosition = { 
                lat: latitude, 
                lng: longitude, 
                alt: altitude || 0,
                speed: currentSpeedKmh
              };

              setUserPosition(newPosition);
              setGpsStatus('Connected');

              localStorage.setItem(CACHE_KEY, JSON.stringify(newPosition));

              updateMarker(latitude, longitude, !userMarker.current);
            }
          },
        );
      } catch (error) {
        console.error('GPS Init Error:', error);
        setGpsStatus('GPS Unavailable');
      }
    };

    startTracking();

    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
      if (userMarker.current && mapInstance?.current) {
        mapInstance.current.removeLayer(userMarker.current);
      }
      userMarker.current = null;
    };
  }, [isActive, mapInstance]);

  return { userPosition, gpsStatus };
}